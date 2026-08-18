package normalizer

import (
	"fmt"
	"strings"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/classifier"
	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/pncp"
	"github.com/google/uuid"
)

var spLocation *time.Location

func init() {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*60*60)
	}
	spLocation = loc
}

// ParsePNCPDate parses date strings from PNCP in Brasilia timezone.
func ParsePNCPDate(dateStr *string) *time.Time {
	if dateStr == nil || strings.TrimSpace(*dateStr) == "" {
		return nil
	}

	cleanStr := strings.TrimSpace(*dateStr)
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05.000",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}

	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, cleanStr, spLocation); err == nil {
			utc := t.UTC()
			return &utc
		}
	}

	return nil
}

// NormalizeContratacao converts a PNCP DTO into domain.LicitacaoOportunidade.
func NormalizeContratacao(dto pncp.PNCPContratacaoDTO, now time.Time) domain.LicitacaoOportunidade {
	// 1. Evaluate Value Status
	var valStatus string
	var estValue *float64

	isSigiloso := (dto.OrcamentoSigilosoCodigo != nil && *dto.OrcamentoSigilosoCodigo == 2)

	if isSigiloso {
		valStatus = domain.ValueStatusConfidential
		if dto.ValorTotalEstimado != nil && *dto.ValorTotalEstimado > 0 {
			estValue = dto.ValorTotalEstimado
		}
	} else if dto.ValorTotalEstimado == nil || *dto.ValorTotalEstimado <= 0 {
		valStatus = domain.ValueStatusUnknown
	} else {
		valStatus = domain.ValueStatusKnown
		estValue = dto.ValorTotalEstimado
	}

	// 2. Classify Object
	complement := ""
	if dto.InformacaoComplementar != nil {
		complement = *dto.InformacaoComplementar
	}
	classResult := classifier.ClassifyObject(dto.ObjetoCompra, complement)

	// 3. Parse Dates
	proposalStart := ParsePNCPDate(dto.DataAberturaProposta)
	proposalEnd := ParsePNCPDate(dto.DataEncerramentoProposta)
	publishedAt := ParsePNCPDate(dto.DataPublicacaoPncp)
	sourceUpdated := ParsePNCPDate(dto.DataAtualizacao)
	if sourceUpdated == nil {
		sourceUpdated = ParsePNCPDate(dto.DataAtualizacaoGlobal)
	}

	// 4. Status Normalized
	statusNorm := domain.StatusNormalizedOpen
	if proposalEnd != nil && proposalEnd.Before(now) {
		statusNorm = domain.StatusNormalizedClosed
	}

	// 5. Source URL (Portal PNCP)
	sourceURL := fmt.Sprintf(
		"https://pncp.gov.br/app/editais/%s/%d/%d",
		dto.OrgaoEntidade.CNPJ,
		dto.AnoCompra,
		dto.SequencialCompra,
	)

	// Optional strings
	var purchaseNumber *string
	if dto.NumeroCompra != "" {
		purchaseNumber = &dto.NumeroCompra
	}

	var purchaseYear *int
	if dto.AnoCompra > 0 {
		purchaseYear = &dto.AnoCompra
	}

	var modalityName *string
	if dto.ModalidadeNome != "" {
		modalityName = &dto.ModalidadeNome
	}

	var disputeModeName *string
	if dto.ModoDisputaNome != "" {
		disputeModeName = &dto.ModoDisputaNome
	}

	var ibgeCode *string
	if dto.UnidadeOrgao.CodigoIBGE != "" {
		ibgeCode = &dto.UnidadeOrgao.CodigoIBGE
	}

	return domain.LicitacaoOportunidade{
		ID:                  uuid.New().String(),
		Source:              "PNCP",
		SourceExternalID:    dto.NumeroControlePNCP,
		DedupKey:            domain.BuildDedupKey(dto.OrgaoEntidade.CNPJ, dto.Processo),
		OrganizationCNPJ:    dto.OrgaoEntidade.CNPJ,
		OrganizationName:    dto.OrgaoEntidade.RazaoSocial,
		UnitName:            dto.UnidadeOrgao.NomeUnidade,
		MunicipalityName:    dto.UnidadeOrgao.MunicipioNome,
		MunicipalityIBGE:    ibgeCode,
		UF:                  dto.UnidadeOrgao.UFSigla,
		PurchaseNumber:      purchaseNumber,
		PurchaseYear:        purchaseYear,
		ModalityName:        modalityName,
		DisputeModeName:     disputeModeName,
		StatusSource:        dto.SituacaoCompraNome,
		StatusNormalized:    statusNorm,
		ObjectRaw:           dto.ObjetoCompra,
		ObjectNormalized:    classResult.NormalizedText,
		EstimatedTotalValue: estValue,
		ValueStatus:         valStatus,
		ProposalStartAt:     proposalStart,
		ProposalEndAt:       proposalEnd,
		PublishedAt:         publishedAt,
		SourceUpdatedAt:     sourceUpdated,
		Classification:      classResult.Classification,
		ClassificationScore: classResult.Score,
		ClassificationTerms: classResult.MatchedTerms,
		ClassifierVersion:   classResult.Version,
		SourceURL:           sourceURL,
		LastSeenAt:          now,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
}
