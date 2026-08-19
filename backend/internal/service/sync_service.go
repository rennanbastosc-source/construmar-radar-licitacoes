package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/normalizer"
	"github.com/construmar/radar-licitacoes-backend/internal/pncp"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrSyncAlreadyRunning = errors.New("a synchronization is already in progress")
)

type SyncService struct {
	repo       *repository.OpportunityRepository
	pncpClient *pncp.Client
	mu         sync.Mutex
	isRunning  bool
	currentRun *domain.LicitacaoSyncRun
}

type PncpHealth struct {
	Status    string    `json:"status"`
	LatencyMs int64     `json:"latencyMs"`
	CheckedAt time.Time `json:"checkedAt"`
	Message   string    `json:"message"`
}

func NewSyncService(repo *repository.OpportunityRepository, pncpClient *pncp.Client) *SyncService {
	return &SyncService{
		repo:       repo,
		pncpClient: pncpClient,
	}
}

func (s *SyncService) CheckPncpHealth(ctx context.Context) PncpHealth {
	params := url.Values{}
	params.Set("uf", "CE")
	params.Set("dataFinal", time.Now().UTC().Format("2006")+"1231")
	params.Set("pagina", "1")
	params.Set("tamanhoPagina", "10")
	endpoint := fmt.Sprintf("%s/v1/contratacoes/proposta?%s", strings.TrimRight(s.pncpClient.BaseURL, "/"), params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return PncpHealth{
			Status:    "DOWN",
			LatencyMs: 0,
			CheckedAt: time.Now().UTC(),
			Message:   err.Error(),
		}
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Construmar-RadarLicitacoes/1.0")

	start := time.Now()
	client := &http.Client{
		Timeout: 15 * time.Second, // ponytail: PNCP responde em >5s, sync usa 60s; 15s é enough para health sem bloquear muito
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	latencyMs := time.Since(start).Milliseconds()
	checkedAt := time.Now().UTC()

	if resp != nil {
		if resp.Body != nil {
			_ = resp.Body.Close()
		}
		return PncpHealth{
			Status:    "UP",
			LatencyMs: latencyMs,
			CheckedAt: checkedAt,
			Message:   fmt.Sprintf("PNCP API respondendo (HTTP %d)", resp.StatusCode),
		}
	}
	if err == nil {
		err = errors.New("PNCP API não retornou resposta")
	}

	return PncpHealth{
		Status:    "DOWN",
		LatencyMs: latencyMs,
		CheckedAt: checkedAt,
		Message:   err.Error(),
	}
}

func (s *SyncService) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.isRunning
}

// cloneSyncRun deep-copies a run so shared snapshots are never aliased by live mutations.
func cloneSyncRun(run *domain.LicitacaoSyncRun) *domain.LicitacaoSyncRun {
	if run == nil {
		return nil
	}
	clone := *run
	if run.FinishedAt != nil {
		finished := *run.FinishedAt
		clone.FinishedAt = &finished
	}
	if run.ErrorMessage != nil {
		msg := *run.ErrorMessage
		clone.ErrorMessage = &msg
	}
	return &clone
}

// publishRun atomically replaces the shared snapshot with an immutable copy of run.
// The published snapshot is never mutated afterwards, so readers can hold it safely.
func (s *SyncService) publishRun(run *domain.LicitacaoSyncRun) {
	s.mu.Lock()
	s.currentRun = cloneSyncRun(run)
	s.mu.Unlock()
}

func (s *SyncService) GetCurrentRun() *domain.LicitacaoSyncRun {
	s.mu.Lock()
	defer s.mu.Unlock()
	return cloneSyncRun(s.currentRun)
}

func (s *SyncService) RunSync(ctx context.Context, uf string, minEstimatedValue float64) (*domain.LicitacaoSyncRun, error) {
	s.mu.Lock()
	if s.isRunning {
		s.mu.Unlock()
		return nil, ErrSyncAlreadyRunning
	}
	s.isRunning = true

	if uf == "" {
		uf = "CE"
	}
	if minEstimatedValue <= 0 {
		minEstimatedValue = 900000.00
	}

	correlationID := uuid.New().String()
	startTime := time.Now().UTC()

	paramsMap := map[string]interface{}{
		"uf":                uf,
		"minEstimatedValue": minEstimatedValue,
		"dataFinal":         startTime.Format("2006") + "1231",
	}
	paramsJSON, _ := json.Marshal(paramsMap)

	run := &domain.LicitacaoSyncRun{
		ID:            uuid.New().String(),
		Source:        "PNCP",
		StartedAt:     startTime,
		Status:        domain.SyncStatusRunning,
		Parameters:    string(paramsJSON),
		CorrelationID: correlationID,
	}

	s.currentRun = cloneSyncRun(run)
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.isRunning = false
		s.currentRun = nil
		s.mu.Unlock()
	}()

	if err := s.repo.CreateSyncRun(ctx, run); err != nil {
		log.Printf("[Sync] Error creating sync run record: %v", err)
	}

	log.Printf("[Sync %s] Starting PNCP synchronization for UF=%s...", correlationID, uf)

	// Fetch pages
	currentPage := 1
	pageSize := 50
	totalPages := 1
	var lastErr error
	dataFinalStr := startTime.Format("2006") + "1231"

	for currentPage <= totalPages {
		select {
		case <-ctx.Done():
			lastErr = ctx.Err()
			break
		default:
		}
		if lastErr != nil {
			break
		}

		log.Printf("[Sync %s] Fetching PNCP proposals page %d/%d...", correlationID, currentPage, totalPages)
		resp, rawJSON, err := s.pncpClient.FetchPropostas(ctx, uf, dataFinalStr, currentPage, pageSize)
		if err != nil {
			log.Printf("[Sync %s] Error fetching page %d: %v", correlationID, currentPage, err)
			run.TotalFailed++
			lastErr = err
			break
		}

		if resp.TotalPaginas > 0 {
			totalPages = resp.TotalPaginas
		}

		if len(resp.Data) == 0 {
			break
		}

		now := time.Now().UTC()
		for _, item := range resp.Data {
			run.TotalReceived++

			opp := normalizer.NormalizeContratacao(item, now)

			// Update counts
			if opp.Classification == domain.ClassificationInScope {
				run.TotalIncluded++
			} else if opp.Classification == domain.ClassificationReview {
				run.TotalReviewed++
			} else {
				run.TotalExcluded++
			}

			// Upsert opportunity into repository
			isNew, upsertErr := s.repo.UpsertOpportunity(ctx, &opp)
			if upsertErr != nil {
				log.Printf("[Sync %s] Error upserting opportunity %s: %v", correlationID, opp.SourceExternalID, upsertErr)
				run.TotalFailed++
				continue
			}

			if !isNew {
				run.TotalUpdated++
			}

			// Serialize item to JSON for snapshot
			itemBytes, marshalErr := json.Marshal(item)
			if marshalErr == nil {
				_ = s.repo.SaveSnapshot(ctx, opp.ID, "list", itemBytes)
			}
		}

		// Optional: save page raw payload snapshot
		_ = s.repo.SaveSnapshot(ctx, run.ID, "page_envelope", rawJSON)

		// Publish progress snapshot (immutable copy); readers never see in-flight mutations
		s.publishRun(run)

		currentPage++

		// Rate-limit: wait between pages to avoid PNCP 429 (limit ~16 pages/min)
		if currentPage <= totalPages {
			time.Sleep(2 * time.Second)
		}
	}

	finishTime := time.Now().UTC()
	run.FinishedAt = &finishTime

	if lastErr != nil {
		errMsg := lastErr.Error()
		run.ErrorMessage = &errMsg
		if run.TotalReceived > 0 {
			run.Status = domain.SyncStatusPartial
		} else {
			run.Status = domain.SyncStatusFailed
		}
	} else {
		run.Status = domain.SyncStatusSuccess

		// Soft delete opportunities not refreshed recently or whose deadline already passed
		// ponytail: 7-day window instead of 36h — PNCP outages would otherwise archive everything
		cutoff := startTime.Add(-168 * time.Hour)
		archivedCount, err := s.repo.SoftDeleteOldOpportunities(ctx, cutoff)
		if err == nil && archivedCount > 0 {
			log.Printf("[Sync %s] Soft-deleted (archived) %d outdated/expired opportunities.", correlationID, archivedCount)
		}
	}

	log.Printf("[Sync %s] Completed with status %s: %d received, %d included, %d reviewed, %d excluded, %d updated, %d failed",
		correlationID, run.Status, run.TotalReceived, run.TotalIncluded, run.TotalReviewed, run.TotalExcluded, run.TotalUpdated, run.TotalFailed)

	if err := s.repo.UpdateSyncRun(ctx, run); err != nil {
		log.Printf("[Sync %s] Error updating sync run record: %v", correlationID, err)
	}

	return run, lastErr
}

// RunSyncUntilComplete retries a PARTIAL sync with linear backoff so PNCP
// instability no longer leaves the radar with a tiny skewed dataset.
// ponytail: whole-sync re-run (idempotent via upsert/dedup) instead of page-level resume.
func (s *SyncService) RunSyncUntilComplete(ctx context.Context, uf string, minEstimatedValue float64, maxAttempts int, backoff time.Duration) (*domain.LicitacaoSyncRun, error) {
	var lastRun *domain.LicitacaoSyncRun
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		run, err := s.RunSync(ctx, uf, minEstimatedValue)
		if run != nil {
			lastRun, lastErr = run, err
		}

		if errors.Is(err, ErrSyncAlreadyRunning) {
			return run, err
		}
		if run == nil {
			break
		}
		if run.Status != domain.SyncStatusPartial || attempt == maxAttempts {
			break
		}

		wait := backoff * time.Duration(attempt)
		log.Printf("[Sync] Run ended PARTIAL (attempt %d/%d), retrying in %s...", attempt, maxAttempts, wait)
		select {
		case <-ctx.Done():
			return run, ctx.Err()
		case <-time.After(wait):
		}
	}

	return lastRun, lastErr
}
