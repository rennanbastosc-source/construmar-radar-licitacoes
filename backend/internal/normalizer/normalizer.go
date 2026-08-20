package normalizer

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/construmar/radar-licitacoes-backend/internal/classifier"
	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/pncp"
	"github.com/construmar/radar-licitacoes-backend/internal/tcce"
	"github.com/google/uuid"
)

var spLocation *time.Location
var tceYearPattern = regexp.MustCompile(`\d{4}`)

func init() {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*60*60)
	}
	spLocation = loc
}

// ParseBRDate parses date strings in Brasilia timezone.
func ParseBRDate(dateStr *string) *time.Time {
	if dateStr == nil || strings.TrimSpace(*dateStr) == "" {
		return nil
	}

	return ParseBRDateTime(*dateStr, "")
}

// ParseBRDateTime parses Brazilian date/time strings in Brasilia timezone and
// returns the instant converted to UTC.
func ParseBRDateTime(dateStr, timeStr string) *time.Time {
	cleanDate := strings.TrimSpace(dateStr)
	cleanTime := strings.TrimSpace(timeStr)
	if cleanDate == "" {
		return nil
	}

	if cleanTime != "" {
		combined := strings.TrimSpace(cleanDate + " " + cleanTime)
		for _, layout := range []string{
			"02/01/2006 15:04",
			"02/01/2006 15:04:05",
			"02/01/2006 15:04:05.000",
			"2006-01-02 15:04",
			"2006-01-02 15:04:05",
			"2006-01-02 15:04:05.000",
		} {
			if t, err := time.ParseInLocation(layout, combined, spLocation); err == nil {
				utc := t.UTC()
				return &utc
			}
		}
	}

	layouts := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05.000",
		"2006-01-02 15:04:05",
		"2006-01-02",
		"02/01/2006 15:04:05",
		"02/01/2006 15:04:05.000",
		"02/01/2006 15:04",
		"02/01/2006",
	}

	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, cleanDate, spLocation); err == nil {
			utc := t.UTC()
			return &utc
		}
	}

	return nil
}

// TCEValueToFloat parses a value formatted according to the TCE-CE portal's
// Brazilian notation.
func TCEValueToFloat(raw string) (float64, bool) {
	clean := strings.TrimSpace(raw)
	clean = strings.ReplaceAll(clean, "\u00a0", "")
	clean = strings.ReplaceAll(clean, " ", "")
	clean = strings.ReplaceAll(clean, "R$", "")
	clean = strings.ReplaceAll(clean, "r$", "")
	clean = strings.ReplaceAll(clean, ".", "")
	clean = strings.ReplaceAll(clean, ",", ".")
	if clean == "" {
		return 0, false
	}

	value, err := strconv.ParseFloat(clean, 64)
	return value, err == nil
}

