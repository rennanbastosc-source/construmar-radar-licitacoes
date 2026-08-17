package pncp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	MaxRetries int
}

func NewClient(baseURL string, timeout time.Duration) *Client {
	if baseURL == "" {
		baseURL = "https://pncp.gov.br/api/consulta"
	}
	if timeout <= 0 {
		timeout = 20 * time.Second
	}

	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: timeout,
		},
		MaxRetries: 3,
	}
}

func (c *Client) FetchPropostas(ctx context.Context, uf string, dataFinal string, page int, pageSize int) (*PNCPPropostaResponse, []byte, error) {
	if uf == "" {
		uf = "CE"
	}
	if dataFinal == "" {
		// Default to end of current year
		dataFinal = time.Now().Format("2006") + "1231"
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 10 || pageSize > 50 {
		pageSize = 50
	}

	params := url.Values{}
	params.Set("uf", uf)
	params.Set("dataFinal", dataFinal)
	params.Set("pagina", strconv.Itoa(page))
	params.Set("tamanhoPagina", strconv.Itoa(pageSize))

	endpoint := fmt.Sprintf("%s/v1/contratacoes/proposta?%s", c.BaseURL, params.Encode())

	body, err := c.doRequestWithRetry(ctx, endpoint)
	if err != nil {
		return nil, nil, err
	}

	var resp PNCPPropostaResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, body, fmt.Errorf("failed to decode PNCP proposals response: %w", err)
	}

	return &resp, body, nil
}

func (c *Client) FetchCompraDetail(ctx context.Context, cnpj string, ano int, sequencial int) (*PNCPContratacaoDTO, []byte, error) {
	endpoint := fmt.Sprintf("%s/v1/orgaos/%s/compras/%d/%d", c.BaseURL, cnpj, ano, sequencial)

	body, err := c.doRequestWithRetry(ctx, endpoint)
	if err != nil {
		return nil, nil, err
	}

	var detail PNCPContratacaoDTO
	if err := json.Unmarshal(body, &detail); err != nil {
		return nil, body, fmt.Errorf("failed to decode PNCP compra detail: %w", err)
	}

	return &detail, body, nil
}

func (c *Client) doRequestWithRetry(ctx context.Context, reqURL string) ([]byte, error) {
	var lastErr error

	for attempt := 0; attempt <= c.MaxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * 500 * time.Millisecond
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to build request: %w", err)
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "Construmar-RadarLicitacoes/1.0")

		resp, err := c.HTTPClient.Do(req)
		if err != nil {
			lastErr = err
			continue // Retry on network/timeout errors
		}

		body, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()

		if readErr != nil {
			lastErr = readErr
			continue
		}

		// Handle HTTP status codes
		if resp.StatusCode == http.StatusOK {
			return body, nil
		}

		if resp.StatusCode == http.StatusNoContent {
			return []byte(`{"data":[],"totalRegistros":0,"totalPaginas":0}`), nil
		}

		// Check if status code is retryable (408 Request Timeout, 429 Too Many Requests, 5xx Server Error)
		if resp.StatusCode == http.StatusRequestTimeout || resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("PNCP API returned retryable status %d: %s", resp.StatusCode, string(body))
			continue
		}

		// Non-retryable 4xx client errors
		return nil, fmt.Errorf("PNCP API returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil, fmt.Errorf("max retries exceeded for URL %s: %w", reqURL, lastErr)
}
