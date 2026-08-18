package domain

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
