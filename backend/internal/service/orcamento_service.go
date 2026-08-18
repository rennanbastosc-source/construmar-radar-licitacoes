package service

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/ai"
	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/parser"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
	"github.com/construmar/radar-licitacoes-backend/internal/seobra"
)

type OrcamentoService struct {
	repo         *repository.OrcamentoRepository
	aiExtractor  *ai.AIExtractor
	seobraClient *seobra.Client
}

func NewOrcamentoService(
	repo *repository.OrcamentoRepository,
	aiExtractor *ai.AIExtractor,
	seobraClient *seobra.Client,
) *OrcamentoService {
	return &OrcamentoService{
		repo:         repo,
		aiExtractor:  aiExtractor,
		seobraClient: seobraClient,
	}
}

// ProcessUploadedDocument ingests an uploaded file, extracts structured items and saves the budget.
func (s *OrcamentoService) ProcessUploadedDocument(
	ctx context.Context,
	fileBytes []byte,
	filename, contentType string,
	oportunidadeID *string,
) (*domain.Orcamento, error) {
	var orc *domain.Orcamento
	var err error

	lowerName := strings.ToLower(filename)
	isExcel := strings.HasSuffix(lowerName, ".xlsx") || strings.HasSuffix(lowerName, ".xls") || strings.Contains(contentType, "spreadsheet") || strings.Contains(contentType, "excel")

	if isExcel {
		orc, err = parser.ParseExcelBudget(bytes.NewReader(fileBytes), filename)
		if err != nil {
			return nil, fmt.Errorf("failed to parse excel budget: %w", err)
		}
	} else {
		orc, err = s.aiExtractor.ExtractFromDocument(ctx, fileBytes, contentType, filename)
		if err != nil {
			return nil, fmt.Errorf("failed to extract budget via AI: %w", err)
		}
	}

	if oportunidadeID != nil && *oportunidadeID != "" {
		orc.OportunidadeID = oportunidadeID
	}

	persistCtx, persistCancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer persistCancel()

	if err := s.repo.CreateOrcamento(persistCtx, orc); err != nil {
		return nil, fmt.Errorf("failed to persist extracted orcamento: %w", err)
	}

	return orc, nil
}

// GetOrcamento returns budget details with its items.
func (s *OrcamentoService) GetOrcamento(ctx context.Context, id string) (*domain.Orcamento, error) {
	return s.repo.GetOrcamentoByID(ctx, id)
}

// ListOrcamentos returns paginated budgets.
func (s *OrcamentoService) ListOrcamentos(ctx context.Context, limit, offset int) ([]domain.Orcamento, int, error) {
	return s.repo.ListOrcamentos(ctx, limit, offset)
}

// UpdateReviewedItens updates budget items after human review and recalculates totals.
func (s *OrcamentoService) UpdateReviewedItens(ctx context.Context, orc *domain.Orcamento) error {
	existing, err := s.repo.GetOrcamentoByID(ctx, orc.ID)
	if err != nil {
		return fmt.Errorf("failed to check existing orcamento: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("orcamento %s not found", orc.ID)
	}

	orc.Status = domain.OrcamentoStatusAguardandoRevisao
	return s.repo.UpdateOrcamentoItens(ctx, orc)
}

// DispatchToSeobra executes the fast synchronization to the SEOBRA platform with live progress.
func (s *OrcamentoService) DispatchToSeobra(ctx context.Context, id string) (*domain.Orcamento, error) {
	orc, err := s.repo.GetOrcamentoByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve orcamento: %w", err)
	}
	if orc == nil {
		return nil, fmt.Errorf("orcamento %s not found", id)
	}

	// Update status to processing
	_ = s.repo.UpdateOrcamentoStatus(ctx, id, domain.OrcamentoStatusDespachandoSeobra, "", "", "")
	_ = s.repo.UpdateOrcamentoProgress(ctx, id, "AUTH", 10, "Iniciando sessão exclusiva no SEOBRA...")

	progressCallback := func(step string, percent int, message string) {
		_ = s.repo.UpdateOrcamentoProgress(ctx, id, step, percent, message)
	}

	seobraID, seobraURL, err := s.seobraClient.DispatchOrcamentoWithProgress(ctx, orc, progressCallback)
	if err != nil {
		_ = s.repo.UpdateOrcamentoStatus(ctx, id, domain.OrcamentoStatusErro, err.Error(), "", "")
		_ = s.repo.UpdateOrcamentoProgress(ctx, id, "ERROR", 0, fmt.Sprintf("Erro: %s", err.Error()))
		return nil, fmt.Errorf("seobra dispatch failed: %w", err)
	}

	if err := s.repo.UpdateOrcamentoStatus(ctx, id, domain.OrcamentoStatusConcluido, "", seobraID, seobraURL); err != nil {
		return nil, fmt.Errorf("failed to update completion status: %w", err)
	}
	_ = s.repo.UpdateOrcamentoProgress(ctx, id, "COMPLETED", 100, "Orçamento concluído e liberado para acesso!")

	orc.Status = domain.OrcamentoStatusConcluido
	orc.SeobraBudgetId = seobraID
	orc.SeobraBudgetURL = seobraURL
	orc.ProgressPercent = 100
	orc.ProgressStep = "COMPLETED"
	orc.ProgressMessage = "Orçamento concluído e liberado para acesso!"
	return orc, nil
}
