package seobra

import (
	"bytes"
	"testing"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/xuri/excelize/v2"
)

func TestGenerateSeobraExcelUsesDiscountedPrices(t *testing.T) {
	orc := &domain.Orcamento{
		DescontoGeral: 10,
		Itens: []domain.OrcamentoItem{{
			ItemNumero:    "",
			Descricao:     "Serviço de engenharia",
			Unidade:       "UN",
			Categoria:     domain.CategoriaServico,
			Quantidade:    2,
			PrecoUnitario: 100,
		}},
	}

	data, err := GenerateSeobraExcel(orc)
	if err != nil {
		t.Fatalf("GenerateSeobraExcel failed: %v", err)
	}
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("OpenReader failed: %v", err)
	}
	defer f.Close()

	for cell, want := range map[string]string{
		"A2": "1",
		"H1": "PREÇO\nUNITÁRIO R$",
		"I1": "PREÇO\nTOTAL R$",
	} {
		got, err := f.GetCellValue("orcamento", cell)
		if err != nil {
			t.Fatalf("GetCellValue %s failed: %v", cell, err)
		}
		if got != want {
			t.Errorf("cell %s = %q, want %q", cell, got, want)
		}
	}

	unit, err := f.GetCellValue("orcamento", "H2")
	if err != nil {
		t.Fatalf("GetCellValue unit failed: %v", err)
	}
	if unit != "90" {
		t.Fatalf("discounted unit price = %q, want 90", unit)
	}

	total, err := f.GetCellValue("orcamento", "I2")
	if err != nil {
		t.Fatalf("GetCellValue total failed: %v", err)
	}
	if total != "180" {
		t.Fatalf("discounted total = %q, want 180", total)
	}
}
