package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/seobra"
	"github.com/construmar/radar-licitacoes-backend/internal/service"
	"github.com/go-chi/chi/v5"
)

type OrcamentoHandler struct {
	orcamentoService *service.OrcamentoService
	seobraClient     *seobra.Client
}

const maxUploadBytes int64 = 32 << 20

var allowedUploadExtensions = map[string]struct{}{
	".pdf":  {},
	".xlsx": {},
	".png":  {},
	".jpg":  {},
	".jpeg": {},
}

func NewOrcamentoHandler(orcService *service.OrcamentoService, seobraClient *seobra.Client) *OrcamentoHandler {
	return &OrcamentoHandler{
		orcamentoService: orcService,
		seobraClient:     seobraClient,
	}
}

// UploadDocument handles file uploads (PDF, XLSX, Images), runs the extraction pipeline and returns the budget.
func (h *OrcamentoHandler) UploadDocument(w http.ResponseWriter, r *http.Request) {
	// MaxBytesReader must wrap the body before multipart parsing so the complete request is bounded.
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		status := http.StatusBadRequest
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			status = http.StatusRequestEntityTooLarge
		}
		http.Error(w, "File too large or invalid multipart form", status)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Missing 'file' form field", http.StatusBadRequest)
		return
	}
	defer func() {
		_ = file.Close()
	}()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if _, ok := allowedUploadExtensions[ext]; !ok {
		http.Error(w, "Unsupported file type", http.StatusUnsupportedMediaType)
		return
	}

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read uploaded file", http.StatusInternalServerError)
		return
	}
	if len(fileBytes) == 0 {
		http.Error(w, "Uploaded file is empty", http.StatusBadRequest)
		return
	}

	contentType, err := validateUploadedFile(ext, fileBytes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnsupportedMediaType)
		return
	}

	var oportID *string
	if opVal := r.FormValue("oportunidadeId"); opVal != "" {
		oportID = &opVal
	}

	orc, err := h.orcamentoService.ProcessUploadedDocument(r.Context(), fileBytes, header.Filename, contentType, oportID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Extraction failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(orc)
}

func validateUploadedFile(ext string, fileBytes []byte) (string, error) {
	detectedType := http.DetectContentType(fileBytes)

	switch ext {
	case ".pdf":
		if detectedType != "application/pdf" {
			return "", fmt.Errorf("file signature does not match PDF extension")
		}
	case ".xlsx":
		// XLSX is a ZIP container; DetectContentType reports application/zip.
		if len(fileBytes) < 2 || !bytes.Equal(fileBytes[:2], []byte("PK")) {
			return "", fmt.Errorf("file signature does not match XLSX extension")
		}
	case ".png":
		if detectedType != "image/png" {
			return "", fmt.Errorf("file signature does not match PNG extension")
		}
	case ".jpg", ".jpeg":
		if detectedType != "image/jpeg" {
			return "", fmt.Errorf("file signature does not match JPEG extension")
		}
	}

	return detectedType, nil
}

// GetOrcamento returns budget details and items.
func (h *OrcamentoHandler) GetOrcamento(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Missing id parameter", http.StatusBadRequest)
		return
	}

	orc, err := h.orcamentoService.GetOrcamento(r.Context(), id)
	if err != nil {
		http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}
	if orc == nil {
		http.Error(w, "Orcamento not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(orc)
}

// ListOrcamentos lists paginated budgets.
func (h *OrcamentoHandler) ListOrcamentos(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 20
	offset := 0
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	list, total, err := h.orcamentoService.ListOrcamentos(r.Context(), limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"total":  total,
		"limit":  limit,
		"offset": offset,
		"items":  list,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

// UpdateItens updates items after user makes edits in the review grid.
func (h *OrcamentoHandler) UpdateItens(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Missing id parameter", http.StatusBadRequest)
		return
	}

	var orc domain.Orcamento
	if err := json.NewDecoder(r.Body).Decode(&orc); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}
	orc.ID = id

	if err := h.orcamentoService.UpdateReviewedItens(r.Context(), &orc); err != nil {
		http.Error(w, fmt.Sprintf("Failed to update items: %v", err), http.StatusInternalServerError)
		return
	}

	updated, err := h.orcamentoService.GetOrcamento(r.Context(), id)
	if err != nil || updated == nil {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

// DespacharSeobra dispatches the reviewed budget to SEOBRA via Reverse API.
func (h *OrcamentoHandler) DespacharSeobra(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Missing id parameter", http.StatusBadRequest)
		return
	}

	orc, err := h.orcamentoService.DispatchToSeobra(r.Context(), id)
	if err != nil {
		http.Error(w, fmt.Sprintf("Dispatch failed: %v", err), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(orc)
}

// SeobraStatus returns session and connection status with SEOBRA.
func (h *OrcamentoHandler) SeobraStatus(w http.ResponseWriter, r *http.Request) {
	sess, err := h.seobraClient.EnsureActiveSession(r.Context())
	if err != nil {
		http.Error(w, fmt.Sprintf("Seobra connection error: %v", err), http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "ONLINE",
		"activeSession": sess,
	})
}

// ExportSeobraXLSX generates and downloads an Excel spreadsheet matching the exact SEOBRA import format.
func (h *OrcamentoHandler) ExportSeobraXLSX(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Missing id parameter", http.StatusBadRequest)
		return
	}

	orc, err := h.orcamentoService.GetOrcamento(r.Context(), id)
	if err != nil || orc == nil {
		http.Error(w, "Orcamento not found", http.StatusNotFound)
		return
	}

	var xlsxBytes []byte
	if orc.SeobraBudgetId != "" && !strings.HasPrefix(orc.SeobraBudgetId, "MOCK-") && h.seobraClient != nil {
		xlsxBytes, _ = h.seobraClient.DownloadPlanilha(r.Context(), orc.SeobraBudgetId)
	}
	if len(xlsxBytes) == 0 {
		orc.RecalculateTotals()
		xlsxBytes, err = seobra.GenerateSeobraExcel(orc)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to generate Excel: %v", err), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"orcamento_seobra_%s.xlsx\"", orc.ID[:8]))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(xlsxBytes)
}
