package repository

import (
	"context"
	"testing"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/google/uuid"
)

func TestOrcamentoRepository(t *testing.T) {
	db, err := InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	repo := NewOrcamentoRepository(db)
	ctx := context.Background()

	orcamentoID := uuid.New().String()
	orc := &domain.Orcamento{
		ID:               orcamentoID,
		Titulo:           "Reforma da Escola Municipal",
		Objeto:           "Contratação de empresa de engenharia para reforma e ampliação",
		Orgao:            "Prefeitura Municipal de Sobral",
		Localidade:       "Sobral/CE",
		DataPrecoBase:    "SINAPI 01/2026 Não Desonerado",
		BDI:              25.0,
		Status:           domain.OrcamentoStatusAguardandoRevisao,
		OriginalFileName: "planilha_orcamentaria.xlsx",
		FileType:         "xlsx",
		Itens: []domain.OrcamentoItem{
			{
				ID:               uuid.New().String(),
				OrcamentoID:      orcamentoID,
				ItemNumero:       "1.1",
				CodigoReferencia: "88247",
				Fonte:            "SINAPI",
				Descricao:        "PINTURA LATEX ACRILICA EM PAREDES",
				Unidade:          "M2",
				Quantidade:       150.0,
				PrecoUnitario:    22.50,
				PrecoTotal:       3375.0,
				Confianca:        0.98,
				FlagRevisao:      false,
			},
			{
				ID:               uuid.New().String(),
				OrcamentoID:      orcamentoID,
				ItemNumero:       "1.2",
				CodigoReferencia: "98520",
				Fonte:            "SINAPI",
				Descricao:        "PISO CERAMICO ESMALTADO",
				Unidade:          "M2",
				Quantidade:       80.0,
				PrecoUnitario:    45.0,
				PrecoTotal:       3600.0,
				Confianca:        0.95,
				FlagRevisao:      false,
			},
		},
	}
	orc.RecalculateTotals()

	// 1. Test Create
	if err := repo.CreateOrcamento(ctx, orc); err != nil {
		t.Fatalf("CreateOrcamento failed: %v", err)
	}

	// 2. Test GetByID
	saved, err := repo.GetOrcamentoByID(ctx, orcamentoID)
	if err != nil {
		t.Fatalf("GetOrcamentoByID failed: %v", err)
	}
	if saved == nil {
		t.Fatalf("expected saved orcamento, got nil")
	}
	if saved.Titulo != orc.Titulo {
		t.Errorf("expected Titulo %s, got %s", orc.Titulo, saved.Titulo)
	}
	if len(saved.Itens) != 2 {
		t.Fatalf("expected 2 items, got %d", len(saved.Itens))
	}
	if saved.ValorTotalEstimado != 6975.0 {
		t.Errorf("expected ValorTotalEstimado 6975.0, got %f", saved.ValorTotalEstimado)
	}
	expectedComBDI := 6975.0 * 1.25
	if saved.ValorTotalComBDI != expectedComBDI {
		t.Errorf("expected ValorTotalComBDI %f, got %f", expectedComBDI, saved.ValorTotalComBDI)
	}

	// 3. Test Update Items
	saved.Itens[0].Quantidade = 200.0
	saved.Itens[0].PrecoTotal = 200.0 * 22.50 // 4500.0
	if err := repo.UpdateOrcamentoItens(ctx, saved); err != nil {
		t.Fatalf("UpdateOrcamentoItens failed: %v", err)
	}

	updated, err := repo.GetOrcamentoByID(ctx, orcamentoID)
	if err != nil {
		t.Fatalf("GetOrcamentoByID after update failed: %v", err)
	}
	if updated.ValorTotalEstimado != 8100.0 {
		t.Errorf("expected updated ValorTotalEstimado 8100.0, got %f", updated.ValorTotalEstimado)
	}

	// 4. Test Status Update
	if err := repo.UpdateOrcamentoStatus(ctx, orcamentoID, domain.OrcamentoStatusConcluido, "", "SEOBRA-12345", "https://seobra.com.br/orcamento/12345"); err != nil {
		t.Fatalf("UpdateOrcamentoStatus failed: %v", err)
	}

	done, err := repo.GetOrcamentoByID(ctx, orcamentoID)
	if err != nil {
		t.Fatalf("GetOrcamentoByID after status change failed: %v", err)
	}
	if done.Status != domain.OrcamentoStatusConcluido {
		t.Errorf("expected status CONCLUIDO, got %s", done.Status)
	}
	if done.SeobraBudgetId != "SEOBRA-12345" {
		t.Errorf("expected seobraBudgetId SEOBRA-12345, got %s", done.SeobraBudgetId)
	}

	// 5. Test Seobra Session
	sess := &domain.SeobraSession{
		ID:          uuid.New().String(),
		Usuario:     "engenharia@construmar.com.br",
		URLBase:     "https://app.seobra.com.br",
		Cookies:     "sessionid=xyz123; token=abc",
		IsActive:    true,
		UltimoPing:  time.Now().UTC(),
		UltimoLogin: time.Now().UTC(),
	}
	if err := repo.SaveSeobraSession(ctx, sess); err != nil {
		t.Fatalf("SaveSeobraSession failed: %v", err)
	}
	activeSess, err := repo.GetActiveSeobraSession(ctx)
	if err != nil {
		t.Fatalf("GetActiveSeobraSession failed: %v", err)
	}
	if activeSess == nil || activeSess.Cookies != sess.Cookies {
		t.Errorf("expected active session with cookies, got %+v", activeSess)
	}
}
