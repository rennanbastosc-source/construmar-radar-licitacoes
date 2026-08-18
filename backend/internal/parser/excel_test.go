package parser

import (
	"bytes"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestParseExcelBudget(t *testing.T) {
	// Create an in-memory excel file
	f := excelize.NewFile()
	sheet := "Planilha Orçamentária"
	index, err := f.NewSheet(sheet)
	if err != nil {
		t.Fatalf("failed to create sheet: %v", err)
	}
	f.SetActiveSheet(index)

	// Set header rows
	_ = f.SetCellValue(sheet, "A1", "OBRA: Construção de Unidade Básica de Saúde")
	_ = f.SetCellValue(sheet, "A2", "ÓRGÃO: Prefeitura Municipal de Caucaia")
	_ = f.SetCellValue(sheet, "A3", "BASE: SINAPI 02/2026 NÃO DESONERADO - BDI: 22.50%")

	// Set column headers
	_ = f.SetCellValue(sheet, "A5", "ITEM")
	_ = f.SetCellValue(sheet, "B5", "CÓDIGO")
	_ = f.SetCellValue(sheet, "C5", "DESCRIÇÃO DOS SERVIÇOS")
	_ = f.SetCellValue(sheet, "D5", "UNIDADE")
	_ = f.SetCellValue(sheet, "E5", "QUANTIDADE")
	_ = f.SetCellValue(sheet, "F5", "PREÇO UNITÁRIO (R$)")
	_ = f.SetCellValue(sheet, "G5", "TOTAL (R$)")

	// Set data rows
	_ = f.SetCellValue(sheet, "A6", "1.1")
	_ = f.SetCellValue(sheet, "B6", "88247")
	_ = f.SetCellValue(sheet, "C6", "PINTURA LÁTEX ACRÍLICA EM PAREDES DUAS DEMÃOS")
	_ = f.SetCellValue(sheet, "D6", "m²")
	_ = f.SetCellValue(sheet, "E6", "500,00")
	_ = f.SetCellValue(sheet, "F6", "18,50")
	_ = f.SetCellValue(sheet, "G6", "9.250,00")

	_ = f.SetCellValue(sheet, "A7", "1.2")
	_ = f.SetCellValue(sheet, "B7", "98520")
	_ = f.SetCellValue(sheet, "C7", "REVESTIMENTO CERÂMICO PARA PISO")
	_ = f.SetCellValue(sheet, "D7", "m²")
	_ = f.SetCellValue(sheet, "E7", "250,00")
	_ = f.SetCellValue(sheet, "F7", "52,00")
	_ = f.SetCellValue(sheet, "G7", "13.000,00")

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("failed to write excel buffer: %v", err)
	}

	orc, err := ParseExcelBudget(&buf, "orcamento_ubs.xlsx")
	if err != nil {
		t.Fatalf("ParseExcelBudget failed: %v", err)
	}

	if orc.BDI != 22.50 {
		t.Errorf("expected BDI 22.50, got %f", orc.BDI)
	}
	if len(orc.Itens) != 2 {
		t.Fatalf("expected 2 items, got %d", len(orc.Itens))
	}
	if orc.Itens[0].CodigoReferencia != "88247" {
		t.Errorf("expected item 0 code 88247, got %s", orc.Itens[0].CodigoReferencia)
	}
	if orc.Itens[0].Unidade != "M2" {
		t.Errorf("expected item 0 unit M2, got %s", orc.Itens[0].Unidade)
	}
	if orc.Itens[0].Quantidade != 500.0 {
		t.Errorf("expected item 0 qty 500, got %f", orc.Itens[0].Quantidade)
	}
	if orc.Itens[0].PrecoUnitario != 18.50 {
		t.Errorf("expected item 0 unit price 18.50, got %f", orc.Itens[0].PrecoUnitario)
	}
	if orc.ValorTotalEstimado != 22250.0 {
		t.Errorf("expected ValorTotalEstimado 22250.0, got %f", orc.ValorTotalEstimado)
	}
}
