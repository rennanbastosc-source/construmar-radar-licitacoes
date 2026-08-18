package parser

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

var (
	reItemNum = regexp.MustCompile(`^\d+(\.\d+)*$`)
	reSinapi  = regexp.MustCompile(`\b\d{5,6}\b`)
	reBDI     = regexp.MustCompile(`(?i)bdi[:\s]*([0-9]+[.,]?[0-9]*)\s*%?`)
)

// ParseExcelBudget reads an XLSX file and produces an Orcamento with all extracted items.
func ParseExcelBudget(r io.Reader, filename string) (*domain.Orcamento, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("failed to read excel content: %w", err)
	}

	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to open excel workbook: %w", err)
	}
	defer func() {
		_ = f.Close()
	}()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("excel file has no sheets")
	}

	// Select best sheet (usually first or sheet with "orcamento", "planilha", "sintetica")
	selectedSheet := sheets[0]
	for _, s := range sheets {
		lower := strings.ToLower(s)
		if strings.Contains(lower, "orçamento") || strings.Contains(lower, "orcamento") || strings.Contains(lower, "planilha") || strings.Contains(lower, "sintetica") {
			selectedSheet = s
			break
		}
	}

	rows, err := f.GetRows(selectedSheet)
	if err != nil {
		return nil, fmt.Errorf("failed to read rows from sheet %s: %w", selectedSheet, err)
	}

	orcamentoID := uuid.New().String()
	orc := &domain.Orcamento{
		ID:               orcamentoID,
		Titulo:           cleanFileName(filename),
		Objeto:           "Orçamento extraído de planilha eletrônica",
		Orgao:            "Órgão Licitante (Planilha)",
		Localidade:       "Ceará / CE",
		DataPrecoBase:    "SINAPI / SICRO",
		BDI:              25.0, // Padrão de engenharia civil se não especificado
		Status:           domain.OrcamentoStatusAguardandoRevisao,
		OriginalFileName: filename,
		FileType:         "xlsx",
		Itens:            make([]domain.OrcamentoItem, 0),
	}

	// 1. Scan header rows for metadata & identify table header row
	headerRowIdx := -1
	colMap := make(map[string]int)

	for rIdx, row := range rows {
		rowText := strings.ToLower(strings.Join(row, " "))

		// Detect BDI in header
		if match := reBDI.FindStringSubmatch(rowText); len(match) > 1 {
			bdiVal := parsePtBrFloat(match[1])
			if bdiVal > 0 && bdiVal < 100 {
				orc.BDI = bdiVal
			}
		}

		// Detect Objeto/Título in header
		for _, cell := range row {
			cellLower := strings.ToLower(cell)
			if strings.HasPrefix(cellLower, "objeto:") || strings.HasPrefix(cellLower, "obra:") {
				orc.Objeto = strings.TrimSpace(cell[strings.Index(cell, ":")+1:])
				orc.Titulo = orc.Objeto
			} else if strings.HasPrefix(cellLower, "órgão:") || strings.HasPrefix(cellLower, "orgao:") || strings.HasPrefix(cellLower, "prefeitura") {
				orc.Orgao = strings.TrimSpace(cell)
			} else if strings.Contains(cellLower, "sinapi") || strings.Contains(cellLower, "sicro") {
				orc.DataPrecoBase = strings.TrimSpace(cell)
			}
		}

		// Detect header columns
		detectedCols := detectColumns(row)
		if len(detectedCols) >= 3 { // Must have at least item/code, desc, qty
			headerRowIdx = rIdx
			colMap = detectedCols
			break
		}
	}

	// If no header row detected, fallback to first row with data
	if headerRowIdx == -1 {
		headerRowIdx = 0
		colMap = map[string]int{
			"item":  0,
			"code":  1,
			"desc":  2,
			"und":   3,
			"qty":   4,
			"unit":  5,
			"total": 6,
		}
	}

	// 2. Scan data rows
	for i := headerRowIdx + 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) == 0 {
			continue
		}

		item := parseRowToItem(row, colMap, orcamentoID, len(orc.Itens)+1)
		if item != nil {
			orc.Itens = append(orc.Itens, *item)
		}
	}

	orc.RecalculateTotals()
	return orc, nil
}

func detectColumns(row []string) map[string]int {
	cols := make(map[string]int)
	for idx, val := range row {
		norm := strings.ToLower(strings.TrimSpace(val))
		norm = strings.ReplaceAll(norm, "º", "")
		norm = strings.ReplaceAll(norm, "°", "")

		switch {
		case norm == "item" || norm == "it" || norm == "n" || norm == "nº" || norm == "num":
			cols["item"] = idx
		case strings.Contains(norm, "código") || strings.Contains(norm, "codigo") || strings.Contains(norm, "sinapi") || strings.Contains(norm, "sicro") || strings.Contains(norm, "ref"):
			cols["code"] = idx
		case strings.Contains(norm, "descri") || strings.Contains(norm, "especifica") || strings.Contains(norm, "serviço") || strings.Contains(norm, "servico"):
			cols["desc"] = idx
		case norm == "und" || norm == "un" || norm == "unid" || norm == "unidade":
			cols["und"] = idx
		case strings.Contains(norm, "quant") || norm == "qtd" || norm == "qtde":
			cols["qty"] = idx
		case (strings.Contains(norm, "unit") || strings.Contains(norm, "unitario") || strings.Contains(norm, "unitário")) && !strings.Contains(norm, "total"):
			cols["unit"] = idx
		case strings.Contains(norm, "total") || strings.Contains(norm, "global") || strings.Contains(norm, "subtotal"):
			cols["total"] = idx
		}
	}
	return cols
}

