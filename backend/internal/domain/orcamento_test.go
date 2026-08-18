package domain

import (
	"math"
	"testing"
)

func TestRecalculateTotalsWithDiscounts(t *testing.T) {
	tests := []struct {
		name      string
		descricao string
		unidade   string
		categoria string
		wantItem  float64
	}{
		{name: "labor", descricao: "Pedreiro", unidade: "UN", categoria: CategoriaMaoDeObra, wantItem: 720},
		{name: "material", descricao: "Cimento", unidade: "UN", categoria: CategoriaMaterial, wantItem: 855},
		{name: "service", descricao: "Locação de equipamento", unidade: "UN", categoria: CategoriaServico, wantItem: 900},
	}

	orc := Orcamento{
		DescontoGeral:     10,
		DescontoMaoDeObra: 20,
		DescontoMaterial:  5,
		BDI:               25,
		Itens:             make([]OrcamentoItem, 0, len(tests)),
	}
	for _, tt := range tests {
		orc.Itens = append(orc.Itens, OrcamentoItem{
			Descricao:     tt.descricao,
			Unidade:       tt.unidade,
			Categoria:     tt.categoria,
			Quantidade:    1,
			PrecoUnitario: 1000,
			Confianca:     1,
		})
	}

	orc.RecalculateTotals()
	for idx, tt := range tests {
		if math.Abs(orc.Itens[idx].PrecoTotal-tt.wantItem) > 1e-9 {
			t.Errorf("%s item total = %v, want %v", tt.name, orc.Itens[idx].PrecoTotal, tt.wantItem)
		}
	}
	if math.Abs(orc.ValorTotalEstimado-2475) > 1e-9 {
		t.Errorf("estimated total = %v, want 2475", orc.ValorTotalEstimado)
	}
	if math.Abs(orc.ValorTotalComBDI-3093.75) > 1e-9 {
		t.Errorf("total with BDI = %v, want 3093.75", orc.ValorTotalComBDI)
	}
	if orc.Itens[0].PrecoUnitario != 1000 {
		t.Errorf("base unit price = %v, want 1000", orc.Itens[0].PrecoUnitario)
	}
}
