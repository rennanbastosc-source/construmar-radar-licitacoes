package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/service"
)

type SyncHandler struct {
	syncService *service.SyncService
	oppService  *service.OpportunityService
}

func NewSyncHandler(syncService *service.SyncService, oppService *service.OpportunityService) *SyncHandler {
	return &SyncHandler{
		syncService: syncService,
		oppService:  oppService,
	}
}

type SyncTriggerRequest struct {
	UF                string  `json:"uf"`
	MinEstimatedValue float64 `json:"minEstimatedValue"`
}

func (h *SyncHandler) TriggerSync(w http.ResponseWriter, r *http.Request) {
	if h.syncService.IsRunning() {
		writeError(w, http.StatusConflict, "SYNC_ALREADY_IN_PROGRESS", "Uma sincronização com o PNCP já está em andamento.")
		return
	}

	uf := r.URL.Query().Get("uf")
	if uf == "" {
		uf = "CE"
	}

	minValue := 900000.00
	if minStr := r.URL.Query().Get("minValue"); minStr != "" {
		if v, err := strconv.ParseFloat(minStr, 64); err == nil {
			minValue = v
		}
	}

	// Run asynchronously in background
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		_, _ = h.syncService.RunSync(bgCtx, uf, minValue)
	}()

	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"message":   "Sincronização com o PNCP iniciada com sucesso.",
		"status":    "STARTED",
		"uf":        uf,
		"startedAt": time.Now().UTC(),
	})
}

func (h *SyncHandler) GetSyncStatus(w http.ResponseWriter, r *http.Request) {
	isRunning := h.syncService.IsRunning()
	currentRun := h.syncService.GetCurrentRun()

	history, err := h.oppService.ListSyncHistory(r.Context(), 1)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao obter status de sincronização.")
		return
	}

	var latestRun interface{}
	if len(history) > 0 {
		latestRun = history[0]
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"isRunning":  isRunning,
			"currentRun": currentRun,
			"latestRun":  latestRun,
		},
	})
}

func (h *SyncHandler) ListSyncHistory(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	}

	history, err := h.oppService.ListSyncHistory(r.Context(), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao consultar histórico de sincronizações.")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data": history,
	})
}
