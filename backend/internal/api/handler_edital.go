package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/construmar/radar-licitacoes-backend/internal/service"
	"github.com/go-chi/chi/v5"
)

type EditalHandler struct {
	editalService *service.EditalService
}

func NewEditalHandler(editalService *service.EditalService) *EditalHandler {
	return &EditalHandler{
		editalService: editalService,
	}
}

// UploadAndAnalyze handles edital uploads (PDF or image) and triggers the AI Analyst.
func (h *EditalHandler) UploadAndAnalyze(w http.ResponseWriter, r *http.Request) {
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
	defer file.Close()

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

	analysis, err := h.editalService.ProcessEditalUpload(r.Context(), fileBytes, header.Filename, contentType, oportID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Edital analysis failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(analysis)
}

// GetAnalysis returns edital analysis details by ID.
func (h *EditalHandler) GetAnalysis(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Missing id parameter", http.StatusBadRequest)
		return
	}

	analysis, err := h.editalService.GetAnalysis(r.Context(), id)
	if err != nil {
		http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}
	if analysis == nil {
		http.Error(w, "Edital analysis not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(analysis)
}

// ListAnalyses returns paginated edital analyses.
func (h *EditalHandler) ListAnalyses(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	items, total, err := h.editalService.ListAnalyses(r.Context(), limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// ToggleChecklist toggles proposal submission checklist item.
func (h *EditalHandler) ToggleChecklist(w http.ResponseWriter, r *http.Request) {
	itemID := chi.URLParam(r, "itemId")
	if itemID == "" {
		http.Error(w, "Missing itemId parameter", http.StatusBadRequest)
		return
	}

	var body struct {
		Marcado bool `json:"marcado"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	if err := h.editalService.ToggleChecklistItem(r.Context(), itemID, body.Marcado); err != nil {
		http.Error(w, fmt.Sprintf("Failed to update checklist item: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}
