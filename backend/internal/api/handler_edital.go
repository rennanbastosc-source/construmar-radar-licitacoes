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

// UploadAndAnalyze handles edital uploads (single or multiple PDFs/images) and triggers the AI Analyst.
func (h *EditalHandler) UploadAndAnalyze(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes*4) // Allow up to 128MB for batch uploads
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		status := http.StatusBadRequest
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			status = http.StatusRequestEntityTooLarge
		}
		http.Error(w, "File too large or invalid multipart form", status)
		return
	}

	var fileInputs []ai.DocumentInput

	// Check if 'files' (plural) was sent
	if r.MultipartForm != nil && len(r.MultipartForm.File["files"]) > 0 {
		for _, fileHeader := range r.MultipartForm.File["files"] {
			f, err := fileHeader.Open()
			if err != nil {
				continue
			}
			fBytes, err := io.ReadAll(f)
			f.Close()
			if err != nil || len(fBytes) == 0 {
				continue
			}

			ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
			cType, err := validateUploadedFile(ext, fBytes)
			if err != nil {
				cType = "application/pdf"
			}
			fileInputs = append(fileInputs, ai.DocumentInput{
				Bytes:    fBytes,
				MimeType: cType,
				Filename: fileHeader.Filename,
			})
		}
	}

	// Fallback to single 'file' field if 'files' was empty
	if len(fileInputs) == 0 {
		file, header, err := r.FormFile("file")
		if err == nil {
			defer file.Close()
			ext := strings.ToLower(filepath.Ext(header.Filename))
			fileBytes, err := io.ReadAll(file)
			if err == nil && len(fileBytes) > 0 {
				cType, _ := validateUploadedFile(ext, fileBytes)
				fileInputs = append(fileInputs, ai.DocumentInput{
					Bytes:    fileBytes,
					MimeType: cType,
					Filename: header.Filename,
				})
			}
		}
	}

	if len(fileInputs) == 0 {
		http.Error(w, "Missing 'file' or 'files' in upload form", http.StatusBadRequest)
		return
	}

	var oportID *string
	if opVal := r.FormValue("oportunidadeId"); opVal != "" {
		oportID = &opVal
	}

	var analysis *domain.EditalAnalysis
	var err error

	if len(fileInputs) == 1 {
		analysis, err = h.editalService.ProcessEditalUpload(r.Context(), fileInputs[0].Bytes, fileInputs[0].Filename, fileInputs[0].MimeType, oportID)
	} else {
		analysis, err = h.editalService.ProcessMultipleEditalUploads(r.Context(), fileInputs, oportID)
	}

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
