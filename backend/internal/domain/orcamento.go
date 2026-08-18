package domain

import (
	"time"
)

// OrcamentoStatus represents the lifecycle stages of an AI budget.
type OrcamentoStatus string

const (
	OrcamentoStatusProcessandoIA     OrcamentoStatus = "PROCESSANDO_IA"
	OrcamentoStatusAguardandoRevisao OrcamentoStatus = "AGUARDANDO_REVISAO"
	OrcamentoStatusDespachandoSeobra OrcamentoStatus = "DESPACHANDO_SEOBRA"
	OrcamentoStatusConcluido         OrcamentoStatus = "CONCLUIDO"
	OrcamentoStatusErro              OrcamentoStatus = "ERRO"
)

// Orcamento represents an AI-extracted construction budget and its SEOBRA sync metadata.
type Orcamento struct {
	ID                 string          `json:"id"`
	OportunidadeID     *string         `json:"oportunidadeId,omitempty"`
	Titulo             string          `json:"titulo"`
	Objeto             string          `json:"objeto"`
	Orgao              string          `json:"orgao"`
	Localidade         string          `json:"localidade"`
	DataPrecoBase      string          `json:"dataPrecoBase"` // ex: "SINAPI 01/2026 Não Desonerado"
	BDI                float64         `json:"bdi"`           // ex: 25.5 (%)
	Status             OrcamentoStatus `json:"status"`
	OriginalFileName   string          `json:"originalFileName"`
	FileType           string          `json:"fileType"` // "pdf", "xlsx", "image"
	ValorTotalEstimado float64         `json:"valorTotalEstimado"`
	ValorTotalComBDI   float64         `json:"valorTotalComBdi"`
	TotalItens         int             `json:"totalItens"`
	ConfiancaMedia     float64         `json:"confiancaMedia"`
	SeobraBudgetId     string          `json:"seobraBudgetId,omitempty"`
	SeobraBudgetURL    string          `json:"seobraBudgetUrl,omitempty"`
	ProgressStep       string          `json:"progressStep,omitempty"`       // "AUTH", "CREATING_HEADER", "INJECTING_ITEMS", "FINALIZING", "COMPLETED", "ERROR"
	ProgressPercent    int             `json:"progressPercent"`              // 0 to 100
	ProgressMessage    string          `json:"progressMessage,omitempty"`    // Live description for UI progress bar
	ErroMensagem       string          `json:"erroMensagem,omitempty"`
	CreatedAt          time.Time       `json:"createdAt"`
	UpdatedAt          time.Time       `json:"updatedAt"`

	// Relational items
	Itens []OrcamentoItem `json:"itens,omitempty"`
}

// OrcamentoItem represents a specific line item in the budget (service, composition, or material).
type OrcamentoItem struct {
	ID               string    `json:"id"`
	OrcamentoID      string    `json:"orcamentoId"`
	ItemNumero       string    `json:"itemNumero"`       // ex: "1.1", "1.2", "2.1"
	CodigoReferencia string    `json:"codigoReferencia"` // ex: "88247", "98520"
	Fonte            string    `json:"fonte"`            // "SINAPI", "SICRO", "SEINFRA", "PROPRIO"
	Descricao        string    `json:"descricao"`
	Unidade          string    `json:"unidade"` // "M2", "M3", "UN", "KG", "VB", "M", "HORA"
	Quantidade       float64   `json:"quantidade"`
	PrecoUnitario    float64   `json:"precoUnitario"`
	PrecoTotal       float64   `json:"precoTotal"`
	Confianca        float64   `json:"confianca"` // 0.0 to 1.0 (e.g. 0.98 = 98%)
	FlagRevisao      bool      `json:"flagRevisao"`
	ObservacaoIA     string    `json:"observacaoIa,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// SeobraSession holds persistent authenticated state for the SEOBRA worker.
type SeobraSession struct {
	ID          string    `json:"id"`
	Usuario     string    `json:"usuario"`
	URLBase     string    `json:"urlBase"`
	Cookies     string    `json:"cookies"`
	AuthToken   string    `json:"authToken,omitempty"`
	IsActive    bool      `json:"isActive"`
	UltimoPing  time.Time `json:"ultimoPing"`
	UltimoLogin time.Time `json:"ultimoLogin"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// SeobraConfig represents the runtime configuration for connecting to SEOBRA.
type SeobraConfig struct {
	URLBase     string `json:"urlBase"`
	Usuario     string `json:"usuario"`
	Senha       string `json:"senha"`
	MockMode    bool   `json:"mockMode"` // If true, simulates real SEOBRA responses with realistic latency
	TimeoutSecs int    `json:"timeoutSecs"`
}

// RecalculateTotals updates total values and average confidence for an Orcamento.
func (o *Orcamento) RecalculateTotals() {
	var total float64
	var sumConfianca float64
	o.TotalItens = len(o.Itens)

	for i := range o.Itens {
		if o.Itens[i].PrecoTotal == 0 && o.Itens[i].Quantidade > 0 && o.Itens[i].PrecoUnitario > 0 {
			o.Itens[i].PrecoTotal = o.Itens[i].Quantidade * o.Itens[i].PrecoUnitario
		}
		total += o.Itens[i].PrecoTotal
		sumConfianca += o.Itens[i].Confianca
	}

	o.ValorTotalEstimado = total
	if o.BDI > 0 {
		o.ValorTotalComBDI = total * (1.0 + (o.BDI / 100.0))
	} else {
		o.ValorTotalComBDI = total
	}

	if o.TotalItens > 0 {
		o.ConfiancaMedia = sumConfianca / float64(o.TotalItens)
	} else {
		o.ConfiancaMedia = 0
	}
}
