package parser

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/ledongthuc/pdf"
)

// ExtractTextFromPDF extracts clean plain-text from digital PDF bytes.
// If the PDF is scanned or contains no extractable text stream, it returns empty string without error.
func ExtractTextFromPDF(pdfBytes []byte) (string, int, error) {
	if len(pdfBytes) == 0 {
		return "", 0, fmt.Errorf("empty pdf bytes")
	}

	reader, err := pdf.NewReader(bytes.NewReader(pdfBytes), int64(len(pdfBytes)))
	if err != nil {
		return "", 0, fmt.Errorf("failed to open pdf reader: %w", err)
	}

	numPages := reader.NumPage()
	var fullText strings.Builder

	for i := 1; i <= numPages; i++ {
		page := reader.Page(i)
		if page.V.IsNull() {
			continue
		}

		plainText, err := page.GetPlainText(nil)
		if err == nil && len(plainText) > 0 {
			fullText.WriteString(fmt.Sprintf("\n--- [PÁGINA %d] ---\n", i))
			fullText.WriteString(strings.TrimSpace(plainText))
			fullText.WriteString("\n")
		}
	}

	extracted := strings.TrimSpace(fullText.String())
	return extracted, numPages, nil
}
