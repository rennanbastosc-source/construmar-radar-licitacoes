package service

import (
	"context"
	"encoding/json"
	"errors"
	"log"
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

func NewSyncService(repo *repository.OpportunityRepository, pncpClient *pncp.Client) *SyncService {
	return &SyncService{
		repo:       repo,
		pncpClient: pncpClient,
	}
}

func (s *SyncService) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.isRunning
}

func (s *SyncService) GetCurrentRun() *domain.LicitacaoSyncRun {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.currentRun
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

	s.currentRun = run
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

		currentPage++
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
	}

	log.Printf("[Sync %s] Completed with status %s: %d received, %d included, %d reviewed, %d excluded, %d updated, %d failed",
		correlationID, run.Status, run.TotalReceived, run.TotalIncluded, run.TotalReviewed, run.TotalExcluded, run.TotalUpdated, run.TotalFailed)

	if err := s.repo.UpdateSyncRun(ctx, run); err != nil {
		log.Printf("[Sync %s] Error updating sync run record: %v", correlationID, err)
	}

	return run, lastErr
}
