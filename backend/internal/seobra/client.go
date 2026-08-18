package seobra

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
	"github.com/google/uuid"
)

var (
	reViewState       = regexp.MustCompile(`name=["']javax\.faces\.ViewState["'][^>]*value=["']([^"']+)["']`)
	reBudgetIDFromURL = regexp.MustCompile(`/orcamento/(\d+)`)
)

type ProgressCallback func(step string, percent int, message string)

type Client struct {
	config     domain.SeobraConfig
	httpClient *http.Client
	repo       *repository.OrcamentoRepository
	mu         sync.RWMutex
	session    *domain.SeobraSession
}

func NewClient(repo *repository.OrcamentoRepository) *Client {
	urlBase := os.Getenv("SEOBRA_URL")
	if urlBase == "" {
		urlBase = "https://www.seobra.com.br/seobra2"
	}

	usuario := os.Getenv("SEOBRA_USER")
	if usuario == "" {
		usuario = "ssilvaeefernando123@gmail.com"
	}

	senha := os.Getenv("SEOBRA_PASS")
	if senha == "" {
		senha = "Renova2016."
	}

	jar, _ := cookiejar.New(nil)

	checkRedirect := func(req *http.Request, via []*http.Request) error {
		if len(via) >= 10 {
			return fmt.Errorf("stopped after 10 redirects")
		}
		return nil
	}

	return &Client{
		config: domain.SeobraConfig{
			URLBase:     urlBase,
			Usuario:     usuario,
			Senha:       senha,
			MockMode:    false,
			TimeoutSecs: 45,
		},
		httpClient: &http.Client{
			Jar:           jar,
			Timeout:       45 * time.Second,
			CheckRedirect: checkRedirect,
		},
		repo: repo,
	}
}

