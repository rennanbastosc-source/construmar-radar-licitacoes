package service

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/origin"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
)

type OpportunityService struct {
	repo           *repository.OpportunityRepository
	originResolver *origin.ReverseResolver
}

func NewOpportunityService(repo *repository.OpportunityRepository) *OpportunityService {
	return &OpportunityService{
		repo:           repo,
		originResolver: origin.NewReverseResolver(20 * time.Second),
	}
}

func NewOpportunityServiceWithResolver(repo *repository.OpportunityRepository, resolver *origin.ReverseResolver) *OpportunityService {
	return &OpportunityService{
		repo:           repo,
		originResolver: resolver,
	}
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

// GetOpportunityOrigin resolves parent platform details, search links and PNCP attachments for an opportunity.
func (s *OpportunityService) GetOpportunityOrigin(ctx context.Context, id string) (*origin.OpportunityOriginDetail, error) {
	opp, snapshots, err := s.GetOpportunity(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch opportunity for origin: %w", err)
	}
	if opp == nil {
		return nil, nil
	}

	var snapshotRaw []byte
	for _, snap := range snapshots {
		if snap.ResourceType == "list" && len(snap.RawJSON) > 0 {
			snapshotRaw = []byte(snap.RawJSON)
			break
		}
	}
	if len(snapshotRaw) == 0 && len(snapshots) > 0 {
		snapshotRaw = []byte(snapshots[0].RawJSON)
	}

	return s.originResolver.ResolveOrigin(ctx, opp, snapshotRaw)
}

// DownloadAndAuditEdital downloads the edital document and pipes it into the AI Edital Analyst.
func (s *OpportunityService) DownloadAndAuditEdital(
	ctx context.Context,
	id string,
	customDocURL string,
	editalService *EditalService,
) (*domain.EditalAnalysis, error) {
	if editalService == nil {
		return nil, fmt.Errorf("edital service not available")
	}

	originDetail, err := s.GetOpportunityOrigin(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to discover origin documents: %w", err)
	}
	if originDetail == nil {
		return nil, fmt.Errorf("opportunity not found")
	}

	targetURL := customDocURL
	targetName := ""
	if targetURL == "" {
		targetURL = originDetail.SuggestedDocumentURL
		targetName = originDetail.SuggestedDocumentName
	}

	if targetURL == "" {
		return nil, fmt.Errorf("nenhum documento de edital disponível para download nesta licitação")
	}

	fileBytes, filename, contentType, err := s.originResolver.DownloadEditalDocument(ctx, targetURL)
	if err != nil {
		return nil, fmt.Errorf("falha ao baixar documento do edital (%s): %w", targetURL, err)
	}

	if targetName != "" && !strings.HasSuffix(strings.ToLower(filename), ".pdf") {
		filename = targetName
	}

	return editalService.ProcessEditalUpload(ctx, fileBytes, filename, contentType, &id)
}
