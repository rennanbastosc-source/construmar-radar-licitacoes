package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/google/uuid"
)

type AIExtractor struct {
	apiURL     string
	apiKey     string
	modelName  string
	httpClient *http.Client
}

func NewAIExtractor(apiURL, apiKey, modelName string) *AIExtractor {
	// Trim trailing slashes
	apiURL = strings.TrimRight(apiURL, "/")

	if modelName == "" {
		modelName = os.Getenv("AI_MODEL")
	}
	if modelName == "" {
		modelName = "GeMiNi"
	}

	return &AIExtractor{
		apiURL:    apiURL,
		apiKey:    apiKey,
		modelName: modelName,
		httpClient: &http.Client{
			Timeout: 180 * time.Second, // Resilient timeout for large multimodal documents
		},
	}
}

// ExtractionPayload matches the LLM's expected JSON output schema.
type ExtractionPayload struct {
	Titulo        string           `json:"titulo"`
	Objeto        string           `json:"objeto"`
	Orgao         string           `json:"orgao"`
	Localidade    string           `json:"localidade"`
	DataPrecoBase string           `json:"dataPrecoBase"`
	BDI           float64          `json:"bdi"`
	Itens         []ExtractionItem `json:"itens"`
}

type ExtractionItem struct {
	ItemNumero       string  `json:"itemNumero"`
	CodigoReferencia string  `json:"codigoReferencia"`
	Fonte            string  `json:"fonte"`
	Descricao        string  `json:"descricao"`
	Unidade          string  `json:"unidade"`
	Quantidade       float64 `json:"quantidade"`
	PrecoUnitario    float64 `json:"precoUnitario"`
	PrecoTotal       float64 `json:"precoTotal"`
	Confianca        float64 `json:"confianca"`
	ObservacaoIA     string  `json:"observacaoIa"`
}

// ExtractFromDocument receives binary content (PDF/image/text) and returns a normalized Orcamento.
func (e *AIExtractor) ExtractFromDocument(ctx context.Context, fileBytes []byte, mimeType, filename string) (*domain.Orcamento, error) {
	fileType := "pdf"
	if strings.Contains(mimeType, "image") || strings.HasSuffix(filename, ".png") || strings.HasSuffix(filename, ".jpg") || strings.HasSuffix(filename, ".jpeg") {
		fileType = "image"
	}

	// 1. If custom endpoint is configured, invoke OpenAI-compatible /v1/chat/completions
	if e.apiURL != "" && e.apiKey != "" {
		aiCtx, aiCancel := context.WithTimeout(context.Background(), 240*time.Second)
		defer aiCancel()

		extracted, err := e.callOpenAICompatibleEndpoint(aiCtx, fileBytes, mimeType, filename)
		if err == nil {
			if extracted == nil {
				err = fmt.Errorf("AI endpoint returned an empty payload")
			} else if len(extracted.Itens) == 0 {
				err = fmt.Errorf("AI endpoint returned no budget items")
			} else if validationErr := validateExtractionPayload(extracted); validationErr != nil {
				err = validationErr
			} else {
				return e.buildOrcamentoFromPayload(extracted, filename, fileType), nil
			}
		}
		fmt.Printf("[AI-EXTRACTOR] Endpoint %s failed (%v), activating heuristic fallback\n", e.apiURL, err)
	}

	// 2. Resilient Offline Heuristic Engine
	return e.extractHeuristicFallback(fileBytes, filename, fileType)
}

