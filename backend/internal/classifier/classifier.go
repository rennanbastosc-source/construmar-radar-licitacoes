package classifier

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const Version = "v1.0.0"

type Rule struct {
	Term   string
	Weight float64
}

// Default classification rules for civil construction, engineering, and public works.
var highWeightRules = []Rule{
	{"construcao", 3.0},
	{"obra", 3.0},
	{"obras", 3.0},
	{"engenharia", 3.0},
	{"reforma", 3.0},
	{"ampliacao", 3.0},
	{"edificacao", 3.0},
	{"edificacoes", 3.0},
	{"pavimentacao", 3.0},
	{"asfalto", 3.0},
	{"asfaltica", 3.0},
	{"recapeamento", 3.0},
	{"ponte", 3.0},
	{"viaduto", 3.0},
	{"drenagem", 3.0},
	{"saneamento", 3.0},
	{"terraplenagem", 3.0},
	{"restauracao predial", 3.0},
	// ponytail: phrase rules are deltas on top of the single-word match to avoid double-counting
	{"construcao civil", 1.0},
	{"engenharia civil", 1.0},
	{"infraestrutura urbana", 3.0},
	{"muro de contencao", 3.0},
	{"calcamento", 3.0},
}

var mediumWeightRules = []Rule{
	{"urbanizacao", 1.5},
	{"instalacao predial", 1.2},
	{"instalacoes hidraulicas", 1.2},
	{"instalacoes eletricas", 1.2},
	{"estrutura metalica", 1.5},
	{"cobertura metalica", 1.5},
	{"impermeabilizacao", 1.2},
	{"manutencao predial", 1.2},
	{"calcada", 1.0},
	{"praca publica", 1.2},
	{"rede de esgoto", 1.5},
	{"abastecimento de agua", 1.5},
	{"recomposicao de vias", 1.2},
	{"sinalizacao viaria", 1.0},
}

var negativeWeightRules = []Rule{
	{"combustivel", -3.0},
	{"gasolina", -3.0},
	{"diesel", -3.0},
	{"veiculo", -2.5},
	{"veiculos", -2.5},
	{"automovel", -2.5},
	{"medicamento", -3.0},
	{"medicamentos", -3.0},
	{"hospitalar", -2.0},
	{"merenda", -3.0},
	{"alimenticios", -3.0},
	{"generos alimenticios", -3.5},
	{"software", -3.0},
	{"licenca de software", -3.5},
	{"uniforme", -2.5},
	{"fardamento", -2.5},
	{"papelaria", -2.5},
	{"material de expediente", -2.5},
	{"locacao de maquinas de cafe", -3.0},
	{"auxilio alimentacao", -3.5},
	{"refeicao", -3.0},
	{"agenciamento de viagens", -3.0},
	{"passagens aereas", -3.0},
}

type ClassificationResult struct {
	Classification string
	Score          float64
	MatchedTerms   []string
	NormalizedText string
	Version        string
}

// NormalizeText converts string to lowercase, strips accents and replaces special characters.
func NormalizeText(input string) string {
	if input == "" {
		return ""
	}

	// Remove accents using norm and unicode transform
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, err := transform.String(t, input)
	if err != nil {
		result = input
	}

	result = strings.ToLower(result)

	// Replace non-alphanumeric chars (except space) with space
	reg := regexp.MustCompile(`[^a-z0-9\s]`)
	result = reg.ReplaceAllString(result, " ")

	// Normalize spaces
	spaceReg := regexp.MustCompile(`\s+`)
	result = spaceReg.ReplaceAllString(result, " ")

	return strings.TrimSpace(result)
}

// ClassifyObject evaluates an object description, supplementary info and returns classification.
func ClassifyObject(objectRaw string, complementRaw string) ClassificationResult {
	combined := objectRaw
	if complementRaw != "" {
		combined += " " + complementRaw
	}

	normalized := NormalizeText(combined)
	score := 0.0
	matchedTermsMap := make(map[string]bool)

	// Check high weight rules
	for _, rule := range highWeightRules {
		if containsWordOrPhrase(normalized, rule.Term) {
			score += rule.Weight
			matchedTermsMap[rule.Term] = true
		}
	}

	// Check medium weight rules
	for _, rule := range mediumWeightRules {
		if containsWordOrPhrase(normalized, rule.Term) {
			score += rule.Weight
			matchedTermsMap[rule.Term] = true
		}
	}

	// Check negative weight rules
	for _, rule := range negativeWeightRules {
		if containsWordOrPhrase(normalized, rule.Term) {
			score += rule.Weight
			matchedTermsMap["!"+rule.Term] = true
		}
	}

	matchedTerms := make([]string, 0, len(matchedTermsMap))
	for term := range matchedTermsMap {
		matchedTerms = append(matchedTerms, term)
	}

	var status string
	if score >= 2.5 {
		status = domain.ClassificationInScope
	} else if score >= 1.0 {
		status = domain.ClassificationReview
	} else {
		status = domain.ClassificationOutOfScope
	}

	return ClassificationResult{
		Classification: status,
		Score:          score,
		MatchedTerms:   matchedTerms,
		NormalizedText: normalized,
		Version:        Version,
	}
}

func containsWordOrPhrase(text, term string) bool {
	if strings.Contains(term, " ") {
		return strings.Contains(text, term)
	}
	// For single words, match whole words to prevent accidental substring matches (e.g. "sobra" -> "obra")
	pattern := `\b` + regexp.QuoteMeta(term) + `\b`
	matched, _ := regexp.MatchString(pattern, text)
	return matched
}
