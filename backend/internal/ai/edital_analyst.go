package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/parser"
	"github.com/google/uuid"
)

var ErrIAIndisponivel = errors.New("serviço de IA indisponível para auditoria de edital")

type EditalAIAnalyst struct {
	apiURL     string
	apiKey     string
	modelName  string
	httpClient *http.Client
}

func NewEditalAIAnalyst(apiURL, apiKey, modelName string) *EditalAIAnalyst {
	apiURL = strings.TrimRight(apiURL, "/")
	if modelName == "" {
		modelName = "GeMiNi"
	}
	return &EditalAIAnalyst{
		apiURL:    apiURL,
		apiKey:    apiKey,
		modelName: modelName,
		httpClient: &http.Client{
			Timeout: 240 * time.Second,
		},
	}
}

type EditalAnalysisPayload struct {
	Titulo                string                                  `json:"titulo"`
	Orgao                 string                                  `json:"orgao"`
	NumeroEdital          string                                  `json:"numeroEdital"`
	NumeroProcesso        string                                  `json:"numeroProcesso"`
	Modalidade            string                                  `json:"modalidade"`
	ModoDisputa           string                                  `json:"modoDisputa"`
	ObjetoCompleto        string                                  `json:"objetoCompleto"`
	Localidade            string                                  `json:"localidade"`
	DataAbertura          string                                  `json:"dataAbertura"`
	ValorEstimado         float64                                 `json:"valorEstimado"`
	BDIMaximoPermitido    *float64                                `json:"bdiMaximoPermitido"`
	PrazoExecucao         string                                  `json:"prazoExecucao"`
	RegimeExecucao        string                                  `json:"regimeExecucao"`
	ResumoExecutivo       string                                  `json:"resumoExecutivo"`
	ParecerTecnico        string                                  `json:"parecerTecnico"`
	ScoreAderencia        float64                                 `json:"scoreAderencia"`
	Pegadinhas            []domain.EditalPegadinha                `json:"pegadinhas"`
	QualificacoesTecnicas []domain.EditalQualificacaoTecnica      `json:"qualificacoesTecnicas"`
	RequisitosHabilitacao []domain.EditalRequisitoHabilitacao     `json:"requisitosHabilitacao"`
	ChecklistDocumentos   []domain.EditalChecklistItem            `json:"checklistDocumentos"`
	IndicesFinanceiros    []domain.EditalIndiceFinanceiro         `json:"indicesFinanceiros"`
}

type DocumentInput struct {
	Bytes    []byte
	MimeType string
	Filename string
}

