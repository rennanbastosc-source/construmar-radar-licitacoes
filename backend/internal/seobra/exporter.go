package seobra

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/xuri/excelize/v2"
)

// GenerateSeobraExcel creates an Excel spreadsheet (.xlsx) matching SEOBRA native import layout.
func GenerateSeobraExcel(orc *domain.Orcamento) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "orcamento"
	f.SetSheetName("Sheet1", sheetName)

	// Header
	headers := []string{
		"ITEM",
		"CÓDIGO",
		"DESCRIÇÃO",
		"FONTE",
		"UND",
		"QUANTIDADE",
		"BDI",
		"PREÇO UNITÁRIO R$",
		"PREÇO TOTAL R$",
	}

	for colIdx, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheetName, cell, h)
	}

	// Format header style
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#0A2540"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	_ = f.SetRowStyle(sheetName, 1, 1, headerStyle)

	// Items
	rowNum := 2
	for _, item := range orc.Itens {
		fonte := strings.ToUpper(item.Fonte)
		if fonte == "" || strings.Contains(fonte, "PRÓPRIA") || strings.Contains(fonte, "PROPRIA") {
			fonte = "PROPRIA"
		} else if strings.Contains(fonte, "SEINFRA") {
			fonte = "SEINFRA"
		} else if strings.Contains(fonte, "SINAPI") {
			fonte = "SINAPI"
		}

		_ = f.SetCellValue(sheetName, fmt.Sprintf("A%d", rowNum), item.ItemNumero)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("B%d", rowNum), item.CodigoReferencia)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("C%d", rowNum), item.Descricao)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("D%d", rowNum), fonte)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("E%d", rowNum), item.Unidade)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("F%d", rowNum), item.Quantidade)
		if orc.BDI > 0 {
			_ = f.SetCellValue(sheetName, fmt.Sprintf("G%d", rowNum), orc.BDI)
		}
		_ = f.SetCellValue(sheetName, fmt.Sprintf("H%d", rowNum), item.PrecoUnitario)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("I%d", rowNum), item.PrecoTotal)

		rowNum++
	}

	// Auto-fit column widths
	_ = f.SetColWidth(sheetName, "A", "A", 10)
	_ = f.SetColWidth(sheetName, "B", "B", 16)
	_ = f.SetColWidth(sheetName, "C", "C", 55)
	_ = f.SetColWidth(sheetName, "D", "D", 14)
	_ = f.SetColWidth(sheetName, "E", "E", 10)
	_ = f.SetColWidth(sheetName, "F", "F", 14)
	_ = f.SetColWidth(sheetName, "G", "G", 10)
	_ = f.SetColWidth(sheetName, "H", "H", 20)
	_ = f.SetColWidth(sheetName, "I", "I", 20)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("failed to encode SEOBRA spreadsheet: %w", err)
	}

	return buf.Bytes(), nil
}
