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
