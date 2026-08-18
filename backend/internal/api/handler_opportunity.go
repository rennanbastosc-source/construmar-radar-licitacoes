package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type OpportunityHandler struct {
	oppService *service.OpportunityService
}

func NewOpportunityHandler(oppService *service.OpportunityService) *OpportunityHandler {
	return &OpportunityHandler{oppService: oppService}
}

type APIError struct {
	Error struct {
		Code      string `json:"code"`
		Message   string `json:"message"`
		RequestID string `json:"requestId"`
	} `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	var errResp APIError
	errResp.Error.Code = code
	errResp.Error.Message = message
	errResp.Error.RequestID = uuid.New().String()
	writeJSON(w, status, errResp)
}

func (h *OpportunityHandler) ListOpportunities(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	uf := q.Get("uf")
	if uf == "" {
		uf = "CE"
	}

	status := q.Get("status")
	if status == "" {
		status = "OPEN"
	}

	var minValue *float64
	minValStr := q.Get("minValue")
	if minValStr != "" {
		if val, err := strconv.ParseFloat(minValStr, 64); err == nil {
			minValue = &val
		}
	} else {
		defaultMin := 900000.00
		minValue = &defaultMin
	}

	var maxValue *float64
	maxValStr := q.Get("maxValue")
	if maxValStr != "" {
		if val, err := strconv.ParseFloat(maxValStr, 64); err == nil {
			maxValue = &val
		}
	}

	var minScore *float64
	minScoreStr := q.Get("minScore")
	if minScoreStr != "" {
		if val, err := strconv.ParseFloat(minScoreStr, 64); err == nil {
			minScore = &val
		}
	}

	classification := q.Get("classification")
	if classification == "" {
		classification = "IN_SCOPE_AND_REVIEW"
	}

	page := 1
	if pStr := q.Get("page"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			page = p
		}
	}

	pageSize := 25
	if psStr := q.Get("pageSize"); psStr != "" {
		if ps, err := strconv.Atoi(psStr); err == nil && ps > 0 {
			pageSize = ps
		}
	}

	var deadlineFrom, deadlineTo *time.Time
	if dfStr := q.Get("deadlineFrom"); dfStr != "" {
		if t, err := time.Parse(time.RFC3339, dfStr); err == nil {
			deadlineFrom = &t
		}
	}
	if dtStr := q.Get("deadlineTo"); dtStr != "" {
		if t, err := time.Parse(time.RFC3339, dtStr); err == nil {
			deadlineTo = &t
		}
	}

	filter := domain.OpportunityFilter{
		UF:             uf,
		Status:         status,
		MinValue:       minValue,
		MaxValue:       maxValue,
		Classification: classification,
		Term:           q.Get("term"),
		MinScore:       minScore,
		Municipality:   q.Get("municipality"),
		Modality:       q.Get("modality"),
		Search:         q.Get("search"),
		DeadlineFrom:   deadlineFrom,
		DeadlineTo:     deadlineTo,
		Page:           page,
		PageSize:       pageSize,
	}

	resp, err := h.oppService.ListOpportunities(r.Context(), filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Falha ao consultar oportunidades de licitação.")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *OpportunityHandler) GetOpportunityDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "Identificador de oportunidade inválido.")
		return
	}

	opp, snapshots, err := h.oppService.GetOpportunity(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao carregar detalhes da oportunidade.")
		return
	}

	if opp == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Oportunidade de licitação não encontrada.")
		return
	}

	resp := map[string]interface{}{
		"data":      opp,
		"snapshots": snapshots,
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *OpportunityHandler) GetStatsOverview(w http.ResponseWriter, r *http.Request) {
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

	stats, err := h.oppService.GetStats(r.Context(), uf, minValue)
	if err != nil {
		log.Printf("[OpportunityHandler.GetStatsOverview Error] %v", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao calcular estatísticas do radar: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"data": stats})
}
