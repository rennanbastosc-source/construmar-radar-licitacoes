package service

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/normalizer"
	"github.com/construmar/radar-licitacoes-backend/internal/origin"
	"github.com/construmar/radar-licitacoes-backend/internal/pncp"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
)

type OpportunityService struct {
	repo           *repository.OpportunityRepository
	originResolver *origin.ReverseResolver
	pncpClient     *pncp.Client
}

func NewOpportunityService(repo *repository.OpportunityRepository) *OpportunityService {
	return &OpportunityService{
		repo:           repo,
		originResolver: origin.NewReverseResolver(20 * time.Second),
		pncpClient:     pncp.NewClient("https://pncp.gov.br/api/consulta", 20*time.Second),
	}
}

func NewOpportunityServiceWithResolver(repo *repository.OpportunityRepository, resolver *origin.ReverseResolver) *OpportunityService {
	return &OpportunityService{
		repo:           repo,
		originResolver: resolver,
		pncpClient:     pncp.NewClient("https://pncp.gov.br/api/consulta", 20*time.Second),
	}
}

func (s *OpportunityService) PingDB(ctx context.Context) error {
	return s.repo.PingDB(ctx)
}

func (s *OpportunityService) GetOpportunity(ctx context.Context, id string) (*domain.LicitacaoOportunidade, []domain.LicitacaoPayloadSnapshot, error) {
	// 1. Try by internal UUID
	opp, err := s.repo.GetOpportunityByID(ctx, id)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch opportunity: %w", err)
	}

	// 2. Try by external ID (e.g. 12359535000132-1-000035/2026)
	if opp == nil {
		opp, err = s.repo.GetOpportunityByExternalID(ctx, "PNCP", id)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to fetch opportunity by external id: %w", err)
		}
	}

	// 3. Dynamic fetch from PNCP API if id matches PNCP control number format
	if opp == nil && strings.Contains(id, "-") && strings.Contains(id, "/") {
		fetchedOpp, snapshot, fetchErr := s.fetchAndStoreFromPNCP(ctx, id)
		if fetchErr == nil && fetchedOpp != nil {
			var snaps []domain.LicitacaoPayloadSnapshot
			if snapshot != nil {
				snaps = append(snaps, *snapshot)
			}
			return fetchedOpp, snaps, nil
		}
	}

	if opp == nil {
		return nil, nil, nil
	}

	snapshots, err := s.repo.GetSnapshotsByOpportunityID(ctx, opp.ID)
	if err != nil {
		snapshots = []domain.LicitacaoPayloadSnapshot{}
	}

	return opp, snapshots, nil
}

func (s *OpportunityService) fetchAndStoreFromPNCP(ctx context.Context, externalID string) (*domain.LicitacaoOportunidade, *domain.LicitacaoPayloadSnapshot, error) {
	// Format: {cnpj}-{tipo}-{sequencial}/{ano} (e.g. 12359535000132-1-000035/2026)
	parts := strings.Split(externalID, "-")
	if len(parts) < 3 {
		return nil, nil, fmt.Errorf("invalid external ID format: %s", externalID)
	}

	cnpj := parts[0]
	subParts := strings.Split(parts[2], "/")
	if len(subParts) != 2 {
		return nil, nil, fmt.Errorf("invalid external ID sequence/year format: %s", externalID)
	}

	seqStr := strings.TrimLeft(subParts[0], "0")
	if seqStr == "" {
		seqStr = "0"
	}
	sequencial, err := strconv.Atoi(seqStr)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid sequence number: %w", err)
	}

	ano, err := strconv.Atoi(subParts[1])
	if err != nil {
		return nil, nil, fmt.Errorf("invalid purchase year: %w", err)
	}

	if s.pncpClient == nil {
		s.pncpClient = pncp.NewClient("https://pncp.gov.br/api/consulta", 20*time.Second)
	}

	dto, rawJSON, err := s.pncpClient.FetchCompraDetail(ctx, cnpj, ano, sequencial)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch purchase detail from PNCP: %w", err)
	}
	if dto == nil {
		return nil, nil, fmt.Errorf("purchase detail not found on PNCP")
	}

	opp := normalizer.NormalizeContratacao(*dto, time.Now())
	_, _, err = s.repo.UpsertOpportunity(ctx, &opp)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to upsert dynamically fetched opportunity: %w", err)
	}

	var snap *domain.LicitacaoPayloadSnapshot
	if len(rawJSON) > 0 {
		_ = s.repo.SaveSnapshot(ctx, opp.ID, "detail", rawJSON)
		snap = &domain.LicitacaoPayloadSnapshot{
			OpportunityID: opp.ID,
			ResourceType:  "detail",
			RawJSON:       string(rawJSON),
			CreatedAt:     time.Now().UTC(),
		}
	}

	return &opp, snap, nil
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

	latestRun, _ := s.repo.GetLatestSyncRunAnySource(ctx)
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

	if opp.Source == domain.SourceTCECE {
		domainDocuments, err := s.repo.GetDocumentsByOpportunityID(ctx, opp.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch TCE-CE documents: %w", err)
		}

		purchaseNumber := ""
		if opp.PurchaseNumber != nil {
			purchaseNumber = *opp.PurchaseNumber
		}
		purchaseYear := 0
		if opp.PurchaseYear != nil {
			purchaseYear = *opp.PurchaseYear
		}
		modalityName := ""
		if opp.ModalityName != nil {
			modalityName = *opp.ModalityName
		}

		platform := origin.OriginPlatformInfo{
			PlatformName:    "TCE-CE",
			PlatformCode:    origin.PlatformCode("TCE_CE"),
			OriginURL:       opp.SourceURL,
			DirectSearchURL: opp.SourceURL,
			IsDirectMatch:   true,
			BadgeColor:      "#0EA5E9",
		}
		documents := make([]origin.EditalDocumentFile, 0, len(domainDocuments))
		for _, document := range domainDocuments {
			documents = append(documents, origin.EditalDocumentFile{
				ID:             document.ID,
				Title:          document.Title,
				DocType:        document.DocType,
				URL:            document.URL,
				IsDownloadable: tceDocumentIsDownloadable(document.URL),
			})
		}

		return &origin.OpportunityOriginDetail{
			OpportunityID:        opp.ID,
			SourceExternalID:     opp.SourceExternalID,
			OrganizationName:     opp.OrganizationName,
			OrganizationCNPJ:     opp.OrganizationCNPJ,
			MunicipalityName:     opp.MunicipalityName,
			UF:                   opp.UF,
			PurchaseNumber:       purchaseNumber,
			PurchaseYear:         purchaseYear,
			ModalityName:         modalityName,
			PrimaryPlatform:      platform,
			AvailablePlatforms:   []origin.OriginPlatformInfo{platform},
			Documents:            documents,
			DirectAuditAvailable: false,
		}, nil
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

func tceDocumentIsDownloadable(rawURL string) bool {
	lowerURL := strings.ToLower(strings.TrimSpace(rawURL))
	if lowerURL == "" {
		return false
	}
	return !strings.Contains(lowerURL, "captcha") &&
		!strings.Contains(lowerURL, "recaptcha") &&
		!strings.Contains(lowerURL, "baixararquivo")
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

	oppID := originDetail.OpportunityID
	return editalService.ProcessEditalUpload(ctx, fileBytes, filename, contentType, &oppID)
}