// AnalyzeMultipleEditalDocuments ingests multiple edital files (e.g. Edital + TR + Anexo de Qualificação + Minuta de Contrato),
// fuses them into a coherent single line of reasoning, links cross-document clauses, and returns a consolidated analysis.
func (a *EditalAIAnalyst) AnalyzeMultipleEditalDocuments(ctx context.Context, docs []DocumentInput) (*domain.EditalAnalysis, error) {
	if len(docs) == 0 {
		return nil, fmt.Errorf("no documents provided for analysis")
	}
	if len(docs) == 1 {
		return a.AnalyzeEditalDocument(ctx, docs[0].Bytes, docs[0].MimeType, docs[0].Filename)
	}
	if a.apiURL == "" || a.apiKey == "" {
		return nil, fmt.Errorf("%w: API de IA não configurada", ErrIAIndisponivel)
	}

	analysisID := uuid.New().String()
	var fusedText strings.Builder
	totalCombinedPages := 0
	filenames := make([]string, 0, len(docs))
	fileTypes := make([]string, 0, len(docs))

	for idx, doc := range docs {
		filenames = append(filenames, doc.Filename)
		fileType := "pdf"
		if strings.Contains(doc.MimeType, "image") || strings.HasSuffix(doc.Filename, ".png") || strings.HasSuffix(doc.Filename, ".jpg") || strings.HasSuffix(doc.Filename, ".jpeg") {
			fileType = "image"
		}
		fileTypes = append(fileTypes, fileType)

		var docText string
		docPages := 1
		if fileType == "pdf" {
			text, pages, err := parser.ExtractTextFromPDF(doc.Bytes)
			if err == nil && len(text) > 50 {
				docText = text
				docPages = pages
			} else if strings.Contains(string(doc.Bytes), "EDITAL") || strings.Contains(string(doc.Bytes), "CONCORRÊNCIA") || strings.Contains(string(doc.Bytes), "TERMO") {
				docText = string(doc.Bytes)
				docPages = 15
			}
		} else if strings.Contains(string(doc.Bytes), "EDITAL") || strings.Contains(string(doc.Bytes), "TERMO") {
			docText = string(doc.Bytes)
		}

		totalCombinedPages += docPages

		fusedText.WriteString(fmt.Sprintf("\n\n================================================================================\n"))
		fusedText.WriteString(fmt.Sprintf("=== DOCUMENTO %d DE %d: %s (Tipo: %s | Páginas: %d) ===\n", idx+1, len(docs), doc.Filename, fileType, docPages))
		fusedText.WriteString(fmt.Sprintf("================================================================================\n\n"))
		if docText != "" {
			fusedText.WriteString(docText)
		} else {
			fusedText.WriteString(fmt.Sprintf("[Conteúdo binário escaneado / imagem estruturada de %s (%d bytes)]\n", doc.Filename, len(doc.Bytes)))
		}
	}

	consolidatedFilename := strings.Join(filenames, " + ")
	consolidatedFileType := "multi-pdf"
	combinedTextStr := fusedText.String()

	aiCtx, aiCancel := context.WithTimeout(ctx, 240*time.Second)
	defer aiCancel()

	payload, err := a.callEditalLLMEndpoint(aiCtx, docs[0].Bytes, docs[0].MimeType, consolidatedFilename, combinedTextStr)
	if err != nil {
		log.Printf("[EDITAL-ANALYST] falha no endpoint LLM: %v", err)
		return nil, fmt.Errorf("%w: %v", ErrIAIndisponivel, err)
	}
	if payload == nil {
		err = errors.New("endpoint LLM retornou resposta vazia")
		log.Printf("[EDITAL-ANALYST] falha no endpoint LLM: %v", err)
		return nil, fmt.Errorf("%w: %v", ErrIAIndisponivel, err)
	}

	analysis := a.buildEditalAnalysisFromPayload(analysisID, payload, consolidatedFilename, consolidatedFileType, totalCombinedPages)
	analysis.ResumoExecutivo = fmt.Sprintf("[ANÁLISE MULTIDOCUMENTAL CONSOLIDADA - %d ARQUIVOS: %s]\n%s", len(docs), consolidatedFilename, analysis.ResumoExecutivo)
	return analysis, nil
}

// AnalyzeEditalDocument ingests document bytes, runs full parsing and sends prompt to LLM.
func (a *EditalAIAnalyst) AnalyzeEditalDocument(ctx context.Context, fileBytes []byte, mimeType, filename string) (*domain.EditalAnalysis, error) {
	if a.apiURL == "" || a.apiKey == "" {
		return nil, fmt.Errorf("%w: API de IA não configurada", ErrIAIndisponivel)
	}

	analysisID := uuid.New().String()
	fileType := "pdf"
	if strings.Contains(mimeType, "image") || strings.HasSuffix(filename, ".png") || strings.HasSuffix(filename, ".jpg") || strings.HasSuffix(filename, ".jpeg") {
		fileType = "image"
	}

	var extractedText string
	var totalPages int

	if fileType == "pdf" {
		text, pages, err := parser.ExtractTextFromPDF(fileBytes)
		if err == nil && len(text) > 50 {
			extractedText = text
			totalPages = pages
		} else if strings.Contains(string(fileBytes), "EDITAL") || strings.Contains(string(fileBytes), "CONCORRÊNCIA") {
			extractedText = string(fileBytes)
			totalPages = 20
		}
	} else if strings.Contains(string(fileBytes), "EDITAL") {
		extractedText = string(fileBytes)
	}

	aiCtx, aiCancel := context.WithTimeout(ctx, 240*time.Second)
	defer aiCancel()

	payload, err := a.callEditalLLMEndpoint(aiCtx, fileBytes, mimeType, filename, extractedText)
	if err != nil {
		log.Printf("[EDITAL-ANALYST] falha no endpoint LLM: %v", err)
		return nil, fmt.Errorf("%w: %v", ErrIAIndisponivel, err)
	}
	if payload == nil {
		err = errors.New("endpoint LLM retornou resposta vazia")
		log.Printf("[EDITAL-ANALYST] falha no endpoint LLM: %v", err)
		return nil, fmt.Errorf("%w: %v", ErrIAIndisponivel, err)
	}

	return a.buildEditalAnalysisFromPayload(analysisID, payload, filename, fileType, totalPages), nil
}

