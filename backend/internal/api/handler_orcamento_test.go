package api

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/construmar/radar-licitacoes-backend/internal/ai"
	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
	"github.com/construmar/radar-licitacoes-backend/internal/seobra"
	"github.com/construmar/radar-licitacoes-backend/internal/service"
	"github.com/xuri/excelize/v2"
)

func TestOrcamentoAPIWorkflow(t *testing.T) {
	db, err := repository.InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	oppRepo := repository.NewOpportunityRepository(db)
	orcRepo := repository.NewOrcamentoRepository(db)
	aiExtractor := ai.NewAIExtractor("", "", "")
	seobraClient := seobra.NewClient(orcRepo)

	syncService := service.NewSyncService(oppRepo, nil)
	oppService := service.NewOpportunityService(oppRepo)
	orcService := service.NewOrcamentoService(orcRepo, aiExtractor, seobraClient)

	oppHandler := NewOpportunityHandler(oppService)
	syncHandler := NewSyncHandler(syncService, oppService)
	orcHandler := NewOrcamentoHandler(orcService, seobraClient)

	router := NewRouter(oppHandler, syncHandler, orcHandler)

	// 1. Create a dummy Excel file in memory
	f := excelize.NewFile()
	sheet := "Planilha"
	idx, _ := f.NewSheet(sheet)
	f.SetActiveSheet(idx)
	_ = f.SetCellValue(sheet, "A1", "OBRA: Construção de Praça Pública")
	_ = f.SetCellValue(sheet, "A2", "BDI: 20.00%")
	_ = f.SetCellValue(sheet, "A4", "ITEM")
	_ = f.SetCellValue(sheet, "B4", "CÓDIGO")
	_ = f.SetCellValue(sheet, "C4", "DESCRIÇÃO")
	_ = f.SetCellValue(sheet, "D4", "UND")
	_ = f.SetCellValue(sheet, "E4", "QUANT")
	_ = f.SetCellValue(sheet, "F4", "UNIT")
	_ = f.SetCellValue(sheet, "G4", "TOTAL")

	_ = f.SetCellValue(sheet, "A5", "1.1")
	_ = f.SetCellValue(sheet, "B5", "88247")
	_ = f.SetCellValue(sheet, "C5", "Pintura Acrílica")
	_ = f.SetCellValue(sheet, "D5", "m²")
	_ = f.SetCellValue(sheet, "E5", "100")
	_ = f.SetCellValue(sheet, "F5", "20.00")
	_ = f.SetCellValue(sheet, "G5", "2000.00")

	var excelBuf bytes.Buffer
	_ = f.Write(&excelBuf)

	// 2. Test Multipart Upload
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "orcamento_praca.xlsx")
	if err != nil {
		t.Fatalf("CreateFormFile failed: %v", err)
	}
	_, _ = part.Write(excelBuf.Bytes())
	_ = writer.WriteField("oportunidadeId", "opp-12345")
	_ = writer.Close()

	req := httptest.NewRequest("POST", "/api/orcamentos/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var created domain.Orcamento
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if created.ID == "" {
		t.Fatalf("expected non-empty ID")
	}
	if len(created.Itens) != 1 {
		t.Fatalf("expected 1 item, got %d", len(created.Itens))
	}
	if created.ValorTotalEstimado != 2000.0 {
		t.Errorf("expected ValorTotalEstimado 2000.0, got %f", created.ValorTotalEstimado)
	}
	if created.ValorTotalComBDI != 2400.0 {
		t.Errorf("expected ValorTotalComBDI 2400.0 (BDI 20%%), got %f", created.ValorTotalComBDI)
	}

	// 3. Test GET Detail
	reqGet := httptest.NewRequest("GET", "/api/orcamentos/"+created.ID, nil)
	recGet := httptest.NewRecorder()
	router.ServeHTTP(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("GET /api/orcamentos/{id} failed with %d: %s", recGet.Code, recGet.Body.String())
	}

	// 4. Test Update Items
	created.Itens[0].Quantidade = 150.0
	created.Itens[0].PrecoTotal = 150.0 * 20.00 // 3000.0

	updateBody, _ := json.Marshal(created)
	reqPut := httptest.NewRequest("PUT", "/api/orcamentos/"+created.ID+"/itens", bytes.NewReader(updateBody))
	reqPut.Header.Set("Content-Type", "application/json")
	recPut := httptest.NewRecorder()
	router.ServeHTTP(recPut, reqPut)

	if recPut.Code != http.StatusOK {
		t.Fatalf("PUT /api/orcamentos/{id}/itens failed with %d: %s", recPut.Code, recPut.Body.String())
	}

	var updated domain.Orcamento
	_ = json.NewDecoder(recPut.Body).Decode(&updated)
	if updated.ValorTotalEstimado != 3000.0 {
		t.Errorf("expected updated ValorTotalEstimado 3000.0, got %f", updated.ValorTotalEstimado)
	}

	// 5. Test SEOBRA Dispatch
	reqDispatch := httptest.NewRequest("POST", "/api/orcamentos/"+created.ID+"/despachar-seobra", nil)
	recDispatch := httptest.NewRecorder()
	router.ServeHTTP(recDispatch, reqDispatch)

	if recDispatch.Code != http.StatusOK {
		t.Fatalf("POST /api/orcamentos/{id}/despachar-seobra failed with %d: %s", recDispatch.Code, recDispatch.Body.String())
	}

	var dispatched domain.Orcamento
	_ = json.NewDecoder(recDispatch.Body).Decode(&dispatched)
	if dispatched.Status != domain.OrcamentoStatusConcluido {
		t.Errorf("expected status CONCLUIDO, got %s", dispatched.Status)
	}
	if dispatched.SeobraBudgetId == "" {
		t.Errorf("expected non-empty SeobraBudgetId")
	}
}
