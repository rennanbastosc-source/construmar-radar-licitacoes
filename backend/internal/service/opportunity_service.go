package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
)

type OpportunityService struct {
	repo *repository.OpportunityRepository
}

func NewOpportunityService(repo *repository.OpportunityRepository) *OpportunityService {
	return &OpportunityService{repo: repo}
}

func (s *OpportunityService) PingDB(ctx context.Context) error {
	return s.repo.PingDB(ctx)
}

func (s *OpportunityService) GetOpportunity(ctx context.Context, id string) (*domain.LicitacaoOportunidade, []domain.LicitacaoPayloadSnapshot, error) {
	opp, err := s.repo.GetOpportunityByID(ctx, id)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch opportunity: %w", err)
	}
	if opp == nil {
		return nil, nil, nil
	}

	snapshots, err := s.repo.GetSnapshotsByOpportunityID(ctx, id)
	if err != nil {
		snapshots = []domain.LicitacaoPayloadSnapshot{}
	}

	return opp, snapshots, nil
}

func (s *OpportunityService) ListOpportunities(ctx context.Context, filter domain.OpportunityFilter) (*domain.PaginatedOpportunities, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 25
	}

	items, total, err := s.repo.ListOpportunities(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list opportunities: %w", err)
	}

	totalPages := int(math.Ceil(float64(total) / float64(filter.PageSize)))
	hasNext := filter.Page < totalPages

	latestRun, _ := s.repo.GetLatestSyncRun(ctx, "PNCP")
	var lastSyncAt *time.Time
	syncStatus := "NEVER"
	if latestRun != nil {
		lastSyncAt = &latestRun.StartedAt
		syncStatus = latestRun.Status
	}

	return &domain.PaginatedOpportunities{
		Data: items,
		Meta: domain.OpportunityMeta{
			Page:                 filter.Page,
			PageSize:             filter.PageSize,
			Total:                total,
			TotalPages:           totalPages,
			HasNext:              hasNext,
			LastSuccessfulSyncAt: lastSyncAt,
			SyncStatus:           syncStatus,
		},
	}, nil
}

func (s *OpportunityService) GetStats(ctx context.Context, uf string, minValue float64) (*domain.StatsOverviewData, error) {
	return s.repo.GetStatsOverview(ctx, uf, minValue)
}

func (s *OpportunityService) ListSyncHistory(ctx context.Context, limit int) ([]domain.LicitacaoSyncRun, error) {
	return s.repo.ListSyncRuns(ctx, limit)
}