func (e *AIExtractor) callOpenAICompatibleEndpoint(ctx context.Context, fileBytes []byte, mimeType, filename string) (*ExtractionPayload, error) {
	endpoint := fmt.Sprintf("%s/chat/completions", e.apiURL)

	promptSystem := `Você é um Engenheiro Orçamentista Sênior e Especialista em Licitações Públicas de Engenharia Civil e Infraestrutura no Brasil.
Sua missão é ler e transcrever com rigor absoluto o Edital, Termo de Referência, Memorial Descritivo ou Planilha Orçamentária anexada.

Extraia todas as informações orçamentárias em formato JSON estrito:
{
  "titulo": "Título sucinto da obra ou licitação",
  "objeto": "Objeto completo da contratação",
  "orgao": "Nome do órgão licitante / prefeitura / secretaria",
  "localidade": "Cidade/UF da obra",
  "dataPrecoBase": "Base de preços (ex: SINAPI 01/2026 Não Desonerado, SICRO, SEINFRA, etc.)",
  "bdi": 0.0,
  "itens": [
    {
      "itemNumero": "1.1",
      "codigoReferencia": "88247",
      "fonte": "SINAPI",
      "descricao": "PINTURA LATEX ACRILICA EM PAREDES DUAS DEMAOS",
      "unidade": "M2",
      "quantidade": 150.0,
      "precoUnitario": 22.50,
      "precoTotal": 3375.0,
      "confianca": 0.0,
      "observacaoIa": ""
    }
  ]
}

Responda APENAS com o JSON válido. Não inclua texto explicativo fora do bloco JSON. Não presuma BDI ou confiança: use 0 quando esses dados não estiverem explícitos no documento.`

	var userContent interface{}

	// If image, send vision format
	if strings.Contains(mimeType, "image") || strings.HasSuffix(filename, ".png") || strings.HasSuffix(filename, ".jpg") || strings.HasSuffix(filename, ".jpeg") {
		if mimeType == "application/octet-stream" || mimeType == "" {
			mimeType = "image/png"
		}
		b64Data := base64.StdEncoding.EncodeToString(fileBytes)
		dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, b64Data)

		userContent = []map[string]interface{}{
			{
				"type": "text",
				"text": fmt.Sprintf("Por favor, processe esta imagem da planilha/edital (%s) e extraia todos os itens e metadados em JSON.", filename),
			},
			{
				"type": "image_url",
				"image_url": map[string]string{
					"url": dataURI,
				},
			},
		}
	} else {
		// Text or PDF content
		textSample := string(fileBytes)
		if len(textSample) > 60000 {
			textSample = textSample[:60000] // safety limit
		}
		userContent = fmt.Sprintf("Documento: %s\n\nConteúdo:\n%s\n\nPor favor, extraia todos os itens orçamentários, quantitativos e composições SINAPI.", filename, textSample)
	}

	reqBody := map[string]interface{}{
		"model":  e.modelName,
		"stream": false,
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": promptSystem,
			},
			{
				"role":    "user",
				"content": userContent,
			},
		},
		"temperature": 0.1,
	}

	bodyJSON, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to build http request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", e.apiKey))

	resp, err := e.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ai endpoint request failed: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ai endpoint returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to decode chat response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices returned by AI endpoint")
	}

	rawContent := chatResp.Choices[0].Message.Content
	cleanedJSON := extractJSONFromText(rawContent)

	var payload ExtractionPayload
	if err := json.Unmarshal([]byte(cleanedJSON), &payload); err != nil {
		return nil, fmt.Errorf("failed to parse extracted JSON payload: %w (raw: %s)", err, rawContent)
	}

	return &payload, nil
}

func extractJSONFromText(text string) string {
	text = strings.TrimSpace(text)

	// Check if markdown code block exists
	if idx := strings.Index(text, "```json"); idx != -1 {
		rest := text[idx+7:]
		if endIdx := strings.Index(rest, "```"); endIdx != -1 {
			return strings.TrimSpace(rest[:endIdx])
		}
		return strings.TrimSpace(rest)
	}

	if idx := strings.Index(text, "```"); idx != -1 {
		rest := text[idx+3:]
		if endIdx := strings.Index(rest, "```"); endIdx != -1 {
			return strings.TrimSpace(rest[:endIdx])
		}
		return strings.TrimSpace(rest)
	}

	// Look for first { and matching last }
	firstBrace := strings.Index(text, "{")
	lastBrace := strings.LastIndex(text, "}")
	if firstBrace != -1 && lastBrace != -1 && lastBrace > firstBrace {
		return text[firstBrace : lastBrace+1]
	}

	return text
}

const maxExtractionItems = 5000

func validateExtractionPayload(payload *ExtractionPayload) error {
	if payload == nil {
		return fmt.Errorf("AI payload is nil")
	}
	if len(payload.Itens) == 0 {
		return fmt.Errorf("AI payload contains no budget items")
	}
	if len(payload.Itens) > maxExtractionItems {
		return fmt.Errorf("AI payload contains too many items: %d (maximum %d)", len(payload.Itens), maxExtractionItems)
	}
	if !isFiniteNonNegative(payload.BDI) || payload.BDI > 100 {
		return fmt.Errorf("AI payload has an invalid BDI: %v", payload.BDI)
	}

	for index, item := range payload.Itens {
		if !isFiniteNonNegative(item.Quantidade) {
			return fmt.Errorf("AI payload item %d has an invalid quantity", index+1)
		}
		if !isFiniteNonNegative(item.PrecoUnitario) {
			return fmt.Errorf("AI payload item %d has an invalid unit price", index+1)
		}
		if !isFiniteNonNegative(item.PrecoTotal) {
			return fmt.Errorf("AI payload item %d has an invalid total price", index+1)
		}
		if item.Confianca < 0 || item.Confianca > 1 || math.IsNaN(item.Confianca) || math.IsInf(item.Confianca, 0) {
			return fmt.Errorf("AI payload item %d has an invalid confidence", index+1)
		}
		if !isFiniteNonNegative(item.Quantidade * item.PrecoUnitario) {
			return fmt.Errorf("AI payload item %d has an overflowing derived total", index+1)
		}
		if strings.TrimSpace(item.Descricao) == "" && strings.TrimSpace(item.Unidade) == "" && item.Quantidade == 0 && item.PrecoUnitario == 0 && item.PrecoTotal == 0 {
			return fmt.Errorf("AI payload item %d has no description, unit, or values", index+1)
		}
	}

	return nil
}

func isFiniteNonNegative(value float64) bool {
	return value >= 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}

