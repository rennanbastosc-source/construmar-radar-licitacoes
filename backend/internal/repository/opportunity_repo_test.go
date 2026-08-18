package repository

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
)

func TestOpportunityRepository(t *testing.T) {
	testDBPath := "./test_radar.db"
	defer os.Remove(testDBPath)

	db, err := InitDB(testDBPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	repo := NewOpportunityRepository(db)
	ctx := context.Background()
	now := time.Now().UTC()

	val := 1250000.00
	opp := &domain.LicitacaoOportunidade{
		Source:              "PNCP",
		SourceExternalID:    "07954480000179-1-008918/2026",
		OrganizationCNPJ:    "07954480000179",
		OrganizationName:    "ESTADO DO CEARA",
		UnitName:            "SECRETARIA DA INFRAESTRUTURA",
		MunicipalityName:    "Fortaleza",
		UF:                  "CE",
		StatusSource:        "Divulgada no PNCP",
		StatusNormalized:    "OPEN",
		ObjectRaw:           "OBRAS DE CONSTRUÇÃO DE VIADUTO E DRENAGEM URBANA",
		ObjectNormalized:    "obras de construcao de viaduto e drenagem urbana",
		EstimatedTotalValue: &val,
		ValueStatus:         domain.ValueStatusKnown,
		Classification:      domain.ClassificationInScope,
		ClassificationScore: 9.0,
		ClassificationTerms: []string{"obra", "construcao", "viaduto", "drenagem"},
		ClassifierVersion:   "v1.0.0",
		SourceURL:           "https://pncp.gov.br/app/editais/07954480000179/2026/8918",
		LastSeenAt:          now,
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	// 1. Insert
	isNew, err := repo.UpsertOpportunity(ctx, opp)
	if err != nil {
		t.Fatalf("UpsertOpportunity failed: %v", err)
	}
	if !isNew {
		t.Errorf("expected isNew=true for first insert")
	}

	// 2. Snapshot
	err = repo.SaveSnapshot(ctx, opp.ID, "list", []byte(`{"test": "snapshot"}`))
	if err != nil {
		t.Fatalf("SaveSnapshot failed: %v", err)
	}

	// 3. Query by ID
	fetched, err := repo.GetOpportunityByID(ctx, opp.ID)
	if err != nil {
		t.Fatalf("GetOpportunityByID failed: %v", err)
	}
	if fetched == nil || fetched.SourceExternalID != opp.SourceExternalID {
		t.Errorf("unexpected fetched opportunity: %+v", fetched)
	}

	// 4. List with filter >= 900000 and IN_SCOPE
	minV := 900000.00
	list, total, err := repo.ListOpportunities(ctx, domain.OpportunityFilter{
		UF:             "CE",
		Status:         "OPEN",
		MinValue:       &minV,
		Classification: "IN_SCOPE",
		Page:           1,
		PageSize:       10,
	})
	if err != nil {
		t.Fatalf("ListOpportunities failed: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Errorf("expected 1 opportunity in list, got total=%d, len=%d", total, len(list))
	}

	// 5. Update idempotently
	valUpdated := 1300000.00
	opp.EstimatedTotalValue = &valUpdated
	isNew2, err := repo.UpsertOpportunity(ctx, opp)
	if err != nil {
		t.Fatalf("Second UpsertOpportunity failed: %v", err)
	}
	if isNew2 {
		t.Errorf("expected isNew=false for second update")
	}

	// 6. Stats overview
	stats, err := repo.GetStatsOverview(ctx, "CE", 900000.00)
	if err != nil {
		t.Fatalf("GetStatsOverview failed: %v", err)
	}
	if stats.TotalOpportunities != 1 || stats.TotalInScope != 1 || stats.TotalEstimatedValue != 1300000.00 {
		t.Errorf("unexpected stats: %+v", stats)
	}
}

func TestListOpportunitiesValueInterval(t *testing.T) {
	testDBPath := "./test_radar_interval.db"
	defer os.Remove(testDBPath)

	db, err := InitDB(testDBPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	repo := NewOpportunityRepository(db)
	ctx := context.Background()
	now := time.Now().UTC()

	newOpportunity := func(externalID string, value float64) *domain.LicitacaoOportunidade {
		return &domain.LicitacaoOportunidade{
			Source:              "PNCP",
			SourceExternalID:    externalID,
			OrganizationCNPJ:    "07954480000179",
			OrganizationName:    "ESTADO DO CEARA",
			UnitName:            "SECRETARIA DA INFRAESTRUTURA",
			MunicipalityName:    "Fortaleza",
			UF:                  "CE",
			StatusSource:        "Divulgada no PNCP",
			StatusNormalized:    domain.StatusNormalizedOpen,
			ObjectRaw:           "OBRAS DE CONSTRUÇÃO",
			ObjectNormalized:    "obras de construcao",
			EstimatedTotalValue: &value,
			ValueStatus:         domain.ValueStatusKnown,
			Classification:      domain.ClassificationInScope,
			ClassificationScore: 1,
			ClassifierVersion:   "v1",
			SourceURL:           "https://pncp.gov.br/edital/" + externalID,
			LastSeenAt:          now,
			CreatedAt:           now,
			UpdatedAt:           now,
		}
	}

	for _, opportunity := range []*domain.LicitacaoOportunidade{
		newOpportunity("opportunity-1000000", 1000000),
		newOpportunity("opportunity-2500000", 2500000),
	} {
		if _, err := repo.UpsertOpportunity(ctx, opportunity); err != nil {
			t.Fatalf("UpsertOpportunity failed: %v", err)
		}
	}

	minValue := 900000.0
	maxValue := 2000000.0
	list, total, err := repo.ListOpportunities(ctx, domain.OpportunityFilter{
		UF:             "CE",
		Status:         domain.StatusNormalizedOpen,
		MinValue:       &minValue,
		MaxValue:       &maxValue,
		Classification: domain.ClassificationInScope,
		Page:           1,
		PageSize:       10,
	})
	if err != nil {
		t.Fatalf("ListOpportunities failed: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("expected 1 opportunity in value interval, got total=%d, len=%d", total, len(list))
	}
	if list[0].EstimatedTotalValue == nil || *list[0].EstimatedTotalValue != 1000000 {
		t.Errorf("expected opportunity valued at 1000000, got %+v", list[0].EstimatedTotalValue)
	}
}

func TestOpportunityRepositoryDeduplicatesByProcess(t *testing.T) {
	testDBPath := "./test_radar_dedup.db"
	defer os.Remove(testDBPath)

	db, err := InitDB(testDBPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	repo := NewOpportunityRepository(db)
	ctx := context.Background()
	firstUpdatedAt := time.Now().UTC().Add(-time.Hour)
	secondUpdatedAt := firstUpdatedAt.Add(time.Hour)

	newOpportunity := func(externalID string, sourceUpdatedAt time.Time) *domain.LicitacaoOportunidade {
		return &domain.LicitacaoOportunidade{
			Source:              "PNCP",
			SourceExternalID:    externalID,
			DedupKey:            "07954480000179|22001114447202473",
			OrganizationCNPJ:    "07954480000179",
			OrganizationName:    "ESTADO DO CEARA",
			UnitName:            "SECRETARIA DA INFRAESTRUTURA",
			MunicipalityName:    "Fortaleza",
			UF:                  "CE",
			StatusSource:        "Divulgada no PNCP",
			StatusNormalized:    domain.StatusNormalizedOpen,
			ObjectRaw:           "OBRAS DE CONSTRUÇÃO",
			ObjectNormalized:    "obras de construcao",
			ValueStatus:         domain.ValueStatusUnknown,
			Classification:      domain.ClassificationInScope,
			ClassificationScore: 1,
			ClassifierVersion:   "v1",
			SourceURL:           "https://pncp.gov.br/old",
			SourceUpdatedAt:     &sourceUpdatedAt,
			LastSeenAt:          sourceUpdatedAt,
			CreatedAt:           sourceUpdatedAt,
			UpdatedAt:           sourceUpdatedAt,
		}
	}

	first := newOpportunity("07954480000179-1-020427/2026", firstUpdatedAt)
	second := newOpportunity("07954480000179-1-020559/2026", secondUpdatedAt)

	if _, err := repo.UpsertOpportunity(ctx, first); err != nil {
		t.Fatalf("first UpsertOpportunity failed: %v", err)
	}
	if _, err := repo.UpsertOpportunity(ctx, second); err != nil {
		t.Fatalf("second UpsertOpportunity failed: %v", err)
	}

	list, total, err := repo.ListOpportunities(ctx, domain.OpportunityFilter{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("ListOpportunities failed: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("expected one deduplicated opportunity, got total=%d, len=%d", total, len(list))
	}
	if list[0].SourceExternalID != second.SourceExternalID {
		t.Errorf("expected newest source external ID %q, got %q", second.SourceExternalID, list[0].SourceExternalID)
	}
}

func TestUpsertBumpsLastSeenOnSkip(t *testing.T) {
	testDBPath := "./test_radar_lastseen.db"
	defer os.Remove(testDBPath)

	db, err := InitDB(testDBPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	repo := NewOpportunityRepository(db)
	ctx := context.Background()

	base := time.Now().UTC().Add(-2 * time.Hour)
	mk := func(externalID string, sourceUpdatedAt, lastSeenAt time.Time) *domain.LicitacaoOportunidade {
		return &domain.LicitacaoOportunidade{
			Source:              "PNCP",
			SourceExternalID:    externalID,
			DedupKey:            "07954480000179|22001114447202473",
			OrganizationCNPJ:    "07954480000179",
			OrganizationName:    "ESTADO DO CEARA",
			UnitName:            "SECRETARIA DA INFRAESTRUTURA",
			MunicipalityName:    "Fortaleza",
			UF:                  "CE",
			StatusSource:        "Divulgada no PNCP",
			StatusNormalized:    domain.StatusNormalizedOpen,
			ObjectRaw:           "OBRAS DE CONSTRUÇÃO",
			ObjectNormalized:    "obras de construcao",
			ValueStatus:         domain.ValueStatusUnknown,
			Classification:      domain.ClassificationInScope,
			ClassificationScore: 1,
			ClassifierVersion:   "v1",
			SourceURL:           "https://pncp.gov.br/old",
			SourceUpdatedAt:     &sourceUpdatedAt,
			LastSeenAt:          lastSeenAt,
			CreatedAt:           base,
			UpdatedAt:           base,
		}
	}

	first := mk("07954480000179-1-020427/2026", base, base)
	if _, err := repo.UpsertOpportunity(ctx, first); err != nil {
		t.Fatalf("first UpsertOpportunity failed: %v", err)
	}

	// Same content (source_updated_at not newer) but seen again later:
	// last_seen_at must be bumped even though content is skipped.
	seenAgain := mk("07954480000179-1-020427/2026", base, base.Add(time.Hour))
	if _, err := repo.UpsertOpportunity(ctx, seenAgain); err != nil {
		t.Fatalf("second UpsertOpportunity failed: %v", err)
	}

	fetched, err := repo.GetOpportunityByID(ctx, first.ID)
	if err != nil || fetched == nil {
		t.Fatalf("GetOpportunityByID failed: %v", err)
	}
	if !fetched.LastSeenAt.Equal(base.Add(time.Hour)) {
		t.Errorf("expected last_seen_at bumped to %v, got %v", base.Add(time.Hour), fetched.LastSeenAt)
	}
}
