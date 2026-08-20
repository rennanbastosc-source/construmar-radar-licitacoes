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
	"github.com/construmar/radar-licitacoes-backend/internal/tcce"
	"github.com/google/uuid"
)

var (
	ErrSyncAlreadyRunning = errors.New("a synchronization is already in progress")
)

type SyncService struct {
	repo          *repository.OpportunityRepository
	pncpClient    *pncp.Client
	tceClient     *tcce.Client
	mu            sync.Mutex
	isRunning     bool
	currentRun    *domain.LicitacaoSyncRun
	writerMu      sync.Mutex
	tceMu         sync.Mutex
	tceRunning    bool
	currentTCERun *domain.LicitacaoSyncRun
}

type PncpHealth struct {
	Status    string    `json:"status"`
	LatencyMs int64     `json:"latencyMs"`
	CheckedAt time.Time `json:"checkedAt"`
	Message   string    `json:"message"`
}

type TceHealth struct {
	Status    string    `json:"status"`
	LatencyMs int64     `json:"latencyMs"`
	CheckedAt time.Time `json:"checkedAt"`
	Message   string    `json:"message"`
}

func NewSyncService(repo *repository.OpportunityRepository, pncpClient *pncp.Client, tceClient *tcce.Client) *SyncService {
	if tceClient == nil {
		tceClient = tcce.NewClient(30 * time.Second)
	}
	return &SyncService{
		repo:       repo,
		pncpClient: pncpClient,
		tceClient:  tceClient,
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

func (s *SyncService) CheckTceHealth(ctx context.Context) TceHealth {
	checkedAt := time.Now().UTC()
	if s.tceClient == nil {
		return TceHealth{
			Status:    "DOWN",
			CheckedAt: checkedAt,
			Message:   "cliente TCE-CE não configurado",
		}
	}

	healthCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	statusCode, latencyMs, err := s.tceClient.CheckHealth(healthCtx)
	checkedAt = time.Now().UTC()
	if err != nil {
		return TceHealth{
			Status:    "DOWN",
			LatencyMs: latencyMs,
			CheckedAt: checkedAt,
			Message:   err.Error(),
		}
	}

	if statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices {
		return TceHealth{
			Status:    "UP",
			LatencyMs: latencyMs,
			CheckedAt: checkedAt,
			Message:   fmt.Sprintf("TCE-CE API respondendo (HTTP %d)", statusCode),
		}
	}

	return TceHealth{
		Status:    "DOWN",
		LatencyMs: latencyMs,
		CheckedAt: checkedAt,
		Message:   fmt.Sprintf("TCE-CE API respondeu HTTP %d", statusCode),
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

func (s *SyncService) publishRunTCE(run *domain.LicitacaoSyncRun) {
	s.tceMu.Lock()
	s.currentTCERun = cloneSyncRun(run)
	s.tceMu.Unlock()
}

func (s *SyncService) IsTCERunning() bool {
	s.tceMu.Lock()
	defer s.tceMu.Unlock()
	return s.tceRunning
}

func (s *SyncService) GetCurrentTCERun() *domain.LicitacaoSyncRun {
	s.tceMu.Lock()
	defer s.tceMu.Unlock()
	return cloneSyncRun(s.currentTCERun)
}

func (s *SyncService) RunSync(ctx context.Context, uf string, minEstimatedValue float64) (*domain.LicitacaoSyncRun, error) {
	s.mu.Lock()
	if s.isRunning {
		s.mu.Unlock()
		return nil, ErrSyncAlreadyRunning
	}
	s.isRunning = true
	s.mu.Unlock()

	s.writerMu.Lock()
	defer s.writerMu.Unlock()

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

	s.mu.Lock()
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
			isNew, superseded, upsertErr := s.repo.UpsertOpportunity(ctx, &opp)
			if upsertErr != nil {
				log.Printf("[Sync %s] Error upserting opportunity %s: %v", correlationID, opp.SourceExternalID, upsertErr)
				run.TotalFailed++
				continue
			}
			if superseded {
				run.TotalExcluded++
				log.Printf("[Sync] item PNCP superseded por TCE-CE: %s", opp.SourceExternalID)
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
		archivedCount, err := s.repo.SoftDeleteOldOpportunities(ctx, domain.SourcePNCP, cutoff)
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

func waitWithContext(ctx context.Context, duration time.Duration) error {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (s *SyncService) RunTCESync(ctx context.Context) (*domain.LicitacaoSyncRun, error) {
	s.tceMu.Lock()
	if s.tceRunning {
		s.tceMu.Unlock()
		return nil, ErrSyncAlreadyRunning
	}
	s.tceRunning = true
	s.tceMu.Unlock()

	s.writerMu.Lock()
	defer s.writerMu.Unlock()

	startTime := time.Now().UTC()
	run := &domain.LicitacaoSyncRun{
		ID:            uuid.New().String(),
		Source:        domain.SourceTCECE,
		StartedAt:     startTime,
		Status:        domain.SyncStatusRunning,
		Parameters:    "{}",
		CorrelationID: uuid.New().String(),
	}
	s.tceMu.Lock()
	s.currentTCERun = cloneSyncRun(run)
	s.tceMu.Unlock()
	defer func() {
		s.tceMu.Lock()
		s.tceRunning = false
		s.currentTCERun = nil
		s.tceMu.Unlock()
	}()

	finishRun := func(fatalErr error) {
		finishTime := time.Now().UTC()
		run.FinishedAt = &finishTime
		if fatalErr != nil {
			errMsg := fatalErr.Error()
			run.ErrorMessage = &errMsg
		}

		switch {
		case run.TotalReceived == 0:
			run.Status = domain.SyncStatusFailed
		case fatalErr != nil || run.TotalFailed > 0:
			run.Status = domain.SyncStatusPartial
		default:
			run.Status = domain.SyncStatusSuccess
		}

		log.Printf("[Sync %s] Completed TCE-CE with status %s: %d received, %d included, %d reviewed, %d excluded, %d updated, %d failed",
			run.CorrelationID, run.Status, run.TotalReceived, run.TotalIncluded, run.TotalReviewed, run.TotalExcluded, run.TotalUpdated, run.TotalFailed)
		if s.repo != nil {
			if err := s.repo.UpdateSyncRun(ctx, run); err != nil {
				log.Printf("[Sync %s] Error updating TCE-CE sync run record: %v", run.CorrelationID, err)
			}
		}
	}

	if s.repo == nil || s.tceClient == nil {
		err := errors.New("cliente ou repositório TCE-CE não configurado")
		finishRun(err)
		return run, err
	}

	if err := s.repo.CreateSyncRun(ctx, run); err != nil {
		log.Printf("[Sync %s] Error creating TCE-CE sync run record: %v", run.CorrelationID, err)
	}

	log.Printf("[Sync %s] Starting TCE-CE synchronization...", run.CorrelationID)
	items, err := s.tceClient.FetchAbertas(ctx)
	if err != nil {
		finishRun(err)
		return run, err
	}

	var fatalErr error
	for index, item := range items {
		if index > 0 {
			if err := waitWithContext(ctx, time.Second); err != nil {
				fatalErr = err
				break
			}
		}

		run.TotalReceived++
		detail, detailErr := s.tceClient.FetchDetalhes(ctx, item.ProcID, item.LicitID)
		if detailErr != nil {
			log.Printf("[Sync %s] Error fetching TCE-CE detail %s:%s: %v", run.CorrelationID, item.ProcID, item.LicitID, detailErr)
			run.TotalFailed++
			detail = nil
		}

		now := time.Now().UTC()
		opp := normalizer.NormalizeTCE(item, detail, now)
		switch opp.Classification {
		case domain.ClassificationInScope:
			run.TotalIncluded++
		case domain.ClassificationReview:
			run.TotalReviewed++
		default:
			run.TotalExcluded++
		}

		isNew, superseded, upsertErr := s.repo.UpsertOpportunity(ctx, &opp)
		if upsertErr != nil {
			log.Printf("[Sync %s] Error upserting TCE-CE opportunity %s: %v", run.CorrelationID, opp.SourceExternalID, upsertErr)
			run.TotalFailed++
			s.publishRunTCE(run)
			continue
		}
		if !isNew || superseded {
			run.TotalUpdated++
		}

		listBytes, marshalErr := json.Marshal(item)
		if marshalErr != nil {
			log.Printf("[Sync %s] Error serializing TCE-CE list item %s: %v", run.CorrelationID, opp.SourceExternalID, marshalErr)
			run.TotalFailed++
		} else if err := s.repo.SaveSnapshot(ctx, opp.ID, "list", listBytes); err != nil {
			log.Printf("[Sync %s] Error saving TCE-CE list snapshot %s: %v", run.CorrelationID, opp.SourceExternalID, err)
			run.TotalFailed++
		}

		if detail != nil {
			detailBytes, marshalErr := json.Marshal(detail)
			if marshalErr != nil {
				log.Printf("[Sync %s] Error serializing TCE-CE detail %s: %v", run.CorrelationID, opp.SourceExternalID, marshalErr)
				run.TotalFailed++
			} else if err := s.repo.SaveSnapshot(ctx, opp.ID, "detail", detailBytes); err != nil {
				log.Printf("[Sync %s] Error saving TCE-CE detail snapshot %s: %v", run.CorrelationID, opp.SourceExternalID, err)
				run.TotalFailed++
			}

			for _, document := range opp.Documents {
				document.OpportunityID = opp.ID
				if document.CreatedAt.IsZero() {
					document.CreatedAt = now
				}
				if err := s.repo.SaveDocument(ctx, &document); err != nil {
					log.Printf("[Sync %s] Error saving TCE-CE document %s: %v", run.CorrelationID, document.URL, err)
					run.TotalFailed++
				}
			}
		}

		s.publishRunTCE(run)
	}

	if fatalErr == nil && len(items) > 0 {
		// ponytail: TCE-CE "abertas" is authoritative for openness — a listing may
		// keep past-session items (e.g. awaiting reabertura). Archive only by
		// staleness (absent from the portal list), never by deadline.
		cutoff := startTime.Add(-7 * 24 * time.Hour)
		if archivedCount, archiveErr := s.repo.SoftDeleteStaleByLastSeen(ctx, domain.SourceTCECE, cutoff); archiveErr != nil {
			log.Printf("[Sync %s] Error soft-deleting stale TCE-CE opportunities: %v", run.CorrelationID, archiveErr)
			fatalErr = archiveErr
		} else if archivedCount > 0 {
			log.Printf("[Sync %s] Soft-deleted (archived) %d stale TCE-CE opportunities.", run.CorrelationID, archivedCount)
		}
	}

	finishRun(fatalErr)
	return run, fatalErr
}

func (s *SyncService) RunTCESyncUntilComplete(ctx context.Context, maxAttempts int, backoff time.Duration) (*domain.LicitacaoSyncRun, error) {
	var lastRun *domain.LicitacaoSyncRun
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		run, err := s.RunTCESync(ctx)
		if run != nil {
			lastRun, lastErr = run, err
		}

		if errors.Is(err, ErrSyncAlreadyRunning) {
			return run, err
		}
		if run == nil {
			break
		}
		if run.Status != domain.SyncStatusPartial && run.Status != domain.SyncStatusFailed {
			break
		}
		if attempt == maxAttempts {
			break
		}

		wait := backoff * time.Duration(attempt)
		log.Printf("[Sync] TCE-CE run ended %s (attempt %d/%d), retrying in %s...", run.Status, attempt, maxAttempts, wait)
		select {
		case <-ctx.Done():
			return run, ctx.Err()
		case <-time.After(wait):
		}
	}

	return lastRun, lastErr
}

func (s *SyncService) LiveScrapeAbertas(ctx context.Context) ([]domain.LicitacaoOportunidade, error) {
	if s.tceClient == nil {
		return nil, errors.New("cliente TCE-CE não configurado")
	}

	items, err := s.tceClient.FetchAbertas(ctx)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	opportunities := make([]domain.LicitacaoOportunidade, 0, len(items))
	for _, item := range items {
		opportunities = append(opportunities, normalizer.NormalizeTCE(item, nil, now))
	}
	return opportunities, nil
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
		if run.Status != domain.SyncStatusPartial && run.Status != domain.SyncStatusFailed {
			break
		}
		if attempt == maxAttempts {
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