func (e *AIExtractor) buildOrcamentoFromPayload(payload *ExtractionPayload, filename, fileType string) *domain.Orcamento {
	orcamentoID := uuid.New().String()

	orc := &domain.Orcamento{
		ID:               orcamentoID,
		Titulo:           payload.Titulo,
		Objeto:           payload.Objeto,
		Orgao:            payload.Orgao,
		Localidade:       payload.Localidade,
		DataPrecoBase:    payload.DataPrecoBase,
		BDI:              payload.BDI,
		Status:           domain.OrcamentoStatusAguardandoRevisao,
		OriginalFileName: filename,
		FileType:         fileType,
		Itens:            make([]domain.OrcamentoItem, 0, len(payload.Itens)),
	}

	if orc.Titulo == "" {
		orc.Titulo = filename
	}
	if orc.DataPrecoBase == "" {
		orc.DataPrecoBase = "SINAPI 01/2026 Não Desonerado"
	}

	for _, itemPayload := range payload.Itens {
		unitPrice := itemPayload.PrecoUnitario
		qty := itemPayload.Quantidade
		total := itemPayload.PrecoTotal
		if total == 0 && qty > 0 && unitPrice > 0 {
			total = qty * unitPrice
		}

		confianca := itemPayload.Confianca

		flagRevisao := payload.BDI <= 0 || confianca < 0.80 || itemPayload.CodigoReferencia == "" || unitPrice == 0 || qty == 0 || strings.TrimSpace(itemPayload.Descricao) == "" || strings.TrimSpace(itemPayload.Unidade) == ""

		orc.Itens = append(orc.Itens, domain.OrcamentoItem{
			ID:               uuid.New().String(),
			OrcamentoID:      orcamentoID,
			ItemNumero:       itemPayload.ItemNumero,
			CodigoReferencia: itemPayload.CodigoReferencia,
			Fonte:            itemPayload.Fonte,
			Descricao:        itemPayload.Descricao,
			Unidade:          strings.ToUpper(itemPayload.Unidade),
			Categoria:        domain.InferCategoria(itemPayload.Descricao, itemPayload.Unidade),
			Quantidade:       qty,
			PrecoUnitario:    unitPrice,
			PrecoTotal:       total,
			Confianca:        confianca,
			FlagRevisao:      flagRevisao,
			ObservacaoIA:     itemPayload.ObservacaoIA,
		})
	}

	orc.RecalculateTotals()
	return orc
}

func (e *AIExtractor) extractHeuristicFallback(fileBytes []byte, filename, fileType string) (*domain.Orcamento, error) {
	text := string(fileBytes)
	orcamentoID := uuid.New().String()

	orc := &domain.Orcamento{
		ID:               orcamentoID,
		Titulo:           fmt.Sprintf("Edital: %s", filename),
		Objeto:           "Extração automática de edital de obras públicas",
		Orgao:            "Órgão Licitante (Ceará)",
		Localidade:       "Fortaleza / CE",
		DataPrecoBase:    "SINAPI 01/2026 Não Desonerado",
		BDI:              0,
		Status:           domain.OrcamentoStatusAguardandoRevisao,
		OriginalFileName: filename,
		FileType:         fileType,
		Itens:            make([]domain.OrcamentoItem, 0),
	}

	reItem := regexp.MustCompile(`(?m)^(\d+(?:\.\d+)*)\s+(\d{4,6})?\s*(.*?)\s+(M2|M3|UN|KG|VB|M|H|HR|HORA|PC)\s+([0-9.,]+)\s+([0-9.,]+)`)
	matches := reItem.FindAllStringSubmatch(text, -1)

	if len(matches) == 0 {
		return nil, fmt.Errorf("heuristic extraction found no budget items in %q", filename)
	}

	for _, m := range matches {
		itemNum := m[1]
		code := m[2]
		desc := strings.TrimSpace(m[3])
		und := strings.ToUpper(m[4])
		qty := parseNumericVal(m[5])
		unitPrice := parseNumericVal(m[6])

		if desc == "" {
			continue
		}

		fonte := "PROPRIO"
		if len(code) >= 5 {
			fonte = "SINAPI"
		}

		orc.Itens = append(orc.Itens, domain.OrcamentoItem{
			ID:               uuid.New().String(),
			OrcamentoID:      orcamentoID,
			ItemNumero:       itemNum,
			CodigoReferencia: code,
			Fonte:            fonte,
			Descricao:        desc,
			Unidade:          und,
			Categoria:        domain.InferCategoria(desc, und),
			Quantidade:       qty,
			PrecoUnitario:    unitPrice,
			PrecoTotal:       qty * unitPrice,
			Confianca:        0,
			FlagRevisao:      true,
		})
	}

	if len(orc.Itens) == 0 {
		return nil, fmt.Errorf("heuristic extraction found no usable budget items in %q", filename)
	}

	orc.RecalculateTotals()
	return orc, nil
}

func parseNumericVal(s string) float64 {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, ",", ".")
	val, _ := strconv.ParseFloat(s, 64)
	return val
}