func (a *EditalAIAnalyst) callEditalLLMEndpoint(ctx context.Context, fileBytes []byte, mimeType, filename, extractedText string) (*EditalAnalysisPayload, error) {
	endpoint := fmt.Sprintf("%s/chat/completions", a.apiURL)

	promptSystem := `Você é um Engenheiro Orçamentista Sênior e Advogado Especialista em Licitações Públicas no Brasil (Leis 14.133/2021 e 8.666/93) da CONSTRUMAR.
Sua missão é atuar como um AUDITOR E ANALISTA CRÍTICO do Edital / Termo de Referência da Licitação.

DIRETRIZ OBRIGATÓRIA DE IDIOMA (RIGOR ABSOLUTO):
- TODO O TEXTO, PARECER, RECOMENDAÇÃO, TÍTULOS, DESCRIÇÕES E COMENTÁRIOS DEVEM SER ESCRITOS 100% EM PORTUGUÊS DO BRASIL (PT-BR).
- É TERMINANTEMENTE PROIBIDO USAR INGLÊS EM QUALQUER CAMPO (ex: não use "demand", "certificate", "check", "challenge", "high risk", "block").
- Emita recomendações táticas claras e assertivas em português (ex: "Risco Crítico: O item 3.10 exige certificado de pré-qualificação no município de Cariré. Providenciar certidão ou protocolar impugnação ao edital com base na Lei 14.133/2021").

Analise minuciosamente o documento e retorne um JSON ESTRITO com o seguinte formato:
{
  "titulo": "Título sucinto do edital em português",
  "orgao": "Nome do órgão licitante / prefeitura / secretaria",
  "numeroEdital": "ex: Concorrência Eletrônica nº 001/2026",
  "numeroProcesso": "ex: Processo Administrativo nº 2026/0491",
  "modalidade": "Concorrência Eletrônica / Pregão Eletrônico",
  "modoDisputa": "Aberto / Aberto e Fechado",
  "objetoCompleto": "Objeto integral da contratação em português",
  "localidade": "Município - UF",
  "dataAbertura": "Data e hora da sessão pública",
  "valorEstimado": 0.0,
  "bdiMaximoPermitido": 25.0,
  "prazoExecucao": "ex: 180 (cento e oitenta) dias",
  "regimeExecucao": "Empreitada por Preço Unitário / Empreitada Global",
  "resumoExecutivo": "Visão geral e estratégica da licitação em português claro e objetivo em 2 parágrafos",
  "parecerTecnico": "Parecer executivo detalhado em português com recomendação de participação para a diretoria",
  "scoreAderencia": 8.5,
  "pegadinhas": [
    {
      "clausula": "Item 8.3.1",
      "titulo": "Exigência de Vistoria Técnica Obrigatória ou Declaração com Prazo Rígido",
      "descricao": "Descrição clara do risco ou pegadinha em português do Brasil",
      "severidade": "CRITICA",
      "recomendacao": "Ação tática recomendada em português do Brasil",
      "impacto": "DESCLASSIFICACAO"
    }
  ],
  "qualificacoesTecnicas": [
    {
      "itemServico": "Pavimentação Asfáltica em CBUQ",
      "unidade": "M2",
      "quantidadeExigida": 25000.0,
      "parcelaMinima": "Mínimo de 50% da quantidade da planilha (12.500 m²)",
      "exigeVisitaTecnica": true,
      "aceitaDeclaracao": true,
      "observacao": "Atestado deve ser acompanhado da respectiva CAT/ART registrada no CREA."
    }
  ],
  "requisitosHabilitacao": [
    {
      "categoria": "JURIDICA",
      "documento": "Contrato Social consolidado com objeto compatível",
      "obrigatorio": true,
      "detalhes": "Atividade de engenharia civil e locação de máquinas pesadas."
    }
  ],
  "checklistDocumentos": [
    {
      "numero": 1,
      "descricao": "Proposta de Preços com Planilha Orçamentária e Composição do BDI",
      "fase": "PROPOSTA",
      "marcado": false,
      "observacao": "Assinada digitalmente pelo responsável técnico (CREA)."
    }
  ],
  "indicesFinanceiros": [
    {
      "sigla": "LG",
      "nome": "Liquidez Geral",
      "valorMinimo": ">= 1.00",
      "formula": "(AC + RLP) / (PC + ELP)",
      "observacao": "Comprovado através do Balanço Patrimonial do último exercício."
    }
  ]
}

Responda APENAS com o JSON válido, 100% em Português (PT-BR). Não inclua texto em inglês nem fora do bloco JSON.`

	var userContent interface{}

	if extractedText != "" {
		textSample := extractedText
		if len(textSample) > 80000 {
			textSample = textSample[:80000]
		}
		userContent = fmt.Sprintf("Edital: %s\n\nTexto Integral Extraído:\n%s\n\nPor favor, faça a auditoria completa, identifique pegadinhas, atestados exigidos, índices contábeis e gere o checklist.", filename, textSample)
	} else {
		b64Data := base64.StdEncoding.EncodeToString(fileBytes)
		if mimeType == "" || mimeType == "application/octet-stream" {
			mimeType = "application/pdf"
		}
		dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, b64Data)

		userContent = []map[string]interface{}{
			{
				"type": "text",
				"text": fmt.Sprintf("Por favor, analise este arquivo de edital (%s) e extraia todos os requisitos de habilitação, atestados mínimos e pegadinhas.", filename),
			},
			{
				"type": "image_url",
				"image_url": map[string]string{
					"url": dataURI,
				},
			},
		}
	}

	reqBody := map[string]interface{}{
		"model":  a.modelName,
		"stream": false,
		"messages": []map[string]interface{}{
			{"role": "system", "content": promptSystem},
			{"role": "user", "content": userContent},
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
	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", a.apiKey))

	resp, err := a.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("edital ai request failed: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("edital ai endpoint returned status %d: %s", resp.StatusCode, string(respBytes))
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
		return nil, fmt.Errorf("no choices returned by edital AI endpoint")
	}

	rawContent := chatResp.Choices[0].Message.Content
	cleanedJSON := extractJSONFromText(rawContent)

	var payload EditalAnalysisPayload
	if err := json.Unmarshal([]byte(cleanedJSON), &payload); err != nil {
		return nil, fmt.Errorf("failed to parse edital JSON: %w (raw: %s)", err, rawContent)
	}

	return &payload, nil
}

func sanitizePTBR(s string) string {
	if s == "" {
		return ""
	}
	replacements := map[string]string{
		"High risk":                 "Alto risco",
		"high risk":                 "alto risco",
		"No certificate mean block": "A ausência de certidão implica inabilitação",
		"demand":                    "exige",
		"demand ":                   "exige ",
		"demand valid":              "exige válido",
		"certificate":               "certidão/atestado",
		"Check certificate status":  "Verificar situação da certidão",
		"Challenge edital if empty": "Impugnar o edital caso não possua",
		"Challenge rule via":        "Impugnar exigência com base na",
		"Check certificate":         "Verificar certidão",
		"if empty":                  "caso ausente",
		"Habilitation happen in prior process": "A habilitação ocorre em processo prévio",
		"adjusted proposal":         "proposta readequada",
		"sheets":                    "planilhas",
		"schedule":                  "cronograma",
		"in 2 hours":                "em 2 horas",
		"Keep sheets ready":         "Manter planilhas prontas",
		"Adjust fast":               "Ajustar rapidamente",
	}

	res := s
	for en, pt := range replacements {
		res = strings.ReplaceAll(res, en, pt)
	}
	return res
}

func (a *EditalAIAnalyst) buildEditalAnalysisFromPayload(
	id string,
	p *EditalAnalysisPayload,
	filename, fileType string,
	totalPages int,
) *domain.EditalAnalysis {
	now := time.Now()
	analysis := &domain.EditalAnalysis{
		ID:                 id,
		Titulo:             sanitizePTBR(p.Titulo),
		Orgao:              sanitizePTBR(p.Orgao),
		NumeroEdital:       sanitizePTBR(p.NumeroEdital),
		NumeroProcesso:     sanitizePTBR(p.NumeroProcesso),
		Modalidade:         sanitizePTBR(p.Modalidade),
		ModoDisputa:        sanitizePTBR(p.ModoDisputa),
		ObjetoCompleto:     sanitizePTBR(p.ObjetoCompleto),
		Localidade:         sanitizePTBR(p.Localidade),
		DataAbertura:       p.DataAbertura,
		ValorEstimado:      p.ValorEstimado,
		BDIMaximoPermitido: p.BDIMaximoPermitido,
		PrazoExecucao:      sanitizePTBR(p.PrazoExecucao),
		RegimeExecucao:     sanitizePTBR(p.RegimeExecucao),
		Status:             domain.EditalStatusConcluido,
		OriginalFileName:   filename,
		FileType:           fileType,
		TotalPaginas:       totalPages,
		ResumoExecutivo:    sanitizePTBR(p.ResumoExecutivo),
		ParecerTecnico:     sanitizePTBR(p.ParecerTecnico),
		ScoreAderencia:     p.ScoreAderencia,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	for _, item := range p.Pegadinhas {
		item.ID = uuid.New().String()
		item.AnalysisID = id
		item.Titulo = sanitizePTBR(item.Titulo)
		item.Descricao = sanitizePTBR(item.Descricao)
		item.Recomendacao = sanitizePTBR(item.Recomendacao)
		analysis.Pegadinhas = append(analysis.Pegadinhas, item)
	}

	for _, item := range p.QualificacoesTecnicas {
		item.ID = uuid.New().String()
		item.AnalysisID = id
		item.ItemServico = sanitizePTBR(item.ItemServico)
		item.ParcelaMinima = sanitizePTBR(item.ParcelaMinima)
		item.Observacao = sanitizePTBR(item.Observacao)
		analysis.QualificacoesTecnicas = append(analysis.QualificacoesTecnicas, item)
	}

	for _, item := range p.RequisitosHabilitacao {
		item.ID = uuid.New().String()
		item.AnalysisID = id
		item.Documento = sanitizePTBR(item.Documento)
		item.Detalhes = sanitizePTBR(item.Detalhes)
		analysis.RequisitosHabilitacao = append(analysis.RequisitosHabilitacao, item)
	}

	for idx, item := range p.ChecklistDocumentos {
		item.ID = uuid.New().String()
		item.AnalysisID = id
		if item.Numero == 0 {
			item.Numero = idx + 1
		}
		item.Descricao = sanitizePTBR(item.Descricao)
		item.Observacao = sanitizePTBR(item.Observacao)
		analysis.ChecklistDocumentos = append(analysis.ChecklistDocumentos, item)
	}

	for _, item := range p.IndicesFinanceiros {
		item.ID = uuid.New().String()
		item.AnalysisID = id
		item.Nome = sanitizePTBR(item.Nome)
		item.Observacao = sanitizePTBR(item.Observacao)
		analysis.IndicesFinanceiros = append(analysis.IndicesFinanceiros, item)
	}

	return analysis
}
