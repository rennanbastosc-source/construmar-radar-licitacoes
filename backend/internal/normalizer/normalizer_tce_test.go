package normalizer

import (
	"testing"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/tcce"
)

func TestTCEValueToFloat(t *testing.T) {
	value, ok := TCEValueToFloat("3.716.445,75")
	if !ok || value != 3716445.75 {
		t.Fatalf("expected 3716445.75, got %v (ok=%v)", value, ok)
	}
}

func TestNormalizeTCEPlaceholderAndDateFormats(t *testing.T) {
	detail := &tcce.LicitacaoDetail{
		Exercicio:      "2026",
		OpeningTimeRaw: "08:30",
		Situation:      "Aberta",
	}
	list := tcce.LicitacaoListItem{
		Number:         "005/2026-CE",
		Municipality:   "ITAREMA",
		Object:         "CONSTRUÇÃO DE HOSPITAL",
		PublishedAtRaw: "18/05/2026",
		OpeningAtRaw:   "01/12/2026",
		ValueRaw:       "0,01",
		ProcID:         "268767",
		LicitID:        "187006",
	}

	opp := NormalizeTCE(list, detail, time.Date(2026, time.May, 18, 12, 0, 0, 0, time.UTC))
	if opp.MunicipalityName != "Itarema" {
		t.Fatalf("expected title-cased municipality, got %q", opp.MunicipalityName)
	}
	if opp.ValueStatus != domain.ValueStatusConfidential || opp.EstimatedTotalValue != nil {
		t.Fatalf("expected confidential placeholder value, got status=%q value=%v", opp.ValueStatus, opp.EstimatedTotalValue)
	}
	if opp.PublishedAt == nil || !opp.PublishedAt.Equal(time.Date(2026, time.May, 18, 3, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected published date: %v", opp.PublishedAt)
	}
	if opp.ProposalStartAt == nil || !opp.ProposalStartAt.Equal(time.Date(2026, time.December, 1, 11, 30, 0, 0, time.UTC)) {
		t.Fatalf("unexpected proposal start: %v", opp.ProposalStartAt)
	}
	if opp.CrossDedupKey != "ITAREMA|2026|005" {
		t.Fatalf("unexpected cross dedup key: %q", opp.CrossDedupKey)
	}
}

func TestNormalizeTCEPrefersDetailDates(t *testing.T) {
	list := tcce.LicitacaoListItem{
		Number:         "005/2026-CE",
		Municipality:   "ITAREMA",
		PublishedAtRaw: "01/01/2026",
		OpeningAtRaw:   "02/01/2026",
		ValueRaw:       "3.716.445,75",
	}
	detail := &tcce.LicitacaoDetail{
		Exercicio:      "2026",
		PublishedAtRaw: "18/05/2026",
		OpeningAtRaw:   "01/12/2026",
		OpeningTimeRaw: "08:30",
	}

	opp := NormalizeTCE(list, detail, time.Now().UTC())
	if opp.PublishedAt == nil || !opp.PublishedAt.Equal(time.Date(2026, time.May, 18, 3, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected detail publication date, got %v", opp.PublishedAt)
	}
	if opp.ProposalStartAt == nil || !opp.ProposalStartAt.Equal(time.Date(2026, time.December, 1, 11, 30, 0, 0, time.UTC)) {
		t.Fatalf("expected detail opening date/time, got %v", opp.ProposalStartAt)
	}
}

func TestNormalizeTCEUsesLastYearOccurrence(t *testing.T) {
	list := tcce.LicitacaoListItem{
		Number:       "2001/2026",
		Municipality: "Itarema",
		ValueRaw:     "3.716.445,75",
	}

	opp := NormalizeTCE(list, nil, time.Date(2026, time.January, 1, 12, 0, 0, 0, time.UTC))
	if opp.PurchaseYear == nil || *opp.PurchaseYear != 2026 {
		t.Fatalf("expected last year occurrence 2026, got %v", opp.PurchaseYear)
	}
}

func TestNormalizeTCEKnownValueAndReopeningDate(t *testing.T) {
	list := tcce.LicitacaoListItem{
		Number:         "12/2025",
		Municipality:   "São Gonçalo do Amarante",
		Object:         "PAVIMENTAÇÃO ASFÁLTICA",
		OpeningAtRaw:   "10/06/2025",
		ReopeningAtRaw: "11/06/2025",
		ValueRaw:       "3.716.445,75",
	}

	opp := NormalizeTCE(list, nil, time.Now().UTC())
	if opp.ValueStatus != domain.ValueStatusKnown || opp.EstimatedTotalValue == nil || *opp.EstimatedTotalValue != 3716445.75 {
		t.Fatalf("expected known value, got status=%q value=%v", opp.ValueStatus, opp.EstimatedTotalValue)
	}
	if opp.ProposalEndAt == nil || !opp.ProposalEndAt.Equal(time.Date(2025, time.June, 11, 3, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected reopening date: %v", opp.ProposalEndAt)
	}
	if opp.StatusNormalized != domain.StatusNormalizedClosed {
		t.Fatalf("expected expired reopening deadline to be closed, got %q", opp.StatusNormalized)
	}
}
