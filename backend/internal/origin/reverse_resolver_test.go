package origin_test

import (
	"context"
	"testing"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/origin"
)

func TestReverseResolver_ResolveOrigin(t *testing.T) {
	resolver := origin.NewReverseResolver(5 * time.Second)

	purchaseNumber := "90067"
	purchaseYear := 2024
	modalityName := "Pregão Eletrônico"

	opp := &domain.LicitacaoOportunidade{
		ID:               "test-opp-123",
		SourceExternalID: "06750525000120-1-000012/2024",
		OrganizationName: "PREFEITURA MUNICIPAL DE FORTALEZA",
		OrganizationCNPJ: "06750525000120",
		MunicipalityName: "Fortaleza",
		UF:               "CE",
		PurchaseNumber:   &purchaseNumber,
		PurchaseYear:     &purchaseYear,
		ModalityName:     &modalityName,
		SourceURL:        "https://pncp.gov.br/app/editais/06750525000120/2024/12",
	}

	snapshotJSON := []byte(`{
		"numeroControlePNCP": "06750525000120-1-000012/2024",
		"anoCompra": 2024,
		"sequencialCompra": 12,
		"numeroCompra": "90067",
		"processo": "01350/2024",
		"usuarioNome": "Licita + Brasil",
		"linkSistemaOrigem": "https://licitamaisbrasil.com.br/processo/12345"
	}`)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	detail, err := resolver.ResolveOrigin(ctx, opp, snapshotJSON)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if detail == nil {
		t.Fatalf("expected detail to be non-nil")
	}

	if detail.PrimaryPlatform.PlatformCode != origin.PlatformLicitamais {
		t.Errorf("expected platform LICITAMAIS, got %s", detail.PrimaryPlatform.PlatformCode)
	}

	if len(detail.AvailablePlatforms) < 2 {
		t.Errorf("expected at least 2 available platforms, got %d", len(detail.AvailablePlatforms))
	}

	// Verify BLL Compras link has Ceará state filter (fkState=6)
	var foundBLL bool
	for _, p := range detail.AvailablePlatforms {
		if p.PlatformCode == origin.PlatformBLL {
			foundBLL = true
			if p.ExtraParams["fkState"] != "6" {
				t.Errorf("expected BLL fkState to be 6 (Ceará), got %s", p.ExtraParams["fkState"])
			}
		}
	}
	if !foundBLL {
		t.Errorf("expected BLL Compras to be in available platforms")
	}
}
