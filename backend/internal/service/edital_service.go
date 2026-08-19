package service

import (
	"context"
	"fmt"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/ai"
	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
)

type EditalService struct {
	repo    *repository.EditalRepository
	analyst *ai.EditalAIAnalyst
}

func NewEditalService(repo *repository.EditalRepository, analyst *ai.EditalAIAnalyst) *EditalService {
	return &EditalService{
		repo:    repo,
		analyst: analyst,
	}
}

// ProcessEditalUpload ingests a notice document (PDF or image), executes analysis and persists it.
func (s *EditalService) ProcessEditalUpload(
	ctx context.Context,
	fileBytes []byte,
	filename, contentType string,
	oportunidadeID *string,
) (*domain.EditalAnalysis, error) {
	analysis, err := s.analyst.AnalyzeEditalDocument(ctx, fileBytes, contentType, filename)
	if err != nil {
		return nil, fmt.Errorf("edital analysis failed: %w", err)
	}

	if oportunidadeID != nil && *oportunidadeID != "" {
		analysis.OportunidadeID = oportunidadeID
	}

	persistCtx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if err := s.repo.CreateAnalysis(persistCtx, analysis); err != nil {
		return nil, fmt.Errorf("failed to persist edital analysis: %w", err)
	}

	return analysis, nil
}

// GetAnalysis returns an edital analysis with all items.
func (s *EditalService) GetAnalysis(ctx context.Context, id string) (*domain.EditalAnalysis, error) {
	return s.repo.GetAnalysisByID(ctx, id)
}

// ListAnalyses returns paginated edital analyses.
func (s *EditalService) ListAnalyses(ctx context.Context, limit, offset int) ([]domain.EditalAnalysis, int, error) {
	return s.repo.ListAnalyses(ctx, limit, offset)
}

// ToggleChecklistItem toggles checkmark for proposal submission documents.
func (s *EditalService) ToggleChecklistItem(ctx context.Context, itemID string, marcado bool) error {
	return s.repo.ToggleChecklistItem(ctx, itemID, marcado)
}
