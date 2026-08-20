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
	isNew, _, err := repo.UpsertOpportunity(ctx, opp)
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
	isNew2, _, err := repo.UpsertOpportunity(ctx, opp)
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
		if _, _, err := repo.UpsertOpportunity(ctx, opportunity); err != nil {
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

	if _, _, err := repo.UpsertOpportunity(ctx, first); err != nil {
		t.Fatalf("first UpsertOpportunity failed: %v", err)
	}
	if _, _, err := repo.UpsertOpportunity(ctx, second); err != nil {
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
	if _, _, err := repo.UpsertOpportunity(ctx, first); err != nil {
		t.Fatalf("first UpsertOpportunity failed: %v", err)
	}

	// Same content (source_updated_at not newer) but seen again later:
	// last_seen_at must be bumped even though content is skipped.
	seenAgain := mk("07954480000179-1-020427/2026", base, base.Add(time.Hour))
	if _, _, err := repo.UpsertOpportunity(ctx, seenAgain); err != nil {
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

func newCrossDedupOpportunity(source, externalID, municipality, number string, year int, now time.Time) *domain.LicitacaoOportunidade {
	return &domain.LicitacaoOportunidade{
		Source:            source,
		SourceExternalID:  externalID,
		CrossDedupKey:     domain.BuildCrossDedupKey(municipality, number, year),
		OrganizationName:  "PREFEITURA MUNICIPAL",
		UnitName:          "UNIDADE ADMINISTRATIVA",
		MunicipalityName:  municipality,
		UF:                "CE",
		PurchaseNumber:    &number,
		PurchaseYear:      &year,
		StatusSource:      "ABERTA",
		StatusNormalized:  domain.StatusNormalizedOpen,
		ObjectRaw:         "OBRAS DE INFRAESTRUTURA",
		ObjectNormalized:  "obras de infraestrutura",
		ValueStatus:       domain.ValueStatusUnknown,
		Classification:    domain.ClassificationInScope,
		ClassifierVersion: "v1",
		SourceURL:         "https://example.com/licitacao/" + externalID,
		LastSeenAt:        now,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
}

func TestUpsertSkipsPNCPWhenTCEAlreadyExists(t *testing.T) {
	db, err := InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	repo := NewOpportunityRepository(db)
	ctx := context.Background()
	now := time.Now().UTC()

	tceOpp := newCrossDedupOpportunity(domain.SourceTCECE, "tce-001", "Crateús", "005/2026-CE", 2026, now)
	if isNew, superseded, err := repo.UpsertOpportunity(ctx, tceOpp); err != nil || !isNew || superseded {
		t.Fatalf("unexpected TCE upsert result: isNew=%v superseded=%v err=%v", isNew, superseded, err)
	}

	pncpOpp := newCrossDedupOpportunity(domain.SourcePNCP, "pncp-001", "Crateús", "005/2026-CE", 2026, now)
	isNew, superseded, err := repo.UpsertOpportunity(ctx, pncpOpp)
	if err != nil {
		t.Fatalf("PNCP upsert failed: %v", err)
	}
	if isNew || !superseded {
		t.Fatalf("expected PNCP duplicate to be skipped, got isNew=%v superseded=%v", isNew, superseded)
	}

	var count int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM licitacao_oportunidade").Scan(&count); err != nil {
		t.Fatalf("count opportunities failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected only the TCE opportunity, got %d rows", count)
	}
}

func TestUpsertTCEArchivesExistingPNCPAndRepointsRelations(t *testing.T) {
	db, err := InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	repo := NewOpportunityRepository(db)
	ctx := context.Background()
	now := time.Now().UTC()

	pncpOpp := newCrossDedupOpportunity(domain.SourcePNCP, "pncp-002", "Fortaleza", "005/2026-CE", 2026, now)
	if isNew, _, err := repo.UpsertOpportunity(ctx, pncpOpp); err != nil || !isNew {
		t.Fatalf("unexpected PNCP upsert result: isNew=%v err=%v", isNew, err)
	}

	if _, err := db.ExecContext(ctx, `
		INSERT INTO orcamento (
			id, oportunidade_id, titulo, objeto, orgao, localidade, data_preco_base,
			status, original_file_name, file_type, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"budget-001", pncpOpp.ID, "Orçamento", "Objeto", "Órgão", "Fortaleza/CE", "2026",
		"PENDING", "edital.pdf", "pdf", now, now,
	); err != nil {
		t.Fatalf("insert orcamento failed: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		INSERT INTO edital_analysis (
			id, oportunidade_id, titulo, orgao, numero_edital, numero_processo,
			modalidade, modo_disputa, objeto_completo, localidade, data_abertura,
			prazo_execucao, regime_execucao, status, original_file_name, file_type,
			resumo_executivo, parecer_tecnico, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"analysis-001", pncpOpp.ID, "Edital", "Órgão", "005/2026-CE", "PROC-005/2026-CE",
		"CONCORRÊNCIA", "ABERTO", "Objeto", "Fortaleza/CE", "2026-01-01",
		"12 meses", "EMPREITADA", "CONCLUIDO", "edital.pdf", "pdf",
		"Resumo", "Parecer", now, now,
	); err != nil {
		t.Fatalf("insert edital analysis failed: %v", err)
	}

	tceOpp := newCrossDedupOpportunity(domain.SourceTCECE, "tce-002", "Fortaleza", "005/2026-CE", 2026, now.Add(time.Minute))
	isNew, superseded, err := repo.UpsertOpportunity(ctx, tceOpp)
	if err != nil {
		t.Fatalf("TCE upsert failed: %v", err)
	}
	if !isNew || superseded {
		t.Fatalf("unexpected TCE result: isNew=%v superseded=%v", isNew, superseded)
	}

	var archived int
	if err := db.QueryRowContext(ctx, "SELECT is_archived FROM licitacao_oportunidade WHERE id = ?", pncpOpp.ID).Scan(&archived); err != nil {
		t.Fatalf("query archived PNCP failed: %v", err)
	}
	if archived != 1 {
		t.Fatalf("expected PNCP opportunity to be archived, got %d", archived)
	}

	var opportunityID string
	if err := db.QueryRowContext(ctx, "SELECT oportunidade_id FROM orcamento WHERE id = ?", "budget-001").Scan(&opportunityID); err != nil {
		t.Fatalf("query orcamento relation failed: %v", err)
	}
	if opportunityID != tceOpp.ID {
		t.Errorf("expected orcamento to point to TCE %s, got %s", tceOpp.ID, opportunityID)
	}
	if err := db.QueryRowContext(ctx, "SELECT oportunidade_id FROM edital_analysis WHERE id = ?", "analysis-001").Scan(&opportunityID); err != nil {
		t.Fatalf("query edital analysis relation failed: %v", err)
	}
	if opportunityID != tceOpp.ID {
		t.Errorf("expected edital analysis to point to TCE %s, got %s", tceOpp.ID, opportunityID)
	}
}

func TestUpsertPNCPFallbackAfterTCEArchive(t *testing.T) {
	db, err := InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	repo := NewOpportunityRepository(db)
	ctx := context.Background()
	now := time.Now().UTC()

	tceOpp := newCrossDedupOpportunity(domain.SourceTCECE, "tce-fallback", "Itarema", "005/2026-CE", 2026, now)
	if isNew, superseded, err := repo.UpsertOpportunity(ctx, tceOpp); err != nil || !isNew || superseded {
		t.Fatalf("unexpected TCE upsert result: isNew=%v superseded=%v err=%v", isNew, superseded, err)
	}

	pncpOpp := newCrossDedupOpportunity(domain.SourcePNCP, "pncp-fallback", "Itarema", "005/2026-CE", 2026, now)
	if isNew, superseded, err := repo.UpsertOpportunity(ctx, pncpOpp); err != nil || isNew || !superseded {
		t.Fatalf("expected active TCE to supersede PNCP: isNew=%v superseded=%v err=%v", isNew, superseded, err)
	}

	archived, err := repo.SoftDeleteStaleByLastSeen(ctx, domain.SourceTCECE, now.Add(time.Minute))
	if err != nil || archived != 1 {
		t.Fatalf("expected one archived TCE opportunity, got archived=%d err=%v", archived, err)
	}

	var archivedKey string
	if err := db.QueryRowContext(ctx, "SELECT cross_dedup_key FROM licitacao_oportunidade WHERE id = ?", tceOpp.ID).Scan(&archivedKey); err != nil {
		t.Fatalf("query archived TCE key failed: %v", err)
	}
	if archivedKey != "" {
		t.Fatalf("expected archived TCE cross key to be cleared, got %q", archivedKey)
	}

	isNew, superseded, err := repo.UpsertOpportunity(ctx, pncpOpp)
	if err != nil {
		t.Fatalf("PNCP fallback upsert failed: %v", err)
	}
	if !isNew || superseded {
		t.Fatalf("expected PNCP fallback insertion, got isNew=%v superseded=%v", isNew, superseded)
	}

	var activePNCP int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM licitacao_oportunidade WHERE source = ? AND is_archived = 0", domain.SourcePNCP).Scan(&activePNCP); err != nil {
		t.Fatalf("count active PNCP opportunities failed: %v", err)
	}
	if activePNCP != 1 {
		t.Fatalf("expected one active PNCP fallback, got %d", activePNCP)
	}
}
