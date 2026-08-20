package tcce

import (
	"bytes"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

var detalhesPathRE = regexp.MustCompile(`/licitacao/detalhes/proc/([^/?#]+)/licit/([^/?#]+)`)
var detailNumberRE = regexp.MustCompile(`(?i)licita(?:ção|cao)\s*:\s*(.+)$`)
var numberExerciseSuffixRE = regexp.MustCompile(`/\d{4}$`)

func normalizeText(text string) string {
	return strings.TrimSpace(strings.Join(strings.Fields(text), " "))
}

func parseAbertas(body []byte) ([]LicitacaoListItem, error) {
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("parse TCE-CE abertas HTML: %w", err)
	}

	items := make([]LicitacaoListItem, 0)
	doc.Find("table#table tbody tr").Each(func(_ int, row *goquery.Selection) {
		cells := row.Find("td")
		if cells.Length() == 0 {
			return
		}

		item := LicitacaoListItem{}
		if cells.Length() > 0 {
			link := cells.Eq(0).Find("a").First()
			item.Number = normalizeText(link.Text())
			if item.Number == "" {
				item.Number = normalizeText(cells.Eq(0).Text())
			}
			if href, ok := link.Attr("href"); ok {
				matches := detalhesPathRE.FindStringSubmatch(href)
				if len(matches) == 3 {
					item.ProcID, _ = url.PathUnescape(matches[1])
					item.LicitID, _ = url.PathUnescape(matches[2])
				}
			}
		}
		if cells.Length() > 1 {
			item.Municipality = normalizeText(cells.Eq(1).Text())
		}
		if cells.Length() > 2 {
			item.Object = normalizeText(cells.Eq(2).Text())
		}
		if cells.Length() > 3 {
			item.OpeningAtRaw = normalizeText(cells.Eq(3).Text())
		}
		if cells.Length() > 4 {
			item.PublishedAtRaw = normalizeText(cells.Eq(4).Text())
		}
		if cells.Length() > 5 {
			item.ReopeningAtRaw = normalizeText(cells.Eq(5).Text())
		}
		if cells.Length() > 6 {
			value := cells.Eq(6).Find("p").First()
			if value.Length() == 0 {
				item.ValueRaw = normalizeText(cells.Eq(6).Text())
			} else {
				item.ValueRaw = normalizeText(value.Text())
			}
		}

		if item.ProcID == "" || item.LicitID == "" || item.Number == "" {
			return
		}
		items = append(items, item)
	})

	return items, nil
}

func parseDetalhes(body []byte, baseURL string) (*LicitacaoDetail, error) {
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("parse TCE-CE detalhes HTML: %w", err)
	}

	detail := &LicitacaoDetail{}
	parseDetailFields(doc, detail)
	parseDetailHeader(doc, detail)
	parseDetailDocuments(doc, detail, baseURL)
	parseDetailOrgao(doc, detail)

	return detail, nil
}

func parseDetailFields(doc *goquery.Document, detail *LicitacaoDetail) {
	doc.Find("*").Each(func(_ int, element *goquery.Selection) {
		labelText := normalizeText(element.Text())
		field := detailFieldName(labelText)
		if field == "" {
			return
		}

		value := valueAfterLabel(element)
		if value == "" {
			return
		}
		setDetailField(detail, field, value)
	})
}

func detailFieldName(label string) string {
	label = strings.TrimSuffix(normalizeText(label), ":")
	label = strings.ToLower(label)

	switch label {
	case "exercício", "exercicio":
		return "Exercicio"
	case "objeto":
		return "Object"
	case "síntese do objeto", "sintese do objeto":
		return "SinteseObjeto"
	case "modalidade":
		return "Modality"
	case "critério de julgamento", "criterio de julgamento":
		return "JudgmentCriteria"
	case "situação", "situacao":
		return "Situation"
	case "data da publicação do aviso":
		return "PublishedAtRaw"
	case "data de abertura":
		return "OpeningAtRaw"
	case "hora da abertura":
		return "OpeningTimeRaw"
	case "local":
		return "Local"
	case "nº do processo administrativo", "n° do processo administrativo", "no do processo administrativo":
		return "Processo"
	case "fundamentação legal", "fundamentacao legal":
		return "LegalBasis"
	default:
		return ""
	}
}

