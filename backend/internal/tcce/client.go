package tcce

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"time"
)

const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
const maxResponseBodyBytes int64 = 10 * 1024 * 1024

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	MaxRetries int
}

func NewClient(timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	jar, _ := cookiejar.New(nil)
	return &Client{
		BaseURL: DefaultBaseURL,
		HTTPClient: &http.Client{
			Timeout: timeout,
			Jar:     jar,
		},
		MaxRetries: 3,
	}
}

func (c *Client) FetchAbertas(ctx context.Context) ([]LicitacaoListItem, error) {
	body, _, err := c.doRequestWithRetry(ctx, c.endpoint("/index.php/licitacao/abertas"))
	if err != nil {
		return nil, err
	}
	return parseAbertas(body)
}

func (c *Client) FetchDetalhes(ctx context.Context, procID, licitID string) (*LicitacaoDetail, error) {
	path := fmt.Sprintf("/index.php/licitacao/detalhes/proc/%s/licit/%s", url.PathEscape(procID), url.PathEscape(licitID))
	body, _, err := c.doRequestWithRetry(ctx, c.endpoint(path))
	if err != nil {
		return nil, err
	}
	return parseDetalhes(body, c.baseURL())
}

func (c *Client) CheckHealth(ctx context.Context) (statusCode int, latencyMs int64, err error) {
	startedAt := time.Now()
	_, statusCode, err = c.doRequestWithRetry(ctx, c.endpoint("/index.php/licitacao/abertas"))
	return statusCode, time.Since(startedAt).Milliseconds(), err
}

func (c *Client) doRequestWithRetry(ctx context.Context, requestURL string) ([]byte, int, error) {
	if c == nil {
		return nil, 0, fmt.Errorf("TCE-CE client is nil")
	}

	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}

	maxRetries := c.MaxRetries
	if maxRetries < 0 {
		maxRetries = 0
	}

	var lastErr error
	lastStatus := 0
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Second << (attempt - 1)
			select {
			case <-ctx.Done():
				return nil, lastStatus, ctx.Err()
			case <-time.After(backoff):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
		if err != nil {
			return nil, 0, fmt.Errorf("build TCE-CE request: %w", err)
		}
		req.Header.Set("Accept", "text/html")
		req.Header.Set("User-Agent", userAgent)

		resp, err := httpClient.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return nil, lastStatus, ctx.Err()
			}
			lastErr = err
			continue
		}

		lastStatus = resp.StatusCode
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, maxResponseBodyBytes))
		_ = resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}

		if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
			return body, resp.StatusCode, nil
		}

		if isRetryableStatus(resp.StatusCode) {
			lastErr = fmt.Errorf("TCE-CE portal returned retryable status %d: %s", resp.StatusCode, normalizeText(string(body)))
			continue
		}
		return nil, resp.StatusCode, fmt.Errorf("TCE-CE portal returned status %d: %s", resp.StatusCode, normalizeText(string(body)))
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("request failed")
	}
	return nil, lastStatus, fmt.Errorf("max retries exceeded for URL %s: %w", requestURL, lastErr)
}

func isRetryableStatus(statusCode int) bool {
	return statusCode == http.StatusRequestTimeout || statusCode == http.StatusTooManyRequests || statusCode >= http.StatusInternalServerError
}

func (c *Client) baseURL() string {
	if c == nil || strings.TrimSpace(c.BaseURL) == "" {
		return DefaultBaseURL
	}
	return strings.TrimRight(strings.TrimSpace(c.BaseURL), "/")
}

func (c *Client) endpoint(path string) string {
	return c.baseURL() + "/" + strings.TrimLeft(path, "/")
}
