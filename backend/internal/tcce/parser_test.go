package tcce

import (
	"os"
	"strings"
	"testing"
)

func TestParseAbertas(t *testing.T) {
	body, err := os.ReadFile("testdata/abertas.html")
	if err != nil {
		t.Fatal(err)
	}

	items, err := parseAbertas(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) < 40 {
		t.Fatalf("expected at least 40 items, got %d", len(items))
	}

	first := items[0]
	if first.Number != "005/2026-CE" {
		t.Errorf("first Number = %q", first.Number)
	}
	if first.Municipality != "ITAREMA" {
		t.Errorf("first Municipality = %q", first.Municipality)
	}
	if first.OpeningAtRaw != "01/12/2026" {
		t.Errorf("first OpeningAtRaw = %q", first.OpeningAtRaw)
	}
	if first.PublishedAtRaw != "18/05/2026" {
		t.Errorf("first PublishedAtRaw = %q", first.PublishedAtRaw)
	}
	if first.ValueRaw != "3.716.445,75" {
		t.Errorf("first ValueRaw = %q", first.ValueRaw)
	}
	if first.ProcID != "268767" || first.LicitID != "187006" {
		t.Errorf("first IDs = %s/%s", first.ProcID, first.LicitID)
	}

	var hasReopening, hasConfidentialValue bool
	for _, item := range items {
		hasReopening = hasReopening || item.ReopeningAtRaw != ""
		hasConfidentialValue = hasConfidentialValue || item.ValueRaw == "0,01"
	}
	if !hasReopening {
		t.Error("expected an item with a reopening date")
	}
	if !hasConfidentialValue {
		t.Error("expected an item with ValueRaw 0,01")
	}
}

func TestParseDetalhes(t *testing.T) {
	body, err := os.ReadFile("testdata/detalhes.html")
	if err != nil {
		t.Fatal(err)
	}

	detail, err := parseDetalhes(body, DefaultBaseURL)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Number != "005/2026-CE" {
		t.Errorf("Number = %q", detail.Number)
	}
	if detail.Exercicio != "2026" {
		t.Errorf("Exercicio = %q", detail.Exercicio)
	}
	if detail.Modality != "Concorrência" {
		t.Errorf("Modality = %q", detail.Modality)
	}
	if detail.JudgmentCriteria != "Menor Preço" {
		t.Errorf("JudgmentCriteria = %q", detail.JudgmentCriteria)
	}
	if detail.Situation != "Aberta" {
		t.Errorf("Situation = %q", detail.Situation)
	}
	if detail.OpeningTimeRaw != "08:30" {
		t.Errorf("OpeningTimeRaw = %q", detail.OpeningTimeRaw)
	}
	if detail.Processo != "005/2026-CE" {
		t.Errorf("Processo = %q", detail.Processo)
	}
	if !strings.Contains(detail.Local, "compras.m2atecnologia") {
		t.Errorf("Local = %q", detail.Local)
	}
	if len(detail.Documents) < 10 {
		t.Fatalf("expected at least 10 documents, got %d", len(detail.Documents))
	}
	if detail.Documents[0].Title != "EDITAL" {
		t.Errorf("first document title = %q", detail.Documents[0].Title)
	}
	if !strings.Contains(detail.Documents[0].URL, "/baixarArquivo/") {
		t.Errorf("first document URL = %q", detail.Documents[0].URL)
	}
}
