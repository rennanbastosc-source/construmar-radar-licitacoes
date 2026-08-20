package domain

import "testing"

func TestBuildDedupKey(t *testing.T) {
	tests := []struct {
		name     string
		cnpj     string
		processo string
		want     string
	}{
		{
			name:     "formatted SEI",
			cnpj:     "07954480000179",
			processo: "22001.114447/2024-73",
			want:     "07954480000179|22001114447202473",
		},
		{
			name:     "unformatted SEI",
			cnpj:     "07954480000179",
			processo: "22001114447202473",
			want:     "07954480000179|22001114447202473",
		},
		{
			name:     "date",
			cnpj:     "07954480000179",
			processo: "2026.08.04.1",
			want:     "",
		},
		{
			name:     "short",
			cnpj:     "07954480000179",
			processo: "001/2025",
			want:     "",
		},
		{
			name:     "alphanumeric",
			cnpj:     "07954480000179",
			processo: "PC.25.07D79-0001",
			want:     "",
		},
		{
			name:     "empty",
			cnpj:     "07954480000179",
			processo: "",
			want:     "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := BuildDedupKey(tt.cnpj, tt.processo); got != tt.want {
				t.Errorf("BuildDedupKey(%q, %q) = %q, want %q", tt.cnpj, tt.processo, got, tt.want)
			}
		})
	}
}

func TestNormalizeCrossKeyPart(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "accent", input: "Crateús", want: "CRATEUS"},
		{name: "spaces and punctuation", input: "Juazeiro do Norte", want: "JUAZEIRODONORTE"},
		{name: "number punctuation", input: "005/2026-CE", want: "0052026CE"},
		{name: "empty", input: " - / ", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizeCrossKeyPart(tt.input); got != tt.want {
				t.Errorf("NormalizeCrossKeyPart(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestBuildCrossDedupKey(t *testing.T) {
	tests := []struct {
		name         string
		municipality string
		number       string
		year         int
		want         string
	}{
		{
			name:         "accent and spaces",
			municipality: "São Gonçalo do Amarante",
			number:       "0508.01/2026",
			year:         2026,
			want:         "SAOGONCALODOAMARANTE|2026|050801",
		},
		{
			name:         "005/2026-CE",
			municipality: "Itarema",
			number:       "005/2026-CE",
			year:         2026,
			want:         "ITAREMA|2026|005",
		},
		{
			name:         "short residual",
			municipality: "Fortaleza",
			number:       "08/2026",
			year:         2026,
			want:         "",
		},
		{
			name:         "TCE alphanumeric short residual",
			municipality: "Fortaleza",
			number:       "CE08/2026SEINF",
			year:         2026,
			want:         "",
		},
		{
			name:         "empty municipality",
			municipality: "",
			number:       "005/2026",
			year:         2026,
			want:         "",
		},
		{
			name:         "empty number",
			municipality: "Fortaleza",
			number:       "",
			year:         2026,
			want:         "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := BuildCrossDedupKey(tt.municipality, tt.number, tt.year); got != tt.want {
				t.Errorf("BuildCrossDedupKey(%q, %q, %d) = %q, want %q", tt.municipality, tt.number, tt.year, got, tt.want)
			}
		})
	}

	first := BuildCrossDedupKey("Pereiro", "0508.01/2026", 2026)
	second := BuildCrossDedupKey("Pereiro", "0508.01/2026", 2026)
	if first == "" || first != second {
		t.Errorf("identical procurement numbers must share a key: %q vs %q", first, second)
	}
}
