package classifier

import (
	"testing"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
)

func TestClassifyObject(t *testing.T) {
	tests := []struct {
		name           string
		object         string
		complement     string
		expectedStatus string
	}{
		{
			name:           "Clear Civil Construction",
			object:         "CONTRATAÇÃO DE EMPRESA DE ENGENHARIA PARA CONSTRUÇÃO DE UMA ESCOLA DE 12 SALAS NO MUNICÍPIO",
			complement:     "",
			expectedStatus: domain.ClassificationInScope,
		},
		{
			name:           "Road Paving and Drainage",
			object:         "SERVIÇOS DE PAVIMENTAÇÃO ASFÁLTICA E DRENAGEM DE ÁGUAS PLUVIAIS",
			complement:     "Execução em diversas ruas da sede municipal.",
			expectedStatus: domain.ClassificationInScope,
		},
		{
			name:           "Building Renovation",
			object:         "REFORMA E AMPLIAÇÃO DO HOSPITAL MUNICIPAL COM RESTAURAÇÃO PREDIAL",
			complement:     "",
			expectedStatus: domain.ClassificationInScope,
		},
		{
			name:           "Excluded - Vehicle and Fuel Acquisition",
			object:         "AQUISIÇÃO DE COMBUSTÍVEL DIESEL E GASOLINA PARA VEÍCULOS DA FROTA",
			complement:     "",
			expectedStatus: domain.ClassificationOutOfScope,
		},
		{
			name:           "Excluded - Software and Food",
			object:         "CREDENCIAMENTO PARA FORNECIMENTO DE AUXÍLIO ALIMENTAÇÃO E LICENÇA DE SOFTWARE",
			complement:     "",
			expectedStatus: domain.ClassificationOutOfScope,
		},
		{
			name:           "Review - Minor Maintenance and Signage",
			object:         "SERVIÇOS CONTINUADOS DE SINALIZAÇÃO VIÁRIA E CALÇADA",
			complement:     "",
			expectedStatus: domain.ClassificationReview,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := ClassifyObject(tt.object, tt.complement)
			if res.Classification != tt.expectedStatus {
				t.Errorf("expected classification %s, got %s (score: %f, terms: %v)",
					tt.expectedStatus, res.Classification, res.Score, res.MatchedTerms)
			}
			if res.Version != Version {
				t.Errorf("expected version %s, got %s", Version, res.Version)
			}
		})
	}
}

func TestNormalizeText(t *testing.T) {
	input := "CONSTRUÇÃO & REFORMA de Edificações Públicas — 2026!"
	expected := "construcao reforma de edificacoes publicas 2026"
	got := NormalizeText(input)
	if got != expected {
		t.Errorf("NormalizeText() = %q, want %q", got, expected)
	}
}