func titleCaseBR(value string) string {
	words := strings.Fields(strings.ToLower(strings.TrimSpace(value)))
	for i, word := range words {
		runes := []rune(word)
		if len(runes) > 0 {
			runes[0] = unicode.ToUpper(runes[0])
			words[i] = string(runes)
		}
	}
	return strings.Join(words, " ")
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
	proposalStart := ParseBRDate(dto.DataAberturaProposta)
	proposalEnd := ParseBRDate(dto.DataEncerramentoProposta)
	publishedAt := ParseBRDate(dto.DataPublicacaoPncp)
	sourceUpdated := ParseBRDate(dto.DataAtualizacao)
	if sourceUpdated == nil {
		sourceUpdated = ParseBRDate(dto.DataAtualizacaoGlobal)
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

	crossDedupKey := ""
	if purchaseNumber != nil && purchaseYear != nil {
		crossDedupKey = domain.BuildCrossDedupKey(dto.UnidadeOrgao.MunicipioNome, *purchaseNumber, *purchaseYear)
	}

	return domain.LicitacaoOportunidade{
		ID:                  uuid.New().String(),
		Source:              "PNCP",
		SourceExternalID:    dto.NumeroControlePNCP,
		DedupKey:            domain.BuildDedupKey(dto.OrgaoEntidade.CNPJ, dto.Processo),
		CrossDedupKey:       crossDedupKey,
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

// NormalizeTCE converts a TCE-CE list item and its optional detail into the
// normalized opportunity used by the radar.
func NormalizeTCE(list tcce.LicitacaoListItem, detail *tcce.LicitacaoDetail, now time.Time) domain.LicitacaoOportunidade {
	municipalityName := titleCaseBR(list.Municipality)

	var purchaseNumber *string
	if list.Number != "" {
		number := list.Number
		purchaseNumber = &number
	}

	var purchaseYear *int
	if detail != nil {
		if year, err := strconv.Atoi(strings.TrimSpace(detail.Exercicio)); err == nil {
			purchaseYear = &year
		}
	}
	if purchaseYear == nil {
		matches := tceYearPattern.FindAllString(list.Number, -1)
		if len(matches) > 0 {
			if year, err := strconv.Atoi(matches[len(matches)-1]); err == nil {
				purchaseYear = &year
			}
		}
	}

	statusSource := "Aberta"
	var modalityName *string
	unitName := ""
	if detail != nil {
		if detail.Situation != "" {
			statusSource = detail.Situation
		}
		if detail.Modality != "" {
			modality := detail.Modality
			modalityName = &modality
		}
		if detail.Orgao != "" {
			unitName = detail.Orgao
		}
	}

	classResult := classifier.ClassifyObject(list.Object, "")
	value, valueOK := TCEValueToFloat(list.ValueRaw)
	var estimatedValue *float64
	valueStatus := domain.ValueStatusUnknown
	if valueOK && value == 0.01 {
		valueStatus = domain.ValueStatusConfidential
	} else if valueOK {
		valueStatus = domain.ValueStatusKnown
		estimatedValue = &value
	}

	publishedAtRaw := list.PublishedAtRaw
	openingAtRaw := list.OpeningAtRaw
	proposalStart := ""
	if detail != nil {
		if strings.TrimSpace(detail.PublishedAtRaw) != "" {
			publishedAtRaw = detail.PublishedAtRaw
		}
		if strings.TrimSpace(detail.OpeningAtRaw) != "" {
			openingAtRaw = detail.OpeningAtRaw
		}
		proposalStart = detail.OpeningTimeRaw
	}
	proposalStartAt := ParseBRDateTime(openingAtRaw, proposalStart)
	proposalEndAt := proposalStartAt
	if list.ReopeningAtRaw != "" {
		proposalEndAt = ParseBRDateTime(list.ReopeningAtRaw, "")
	}

	crossDedupKey := ""
	if purchaseYear != nil {
		crossDedupKey = domain.BuildCrossDedupKey(list.Municipality, list.Number, *purchaseYear)
	}

	documents := make([]domain.LicitacaoDocumento, 0)
	if detail != nil {
		documents = make([]domain.LicitacaoDocumento, 0, len(detail.Documents))
		for _, document := range detail.Documents {
			documents = append(documents, domain.LicitacaoDocumento{
				Title:       document.Title,
				DocType:     "ARQUIVO",
				URL:         document.URL,
				SourceDocID: document.URL,
			})
		}
	}

	sourceURL := tcce.DefaultBaseURL + "/index.php/licitacao/detalhes/proc/" + list.ProcID + "/licit/" + list.LicitID
	return domain.LicitacaoOportunidade{
		ID:                  uuid.New().String(),
		Source:              domain.SourceTCECE,
		SourceExternalID:    fmt.Sprintf("%s:%s", list.ProcID, list.LicitID),
		DedupKey:            "",
		CrossDedupKey:       crossDedupKey,
		OrganizationCNPJ:    "",
		OrganizationName:    municipalityName,
		UnitName:            unitName,
		MunicipalityName:    municipalityName,
		UF:                  "CE",
		PurchaseNumber:      purchaseNumber,
		PurchaseYear:        purchaseYear,
		ModalityName:        modalityName,
		StatusSource:        statusSource,
		StatusNormalized:    domain.StatusNormalizedOpen,
		ObjectRaw:           list.Object,
		ObjectNormalized:    classResult.NormalizedText,
		EstimatedTotalValue: estimatedValue,
		ValueStatus:         valueStatus,
		ProposalStartAt:     proposalStartAt,
		ProposalEndAt:       proposalEndAt,
		PublishedAt:         ParseBRDateTime(publishedAtRaw, ""),
		Classification:      classResult.Classification,
		ClassificationScore: classResult.Score,
		ClassificationTerms: classResult.MatchedTerms,
		ClassifierVersion:   classResult.Version,
		SourceURL:           sourceURL,
		LastSeenAt:          now,
		CreatedAt:           now,
		UpdatedAt:           now,
		Documents:           documents,
	}
}