func parseRowToItem(row []string, cols map[string]int, orcamentoID string, fallbackIdx int) *domain.OrcamentoItem {
	getColVal := func(key string) string {
		if idx, ok := cols[key]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
		return ""
	}

	desc := getColVal("desc")
	if desc == "" {
		// If description column is missing, check longest string in row
		for _, cell := range row {
			t := strings.TrimSpace(cell)
			if len(t) > len(desc) && !isNumeric(t) {
				desc = t
			}
		}
	}

	// Skip total or empty summary rows
	descLower := strings.ToLower(desc)
	if desc == "" || strings.HasPrefix(descLower, "total") || strings.HasPrefix(descLower, "sub-total") || strings.HasPrefix(descLower, "bdi") {
		return nil
	}

	itemNum := getColVal("item")
	if itemNum == "" {
		itemNum = fmt.Sprintf("%d", fallbackIdx)
	}

	code := getColVal("code")
	fonte := "PROPRIO"
	if code == "" {
		// Look for 5-6 digit code inside description or row
		if match := reSinapi.FindString(desc); match != "" {
			code = match
			fonte = "SINAPI"
		}
	} else {
		codeUpper := strings.ToUpper(code)
		if strings.Contains(codeUpper, "SINAPI") || len(code) == 5 || len(code) == 6 {
			fonte = "SINAPI"
		} else if strings.Contains(codeUpper, "SICRO") || len(code) == 7 {
			fonte = "SICRO"
		} else if strings.Contains(codeUpper, "SEINFRA") {
			fonte = "SEINFRA"
		}
	}

	und := normalizeUnit(getColVal("und"))
	qty := parsePtBrFloat(getColVal("qty"))
	unitPrice := parsePtBrFloat(getColVal("unit"))
	totalPrice := parsePtBrFloat(getColVal("total"))

	if totalPrice == 0 && qty > 0 && unitPrice > 0 {
		totalPrice = qty * unitPrice
	}

	// Skip non-item headers (like section titles without quantity)
	if qty == 0 && unitPrice == 0 && totalPrice == 0 {
		return nil
	}

	confianca := 0.98
	var flagRevisao bool
	var obsIA string

	if code == "" {
		confianca -= 0.15
		flagRevisao = true
		obsIA = "Código de composição não identificado no Excel; verificar SINAPI correspondente."
	}
	if und == "UN" && getColVal("und") == "" {
		confianca -= 0.05
	}
	if unitPrice == 0 {
		confianca -= 0.20
		flagRevisao = true
		obsIA = "Preço unitário zerado ou ausente na planilha."
	}

	return &domain.OrcamentoItem{
		ID:               uuid.New().String(),
		OrcamentoID:      orcamentoID,
		ItemNumero:       itemNum,
		CodigoReferencia: code,
		Fonte:            fonte,
		Descricao:        desc,
		Unidade:          und,
		Quantidade:       qty,
		PrecoUnitario:    unitPrice,
		PrecoTotal:       totalPrice,
		Confianca:        math.Max(0.1, confianca),
		FlagRevisao:      flagRevisao,
		ObservacaoIA:     obsIA,
	}
}

func normalizeUnit(u string) string {
	clean := strings.ToUpper(strings.TrimSpace(u))
	clean = strings.ReplaceAll(clean, ".", "")
	clean = strings.ReplaceAll(clean, "²", "2")
	clean = strings.ReplaceAll(clean, "³", "3")

	switch clean {
	case "M2", "M²", "METRO QUADRADO", "MQ":
		return "M2"
	case "M3", "M³", "METRO CUBICO", "MC":
		return "M3"
	case "M", "METRO", "ML", "METRO LINEAR":
		return "M"
	case "UN", "UND", "UNID", "UNIDADE", "PC", "PÇA", "PEÇA":
		return "UN"
	case "KG", "QUILO", "KILOGRAMA":
		return "KG"
	case "VB", "VERBA":
		return "VB"
	case "H", "HR", "HORA":
		return "H"
	case "MES", "MÊS":
		return "MES"
	case "CJ", "CONJUNTO":
		return "CJ"
	default:
		if clean != "" {
			return clean
		}
		return "UN"
	}
}

func parsePtBrFloat(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "-" {
		return 0.0
	}
	s = strings.ReplaceAll(s, "R$", "")
	s = strings.ReplaceAll(s, " ", "")

	// Check if format is 1.234,56 or 1,234.56
	if strings.Contains(s, ",") && strings.Contains(s, ".") {
		lastComma := strings.LastIndex(s, ",")
		lastDot := strings.LastIndex(s, ".")
		if lastComma > lastDot {
			// pt-BR: 1.234,56 -> 1234.56
			s = strings.ReplaceAll(s, ".", "")
			s = strings.ReplaceAll(s, ",", ".")
		} else {
			// en-US: 1,234.56 -> 1234.56
			s = strings.ReplaceAll(s, ",", "")
		}
	} else if strings.Contains(s, ",") {
		s = strings.ReplaceAll(s, ",", ".")
	}

	val, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0.0
	}
	return val
}

func isNumeric(s string) bool {
	_, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", "."), 64)
	return err == nil
}

func cleanFileName(fn string) string {
	base := fn
	if idx := strings.LastIndex(fn, "."); idx != -1 {
		base = fn[:idx]
	}
	base = strings.ReplaceAll(base, "_", " ")
	base = strings.ReplaceAll(base, "-", " ")
	return strings.Title(strings.TrimSpace(base))
}