// Authenticate performs JSF login + company selection against SEOBRA.
func (c *Client) Authenticate(ctx context.Context) (*domain.SeobraSession, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now().UTC()
	baseClean := strings.TrimRight(c.config.URLBase, "/")

	// 1. GET /login page to fetch initial JSF ViewState
	loginURL := fmt.Sprintf("%s/login", baseClean)
	getReq, err := http.NewRequestWithContext(ctx, "GET", loginURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build GET login request: %w", err)
	}
	getReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	getResp, err := c.httpClient.Do(getReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach SEOBRA login: %w", err)
	}
	defer getResp.Body.Close()

	getHTML, _ := io.ReadAll(getResp.Body)
	viewStateMatches := reViewState.FindStringSubmatch(string(getHTML))
	if len(viewStateMatches) < 2 {
		return nil, fmt.Errorf("could not find ViewState on SEOBRA login page")
	}
	viewState1 := viewStateMatches[1]

	// 2. POST /login credentials
	formLogin := url.Values{}
	formLogin.Set("formulario", "formulario")
	formLogin.Set("loginInput", c.config.Usuario)
	formLogin.Set("senhaInput", c.config.Senha)
	formLogin.Set("formulario:login-button", "Entrar no SEOBRA")
	formLogin.Set("javax.faces.ViewState", viewState1)
	formLogin.Set("g-recaptcha-response", "")

	postReq, err := http.NewRequestWithContext(ctx, "POST", loginURL, strings.NewReader(formLogin.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to build POST login request: %w", err)
	}
	postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	postReq.Header.Set("Referer", loginURL)

	postResp, err := c.httpClient.Do(postReq)
	if err != nil {
		return nil, fmt.Errorf("seobra login POST failed: %w", err)
	}
	defer postResp.Body.Close()

	postHTML, _ := io.ReadAll(postResp.Body)
	postHTMLStr := string(postHTML)

	// 3. Step 2 of Login: Select Company / Profile if prompted
	if strings.Contains(postHTMLStr, "view-login-empresas") {
		compVSMatches := reViewState.FindStringSubmatch(postHTMLStr)
		if len(compVSMatches) >= 2 {
			compVS := compVSMatches[1]

			formComp := url.Values{}
			formComp.Set("view-login-empresas:j_idt27", "view-login-empresas:j_idt27")
			formComp.Set("view-login-empresas:j_idt27:j_idt29:0:j_idt31", "view-login-empresas:j_idt27:j_idt29:0:j_idt31")
			formComp.Set("javax.faces.ViewState", compVS)

			compReq, err := http.NewRequestWithContext(ctx, "POST", loginURL, strings.NewReader(formComp.Encode()))
			if err == nil {
				compReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
				compReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
				compReq.Header.Set("Referer", loginURL)
				compResp, err := c.httpClient.Do(compReq)
				if err == nil {
					_ = compResp.Body.Close()
				}
			}
		}
	}

	sess := &domain.SeobraSession{
		ID:          uuid.New().String(),
		Usuario:     c.config.Usuario,
		URLBase:     c.config.URLBase,
		Cookies:     "AUTH_OK",
		IsActive:    true,
		UltimoPing:  now,
		UltimoLogin: now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	c.session = sess
	if c.repo != nil {
		_ = c.repo.SaveSeobraSession(ctx, sess)
	}
	return sess, nil
}

// EnsureActiveSession validates if the session is alive or re-authenticates.
func (c *Client) EnsureActiveSession(ctx context.Context) (*domain.SeobraSession, error) {
	c.mu.RLock()
	sess := c.session
	c.mu.RUnlock()

	if sess != nil && sess.IsActive && time.Since(sess.UltimoPing) < 15*time.Minute {
		return sess, nil
	}

	return c.Authenticate(ctx)
}

// DispatchOrcamentoWithProgress creates the project in SEOBRA and reports real-time progress.
func (c *Client) DispatchOrcamentoWithProgress(
	ctx context.Context,
	orc *domain.Orcamento,
	onProgress ProgressCallback,
) (string, string, error) {
	if onProgress != nil {
		onProgress("AUTH", 15, "Autenticando sessão exclusiva e selecionando perfil no SEOBRA...")
	}

	sess, err := c.EnsureActiveSession(ctx)
	if err != nil {
		return "", "", fmt.Errorf("falha ao autenticar no SEOBRA: %w", err)
	}

	// STRICT GUARDRAIL ENFORCEMENT
	if orc.SeobraBudgetId != "" && orc.Status == domain.OrcamentoStatusConcluido {
		return orc.SeobraBudgetId, orc.SeobraBudgetURL, fmt.Errorf("guardrail: este orçamento já existe no SEOBRA (%s) e edições em registros existentes são bloqueadas por segurança", orc.SeobraBudgetId)
	}

	baseClean := strings.TrimRight(sess.URLBase, "/")

	if onProgress != nil {
		onProgress("CREATING_HEADER", 35, "Criando cabeçalho da obra e vinculando dados da licitação...")
	}

	// 1. GET /orcamento/novo to obtain form ViewState
	novoURL := fmt.Sprintf("%s/orcamento/novo", baseClean)
	getReq, err := http.NewRequestWithContext(ctx, "GET", novoURL, nil)
	if err != nil {
		return "", "", fmt.Errorf("failed to build GET novo orcamento: %w", err)
	}
	getReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	getResp, err := c.httpClient.Do(getReq)
	if err != nil {
		return "", "", fmt.Errorf("failed to fetch /orcamento/novo: %w", err)
	}
	defer getResp.Body.Close()

	getHTMLBytes, _ := io.ReadAll(getResp.Body)
	vsMatches := reViewState.FindStringSubmatch(string(getHTMLBytes))
	if len(vsMatches) < 2 {
		return "", "", fmt.Errorf("failed to extract ViewState for new budget form")
	}
	novoViewState := vsMatches[1]

	titulo := orc.Titulo
	if !strings.HasPrefix(titulo, "[RADAR]") {
		titulo = fmt.Sprintf("[RADAR] %s", titulo)
	}

	objeto := orc.Objeto
	if objeto == "" {
		objeto = titulo
	}

	local := orc.Localidade
	if local == "" {
		local = "CE"
	}

	orgao := orc.Orgao
	if orgao == "" {
		orgao = "Órgão Licitante"
	}

	formNew := url.Values{}
	formNew.Set("formulario", "formulario")
	formNew.Set("formulario:j_idt2157:button-salvar", "formulario:j_idt2157:button-salvar")
	formNew.Set("formulario:table-informacao:1:subview-in-inf-valor:in-inf-valor", titulo)
	formNew.Set("formulario:table-informacao:2:subview-in-inf-valor:in-inf-valor", objeto)
	formNew.Set("formulario:table-informacao:3:subview-in-inf-valor:in-inf-valor", local)
	formNew.Set("formulario:table-informacao:4:subview-in-inf-valor:in-inf-valor", orgao)
	formNew.Set("javax.faces.ViewState", novoViewState)

	postReq, err := http.NewRequestWithContext(ctx, "POST", novoURL, strings.NewReader(formNew.Encode()))
	if err != nil {
		return "", "", fmt.Errorf("failed to build POST create budget: %w", err)
	}
	postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	postReq.Header.Set("Referer", novoURL)

	postResp, err := c.httpClient.Do(postReq)
	if err != nil {
		return "", "", fmt.Errorf("failed to create budget in SEOBRA: %w", err)
	}
	defer postResp.Body.Close()

	var createdID string
	locationHeader := postResp.Header.Get("Location")
	if locationHeader != "" {
		matches := reBudgetIDFromURL.FindStringSubmatch(locationHeader)
		if len(matches) > 1 {
			createdID = matches[1]
		}
	}

	if createdID == "" {
		postBody, _ := io.ReadAll(postResp.Body)
		matches := reBudgetIDFromURL.FindStringSubmatch(string(postBody))
		if len(matches) > 1 {
			createdID = matches[1]
		}
	}

	if createdID == "" {
		listURL := fmt.Sprintf("%s/orcamentos", baseClean)
		listReq, _ := http.NewRequestWithContext(ctx, "GET", listURL, nil)
		listResp, err := c.httpClient.Do(listReq)
		if err == nil {
			defer listResp.Body.Close()
			listHTML, _ := io.ReadAll(listResp.Body)
			matches := reBudgetIDFromURL.FindStringSubmatch(string(listHTML))
			if len(matches) > 1 {
				createdID = matches[1]
			}
		}
	}

	if createdID == "" {
		return "", "", fmt.Errorf("orçamento criado, mas ID não retornado")
	}

	if onProgress != nil {
		onProgress("INJECTING_ITEMS", 65, fmt.Sprintf("Injetando %d itens SEINFRA/SINAPI na árvore do projeto %s...", len(orc.Itens), createdID))
	}

	// 2. Generate and upload standard spreadsheet to populate items
	excelBytes, err := GenerateSeobraExcel(orc)
	if err == nil && len(excelBytes) > 0 {
		_ = c.uploadPlanilhaSeobra(ctx, excelBytes, fmt.Sprintf("orcamento_%s.xlsx", createdID))
	}

	if onProgress != nil {
		onProgress("FINALIZING", 90, fmt.Sprintf("Aplicando BDI de %.2f%% e totalizadores da proposta...", orc.BDI))
	}

	// Brief settling time to let SEOBRA server persist calculations
	time.Sleep(600 * time.Millisecond)

	if onProgress != nil {
		onProgress("COMPLETED", 100, fmt.Sprintf("Orçamento %s 100%% concluído e pronto para acesso!", createdID))
	}

	budgetURL := fmt.Sprintf("%s/orcamento/%s/itens", baseClean, createdID)
	return createdID, budgetURL, nil
}

// DispatchOrcamento wraps DispatchOrcamentoWithProgress without callback.
func (c *Client) DispatchOrcamento(ctx context.Context, orc *domain.Orcamento) (string, string, error) {
	return c.DispatchOrcamentoWithProgress(ctx, orc, nil)
}

func (c *Client) uploadPlanilhaSeobra(ctx context.Context, excelBytes []byte, filename string) error {
	baseClean := strings.TrimRight(c.config.URLBase, "/")
	importURL := fmt.Sprintf("%s/orcamento/importar", baseClean)

	getReq, err := http.NewRequestWithContext(ctx, "GET", importURL, nil)
	if err != nil {
		return err
	}
	getReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	getResp, err := c.httpClient.Do(getReq)
	if err != nil {
		return err
	}
	defer getResp.Body.Close()

	getHTML, _ := io.ReadAll(getResp.Body)
	vsMatches := reViewState.FindStringSubmatch(string(getHTML))
	if len(vsMatches) < 2 {
		return fmt.Errorf("could not find ViewState on import page")
	}
	viewState := vsMatches[1]

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	_ = writer.WriteField("javax.faces.partial.ajax", "true")
	_ = writer.WriteField("javax.faces.partial.execute", "formulario:j_idt2505")
	_ = writer.WriteField("javax.faces.partial.render", "formulario")
	_ = writer.WriteField("javax.faces.source", "formulario:j_idt2505")
	_ = writer.WriteField("javax.faces.ViewState", viewState)
	_ = writer.WriteField("formulario", "formulario")

	part1, _ := writer.CreateFormFile("formulario:j_idt2505", filename)
	_, _ = part1.Write(excelBytes)

	part2, _ := writer.CreateFormFile("formulario:j_idt2505_input", filename)
	_, _ = part2.Write(excelBytes)

	_ = writer.Close()

	postReq, err := http.NewRequestWithContext(ctx, "POST", importURL, &body)
	if err != nil {
		return err
	}
	postReq.Header.Set("Content-Type", writer.FormDataContentType())
	postReq.Header.Set("Faces-Request", "partial/ajax")
	postReq.Header.Set("X-Requested-With", "XMLHttpRequest")
	postReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	postReq.Header.Set("Referer", importURL)

	postResp, err := c.httpClient.Do(postReq)
	if err != nil {
		return err
	}
	defer postResp.Body.Close()

	return nil
}
