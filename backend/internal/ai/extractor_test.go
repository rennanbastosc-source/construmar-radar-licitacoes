package ai

import (
	"context"
	"strings"
	"testing"
)

func TestExtractHeuristicFallbackWithoutItemsReturnsError(t *testing.T) {
	extractor := NewAIExtractor("", "", "")

	orcamento, err := extractor.ExtractFromDocument(context.Background(), []byte("documento sem itens orçamentários"), "application/pdf", "sem-itens.pdf")
	if err == nil {
		t.Fatal("expected extraction error when no budget items are found")
	}
	if orcamento != nil {
		t.Fatal("expected no budget when extraction fails")
	}
	if strings.Contains(err.Error(), "PINTURA LATEX") {
		t.Fatal("extraction error must not contain the removed fixture item")
	}
}

func TestBuildOrcamentoFromPayloadKeepsMissingConfidenceAndBDIZero(t *testing.T) {
	extractor := NewAIExtractor("", "", "")
	payload := &ExtractionPayload{
		Itens: []ExtractionItem{{
			Descricao:     "Serviço fictício de teste",
			Unidade:       "UN",
			Quantidade:    2,
			PrecoUnitario: 10,
			PrecoTotal:    20,
		}},
	}

	if err := validateExtractionPayload(payload); err != nil {
		t.Fatalf("expected payload to be valid: %v", err)
	}
	orcamento := extractor.buildOrcamentoFromPayload(payload, "teste.pdf", "pdf")

	if orcamento.BDI != 0 {
		t.Fatalf("expected missing BDI to remain zero, got %v", orcamento.BDI)
	}
	if orcamento.Itens[0].Confianca != 0 {
		t.Fatalf("expected missing confidence to remain zero, got %v", orcamento.Itens[0].Confianca)
	}
	if !orcamento.Itens[0].FlagRevisao {
		t.Fatal("expected missing confidence/BDI to require review")
	}
}