func setDetailField(detail *LicitacaoDetail, field, value string) {
	switch field {
	case "Exercicio":
		detail.Exercicio = value
	case "Object":
		detail.Object = value
	case "SinteseObjeto":
		detail.SinteseObjeto = value
	case "Modality":
		detail.Modality = value
	case "JudgmentCriteria":
		detail.JudgmentCriteria = value
	case "Situation":
		detail.Situation = value
	case "PublishedAtRaw":
		detail.PublishedAtRaw = value
	case "OpeningAtRaw":
		detail.OpeningAtRaw = value
	case "OpeningTimeRaw":
		detail.OpeningTimeRaw = value
	case "Local":
		detail.Local = value
	case "Processo":
		detail.Processo = value
	case "LegalBasis":
		detail.LegalBasis = value
	}
}

func valueAfterLabel(label *goquery.Selection) string {
	parent := label.Parent()
	if parent.Length() > 0 {
		found := false
		parts := make([]string, 0, 2)
		parent.Contents().EachWithBreak(func(_ int, sibling *goquery.Selection) bool {
			if sibling.Get(0) == label.Get(0) {
				found = true
				return true
			}
			if !found {
				return true
			}
			if isDetailLabel(sibling) {
				return false
			}
			parts = append(parts, sibling.Text())
			return true
		})
		if value := normalizeText(strings.Join(parts, " ")); value != "" {
			return value
		}

		if next := parent.Next(); next.Length() > 0 && !isDetailLabel(next) {
			if value := normalizeText(next.Text()); value != "" {
				return value
			}
		}
	}

	if next := label.Next(); next.Length() > 0 && !isDetailLabel(next) {
		return normalizeText(next.Text())
	}
	return ""
}

func isDetailLabel(selection *goquery.Selection) bool {
	text := normalizeText(selection.Text())
	return strings.HasSuffix(text, ":") && detailFieldName(text) != ""
}

func parseDetailHeader(doc *goquery.Document, detail *LicitacaoDetail) {
	doc.Find("h2").EachWithBreak(func(_ int, heading *goquery.Selection) bool {
		header := normalizeText(heading.Text())
		if !strings.Contains(header, "|") {
			return true
		}
		parts := strings.SplitN(header, "|", 2)
		detail.Municipality = normalizeText(parts[0])
		return false
	})

	doc.Find(".breadcrumb li, p").EachWithBreak(func(_ int, element *goquery.Selection) bool {
		text := normalizeText(element.Text())
		matches := detailNumberRE.FindStringSubmatch(text)
		if len(matches) != 2 {
			return true
		}
		number := normalizeText(matches[1])
		detail.Number = numberExerciseSuffixRE.ReplaceAllString(number, "")
		return false
	})
}

func parseDetailOrgao(doc *goquery.Document, detail *LicitacaoDetail) {
	doc.Find("h4").EachWithBreak(func(_ int, heading *goquery.Selection) bool {
		if strings.ToLower(normalizeText(heading.Text())) != "órgãos" && strings.ToLower(normalizeText(heading.Text())) != "orgaos" {
			return true
		}

		if item := heading.Parent().Find("li").First(); item.Length() > 0 {
			detail.Orgao = normalizeText(item.Text())
			return false
		}
		if items := heading.NextAll().Find("li").First(); items.Length() > 0 {
			detail.Orgao = normalizeText(items.Text())
			return false
		}
		return true
	})
}

func parseDetailDocuments(doc *goquery.Document, detail *LicitacaoDetail, baseURL string) {
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if base == "" {
		base = DefaultBaseURL
	}
	baseReference, err := url.Parse(base)
	if err != nil {
		baseReference = nil
	}

	doc.Find(`a[href*="/baixarArquivo/"]`).Each(func(_ int, link *goquery.Selection) {
		href, ok := link.Attr("href")
		if !ok || strings.TrimSpace(href) == "" {
			return
		}
		linkURL, err := url.Parse(href)
		if err != nil {
			return
		}
		if baseReference != nil {
			linkURL = baseReference.ResolveReference(linkURL)
		}
		if !strings.HasSuffix(strings.ToLower(linkURL.Hostname()), "tce.ce.gov.br") {
			return
		}
		detail.Documents = append(detail.Documents, LicitacaoDocumento{
			Title: normalizeText(link.Text()),
			URL:   linkURL.String(),
		})
	})
}
