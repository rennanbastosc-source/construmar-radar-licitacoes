package domain

import (
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/text/unicode/norm"
)

// BuildDedupKey builds the stable identity used to deduplicate opportunities.
func BuildDedupKey(cnpj, processo string) string {
	digits := make([]byte, 0, len(processo))
	for i := 0; i < len(processo); i++ {
		if processo[i] >= '0' && processo[i] <= '9' {
			digits = append(digits, processo[i])
		}
	}

	if len(digits) < 14 {
		return ""
	}

	return cnpj + "|" + string(digits)
}

// NormalizeCrossKeyPart normalizes a cross-source deduplication key component.
func NormalizeCrossKeyPart(s string) string {
	decomposed := norm.NFD.String(strings.ToUpper(strings.TrimSpace(s)))
	var normalized strings.Builder
	normalized.Grow(len(decomposed))

	for _, r := range decomposed {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			normalized.WriteRune(r)
		}
	}

	return normalized.String()
}

// BuildCrossDedupKey builds the normalized identity shared by bidding sources.
func BuildCrossDedupKey(municipality, number string, year int) string {
	municipalityPart := NormalizeCrossKeyPart(municipality)
	if municipalityPart == "" {
		return ""
	}

	normalizedNumber := NormalizeCrossKeyPart(number)
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, normalizedNumber)

	yearPart := strconv.Itoa(year)
	stem := digits
	if index := strings.Index(stem, yearPart); index >= 0 {
		stem = stem[:index] + stem[index+len(yearPart):]
	}
	// ponytail: stems curtos ficam sem dedup para evitar falsos positivos entre modalidades.
	if len(stem) < 3 {
		return ""
	}

	return fmt.Sprintf("%s|%04d|%s", municipalityPart, year, stem)
}
