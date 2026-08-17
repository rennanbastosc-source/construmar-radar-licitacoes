package normalizer

import (
	"testing"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/pncp"
)

func TestNormalizeContratacao(t *testing.T) {
	val := 1500000.0
	dto := pncp.PNCPContratacaoDTO{
		NumeroControlePNCP: "07954480000179-1-008918/2026",
		AnoCompra:          2026,
		SequencialCompra:   8918,
		NumeroCompra:       "90030",
		ObjetoCompra:       "CONTRATAÇÃO DE OBRAS DE PAVIMENTAÇÃO E DRENAGEM",
		ValorTotalEstimado: &val,
		OrgaoEntidade: pncp.PNCPEntidadeDTO{
			CNPJ:        "07954480000179",
			RazaoSocial: "ESTADO DO CEARA",
		},
		UnidadeOrgao: pncp.PNCPUnidadeDTO{
			NomeUnidade:   "SECRETARIA DE OBRAS",
			MunicipioNome: "Fortaleza",
			UFSigla:       "CE",
			CodigoIBGE:    "2304400",
		},
		ModalidadeNome:   "Concorrência - Eletrônica",
		SituacaoCompraNome: "Divulgada no PNCP",
	}

	now := time.Now().UTC()
	opp := NormalizeContratacao(dto, now)

	if opp.SourceExternalID != "07954480000179-1-008918/2026" {
		t.Errorf("unexpected external ID: %s", opp.SourceExternalID)
	}
	if opp.ValueStatus != domain.ValueStatusKnown {
		t.Errorf("expected value status KNOWN, got %s", opp.ValueStatus)
	}
	if opp.EstimatedTotalValue == nil || *opp.EstimatedTotalValue != 1500000.0 {
		t.Errorf("expected estimated value 1500000.0, got %v", opp.EstimatedTotalValue)
	}
	if opp.Classification != domain.ClassificationInScope {
		t.Errorf("expected classification IN_SCOPE, got %s", opp.Classification)
	}
	if opp.SourceURL != "https://pncp.gov.br/app/editais/07954480000179/2026/8918" {
		t.Errorf("unexpected SourceURL: %s", opp.SourceURL)
	}
}

func TestNormalizeContratacaoSigiloso(t *testing.T) {
	sigiloCode := 2
	dto := pncp.PNCPContratacaoDTO{
		NumeroControlePNCP:      "12345678000199-1-000001/2026",
		AnoCompra:               2026,
		SequencialCompra:        1,
		ObjetoCompra:            "CONSTRUÇÃO DE PRAÇA",
		OrcamentoSigilosoCodigo: &sigiloCode,
		OrgaoEntidade: pncp.PNCPEntidadeDTO{
			CNPJ:        "12345678000199",
			RazaoSocial: "PREFEITURA MUNICIPAL",
		},
		UnidadeOrgao: pncp.PNCPUnidadeDTO{
			UFSigla: "CE",
		},
	}

	opp := NormalizeContratacao(dto, time.Now())
	if opp.ValueStatus != domain.ValueStatusConfidential {
		t.Errorf("expected VALUE_CONFIDENTIAL, got %s", opp.ValueStatus)
	}
}
