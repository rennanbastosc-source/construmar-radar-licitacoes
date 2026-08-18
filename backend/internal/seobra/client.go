package seobra

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
	"github.com/google/uuid"
)

var (
	reViewState        = regexp.MustCompile(`name=["']javax\.faces\.ViewState["'][^>]*value=["']([^"']+)["']`)
	reBudgetIDFromURL  = regexp.MustCompile(`/orcamento/(\d+)`)
	reSaveButton       = regexp.MustCompile(`(?i)name\s*=\s*["'](formulario:[^"']*button-salvar[^"']*)["']`)
	reInfoField        = regexp.MustCompile(`(?i)name\s*=\s*["'](formulario:table-informacao:\d+:subview-in-inf-valor:in-inf-valor)["']`)
	reInputTag         = regexp.MustCompile(`(?is)<input\b[^>]*>`)
	reInputType        = regexp.MustCompile(`(?i)\btype\s*=\s*["']([^"']+)["']`)
	reInputName        = regexp.MustCompile(`(?i)\bname\s*=\s*["']([^"']+)["']`)
	reCompanyParam     = regexp.MustCompile(`view-login-empresas:j_idt\d+:j_idt\d+:\d+:j_idt\d+`)
	reFormularioForm   = regexp.MustCompile(`(?s)<form[^>]*id="formulario"[^>]*>.*?</form>`)
	rePartialViewState = regexp.MustCompile(`(?is)<update[^>]*id=["'][^"']*ViewState[^"']*["'][^>]*>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*</update>`)
	reJSFErrorTag      = regexp.MustCompile(`(?i)<error[\s>]`)
	reJSFErrorName     = regexp.MustCompile(`(?is)<error-name[^>]*>(.*?)</error-name>`)
	reJSFErrorMessage  = regexp.MustCompile(`(?is)<error-message[^>]*>(.*?)</error-message>`)
	reJSFRedirect      = regexp.MustCompile(`(?is)<redirect\b[^>]*\burl\s*=\s*["']([^"']+)["'][^>]*>`)
	reBudgetRedirect   = regexp.MustCompile(`(?i)/orcamento/(\d+)/itens`)
	reImportProgress   = regexp.MustCompile(`(?i)processando[^0-9]{0,80}(\d+)\s*/\s*(\d+)`)
	reDivTag           = regexp.MustCompile(`(?is)<div\b[^>]*>`)
	reDivAttribute     = regexp.MustCompile(`(?i)(?:^|\s)(id|class)\s*=\s*["']([^"']*)["']`)
)

var errSeobraSessionInvalidated = errors.New("SEOBRA session invalidated after redirect to login/entrar")

var errSeobraImportIDUnconfirmed = errors.New("SEOBRA import finished but the new SEOBRA budget ID could not be confirmed; verify it before trying again")

func extractFormularioViewState(html string) string {
	if strings.Contains(strings.ToLower(html), "<partial-response") {
		if m := rePartialViewState.FindStringSubmatch(html); len(m) > 1 {
			return strings.TrimSpace(m[1])
		}
	}
	if block := reFormularioForm.FindString(html); block != "" {
		if m := reViewState.FindStringSubmatch(block); len(m) > 1 {
			return m[1]
		}
	}
	if m := rePartialViewState.FindStringSubmatch(html); len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	if m := reViewState.FindStringSubmatch(html); len(m) > 1 {
		return m[1]
	}
	return ""
}

func latestBudgetID(html string) string {
	matches := reBudgetIDFromURL.FindAllStringSubmatch(html, -1)
	best, bestS := 0, ""
	for _, m := range matches {
		n, err := strconv.Atoi(m[1])
		if err == nil && n > best {
			best, bestS = n, m[1]
		}
	}
	return bestS
}

func jsfHardError(body string) bool {
	lowerBody := strings.ToLower(body)
	return reJSFErrorTag.MatchString(body) ||
		strings.Contains(lowerBody, "viewexpiredexception") ||
		strings.Contains(lowerBody, "facesexception")
}

func jsfErrorDetails(body string) string {
	name := ""
	if match := reJSFErrorName.FindStringSubmatch(body); len(match) > 1 {
		name = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(match[1]), "<![CDATA["), "]]>"))
	}
	message := ""
	if match := reJSFErrorMessage.FindStringSubmatch(body); len(match) > 1 {
		message = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(match[1]), "<![CDATA["), "]]>"))
	}
	if name != "" && message != "" {
		return fmt.Sprintf("SEOBRA JSF error: %s: %s", name, message)
	}
	if name != "" {
		return fmt.Sprintf("SEOBRA JSF error: %s", name)
	}
	if message != "" {
		return fmt.Sprintf("SEOBRA JSF error: %s", message)
	}
	return "SEOBRA JSF error response"
}

func isSessionInvalidationRedirect(location string) bool {
	parsed, err := url.Parse(strings.TrimSpace(location))
	if err != nil {
		return false
	}
	path := parsed.Path
	if separator := strings.IndexByte(path, ';'); separator >= 0 {
		path = path[:separator]
	}
	return strings.EqualFold(path, "/seobra2/login") || strings.EqualFold(path, "/seobra2/entrar")
}

func pollRedirectResult(location string) (string, error) {
	if isSessionInvalidationRedirect(location) {
		return "", fmt.Errorf("%w: credentials were used in another session/computer; close the other session and check SEOBRA before dispatching again", errSeobraSessionInvalidated)
	}
	if match := reBudgetRedirect.FindStringSubmatch(location); len(match) > 1 {
		return match[1], nil
	}
	return "", fmt.Errorf("SEOBRA import polling redirected to unexpected location: %s", location)
}

func (c *Client) clearSessionIfInvalidated(err error) {
	if !errors.Is(err, errSeobraSessionInvalidated) {
		return
	}
	c.mu.Lock()
	c.session = nil
	c.mu.Unlock()
}

func jsfPollRedirect(body string) (string, error, bool) {
	match := reJSFRedirect.FindStringSubmatch(body)
	if len(match) < 2 {
		return "", nil, false
	}
	id, err := pollRedirectResult(match[1])
	return id, err, true
}

func isLoginHTML(body string) bool {
	lowerBody := strings.ToLower(body)
	return strings.Contains(lowerBody, "logininput") ||
		strings.Contains(lowerBody, "senhainput") ||
		strings.Contains(lowerBody, "<title>login")
}

func budgetIDIsGreater(id, baseline string) bool {
	current, currentErr := strconv.Atoi(id)
	previous, previousErr := strconv.Atoi(baseline)
	return currentErr == nil && previousErr == nil && current > previous
}

func importProgress(body string) (int, int, bool) {
	match := reImportProgress.FindStringSubmatch(body)
	if len(match) < 3 {
		return 0, 0, false
	}
	current, currentErr := strconv.Atoi(match[1])
	total, totalErr := strconv.Atoi(match[2])
	if currentErr != nil || totalErr != nil {
		return 0, 0, false
	}
	return current, total, true
}

func importHasProcessedPanel(body string) bool {
	for _, tag := range reDivTag.FindAllString(body, -1) {
		id := ""
		className := ""
		for _, match := range reDivAttribute.FindAllStringSubmatch(tag, -1) {
			if len(match) < 3 {
				continue
			}
			switch strings.ToLower(match[1]) {
			case "id":
				id = match[2]
			case "class":
				className = match[2]
			}
		}
		if id != "formulario:panel-status" {
			continue
		}
		for _, token := range strings.Fields(className) {
			if strings.EqualFold(token, "processado") {
				return true
			}
		}
	}
	return false
}

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
	mockMode := os.Getenv("SEOBRA_MOCK") == "1" || strings.EqualFold(os.Getenv("SEOBRA_MOCK"), "true")

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
			MockMode:    mockMode,
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

	postHTML, err := io.ReadAll(postResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read SEOBRA login response: %w", err)
	}
	postHTMLStr := string(postHTML)
	lowerPostHTML := strings.ToLower(postHTMLStr)
	hasCompanyPicker := strings.Contains(postHTMLStr, "view-login-empresas") || strings.Contains(lowerPostHTML, "selecione uma empresa")
	explicitReject := strings.Contains(lowerPostHTML, "usuário ou senha") || strings.Contains(lowerPostHTML, "usuario ou senha") || strings.Contains(lowerPostHTML, "credenciais inválidas") || strings.Contains(lowerPostHTML, "credenciais invalidas")
	// ponytail: SEOBRA keeps loginInput on the company-picker page; that is not a failed login
	if postResp.StatusCode >= 400 || explicitReject || (!hasCompanyPicker && strings.Contains(lowerPostHTML, "logininput") && !strings.Contains(lowerPostHTML, "orcamento")) {
		return nil, fmt.Errorf("SEOBRA login failed: invalid credentials or rejected login")
	}

	// 3. Step 2 of Login: Select Company / Profile if prompted
	if hasCompanyPicker {
		compVSMatches := reViewState.FindStringSubmatch(postHTMLStr)
		if len(compVSMatches) < 2 {
			return nil, fmt.Errorf("SEOBRA login ok, but company picker has no ViewState")
		}
		compVS := compVSMatches[1]
		companyField := "view-login-empresas:j_idt27:j_idt29:0:j_idt31"
		if match := reCompanyParam.FindString(postHTMLStr); match != "" {
			companyField = match
		}

		formComp := url.Values{}
		formComp.Set("view-login-empresas:j_idt27", "view-login-empresas:j_idt27")
		formComp.Set(companyField, companyField)
		formComp.Set("javax.faces.ViewState", compVS)

		compReq, err := http.NewRequestWithContext(ctx, "POST", loginURL, strings.NewReader(formComp.Encode()))
		if err != nil {
			return nil, fmt.Errorf("failed to build SEOBRA company selection: %w", err)
		}
		compReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		compReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		compReq.Header.Set("Referer", loginURL)
		compResp, err := c.httpClient.Do(compReq)
		if err != nil {
			return nil, fmt.Errorf("SEOBRA company selection failed: %w", err)
		}
		compBody, _ := io.ReadAll(compResp.Body)
		_ = compResp.Body.Close()
		if compResp.StatusCode >= 400 {
			return nil, fmt.Errorf("SEOBRA company selection returned status %d", compResp.StatusCode)
		}
		compLower := strings.ToLower(string(compBody))
		if strings.Contains(compLower, "usuário ou senha") || strings.Contains(compLower, "usuario ou senha") {
			return nil, fmt.Errorf("SEOBRA rejected company/profile selection")
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
	if c.config.MockMode {
		itemCount := 0
		bdi := 0.0
		if orc != nil {
			itemCount = len(orc.Itens)
			bdi = orc.BDI
		}
		if onProgress != nil {
			onProgress("AUTH", 15, "Autenticando sessão exclusiva e selecionando perfil no SEOBRA...")
			onProgress("CREATING_HEADER", 35, "Criando cabeçalho da obra e vinculando dados da licitação...")
			onProgress("INJECTING_ITEMS", 65, fmt.Sprintf("Injetando %d itens SEINFRA/SINAPI na árvore do projeto MOCK...", itemCount))
			onProgress("FINALIZING", 90, fmt.Sprintf("Aplicando BDI de %.2f%% e totalizadores da proposta...", bdi))
			onProgress("COMPLETED", 100, "Orçamento MOCK 100% concluído e pronto para acesso!")
		}
		id := ""
		if orc != nil {
			id = orc.ID
		}
		if len(id) > 8 {
			id = id[:8]
		}
		base := strings.TrimRight(c.config.URLBase, "/")
		return "MOCK-" + id, base + "/orcamento/MOCK/itens", nil
	}

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
		onProgress("INJECTING_ITEMS", 40, fmt.Sprintf("Importando %d itens na planilha oficial do SEOBRA...", len(orc.Itens)))
	}

	excelBytes, err := GenerateSeobraExcel(orc)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate SEOBRA spreadsheet: %w", err)
	}
	if len(excelBytes) == 0 {
		return "", "", fmt.Errorf("generated SEOBRA spreadsheet is empty")
	}

	createdID, err := c.importPlanilhaSeobra(ctx, excelBytes, "orcamento_radar.xlsx", onProgress)
	if err != nil {
		return "", "", fmt.Errorf("failed to import SEOBRA spreadsheet: %w", err)
	}
	if createdID == "" {
		return "", "", fmt.Errorf("planilha importada, mas ID do orçamento não retornado")
	}

	if onProgress != nil {
		onProgress("COMPLETED", 100, fmt.Sprintf("Orçamento %s 100%% concluído e pronto para acesso!", createdID))
	}
	return createdID, fmt.Sprintf("%s/orcamento/%s/itens", baseClean, createdID), nil
}

// DispatchOrcamento wraps DispatchOrcamentoWithProgress without callback.
func (c *Client) DispatchOrcamento(ctx context.Context, orc *domain.Orcamento) (string, string, error) {
	return c.DispatchOrcamentoWithProgress(ctx, orc, nil)
}

func (c *Client) snapshotBudgetID(ctx context.Context, baseClean string) string {
	listReq, err := http.NewRequestWithContext(ctx, http.MethodGet, baseClean+"/orcamentos", nil)
	if err != nil {
		return ""
	}
	listResp, err := c.httpClient.Do(listReq)
	if err != nil {
		return ""
	}
	body, readErr := io.ReadAll(listResp.Body)
	_ = listResp.Body.Close()
	if readErr != nil || listResp.StatusCode >= 400 {
		return ""
	}
	return latestBudgetID(string(body))
}

type budgetListSnapshotKind uint8

const (
	budgetListSnapshotEmpty budgetListSnapshotKind = iota
	budgetListSnapshotFound
	budgetListSnapshotSessionInvalid
)

func (c *Client) snapshotBudgetIDWithoutRedirect(ctx context.Context, baseClean string) (string, budgetListSnapshotKind) {
	listReq, err := http.NewRequestWithContext(ctx, http.MethodGet, baseClean+"/orcamentos", nil)
	if err != nil {
		return "", budgetListSnapshotEmpty
	}

	listClient := *c.httpClient
	listClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}
	listResp, err := listClient.Do(listReq)
	if err != nil {
		return "", budgetListSnapshotEmpty
	}
	location := listResp.Header.Get("Location")
	body, readErr := io.ReadAll(listResp.Body)
	_ = listResp.Body.Close()
	if isSessionInvalidationRedirect(location) || isLoginHTML(string(body)) {
		return "", budgetListSnapshotSessionInvalid
	}
	if readErr != nil || listResp.StatusCode >= 400 || (listResp.StatusCode >= 300 && listResp.StatusCode < 400) {
		return "", budgetListSnapshotEmpty
	}
	if id := latestBudgetID(string(body)); id != "" {
		return id, budgetListSnapshotFound
	}
	return "", budgetListSnapshotEmpty
}

func (c *Client) newlyCreatedBudgetID(ctx context.Context, baseClean, baselineID string) string {
	if baselineID == "" {
		return ""
	}
	currentID := c.snapshotBudgetID(ctx, baseClean)
	if budgetIDIsGreater(currentID, baselineID) {
		return currentID
	}
	return ""
}

func (c *Client) reconcileProcessedImport(ctx context.Context, importURL, baselineID string) (string, error) {
	const reconcileWindow = 12 * time.Second
	const retryInterval = 500 * time.Millisecond

	if baselineID == "" {
		return "", errSeobraImportIDUnconfirmed
	}

	baseClean := strings.TrimSuffix(importURL, "/orcamento/importar")
	reconcileCtx, cancel := context.WithTimeout(ctx, reconcileWindow)
	defer cancel()
	reauthenticated := false
	for {
		currentID, snapshotKind := c.snapshotBudgetIDWithoutRedirect(reconcileCtx, baseClean)
		if budgetIDIsGreater(currentID, baselineID) {
			return currentID, nil
		}
		if snapshotKind == budgetListSnapshotSessionInvalid && !reauthenticated {
			c.mu.Lock()
			c.session = nil
			c.mu.Unlock()
			if _, err := c.Authenticate(reconcileCtx); err != nil {
				return "", fmt.Errorf("%w: reauthentication failed: %v", errSeobraImportIDUnconfirmed, err)
			}
			reauthenticated = true
			continue
		}
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		if reconcileCtx.Err() != nil {
			return "", errSeobraImportIDUnconfirmed
		}
		timer := time.NewTimer(retryInterval)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return "", ctx.Err()
		case <-reconcileCtx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return "", errSeobraImportIDUnconfirmed
		case <-timer.C:
		}
	}
}

func (c *Client) importPlanilhaSeobra(ctx context.Context, excelBytes []byte, filename string, onProgress ProgressCallback) (string, error) {
	baseClean := strings.TrimRight(c.config.URLBase, "/")
	importURL := fmt.Sprintf("%s/orcamento/importar", baseClean)
	baselineID := c.snapshotBudgetID(ctx, baseClean)

	getReq, err := http.NewRequestWithContext(ctx, "GET", importURL, nil)
	if err != nil {
		return "", err
	}
	getReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	getResp, err := c.httpClient.Do(getReq)
	if err != nil {
		return "", err
	}
	getHTML, err := io.ReadAll(getResp.Body)
	_ = getResp.Body.Close()
	if err != nil {
		return "", fmt.Errorf("failed to read import page: %w", err)
	}
	if getResp.StatusCode >= 400 {
		return "", fmt.Errorf("import page returned status %d", getResp.StatusCode)
	}

	viewState := extractFormularioViewState(string(getHTML))
	if viewState == "" {
		return "", fmt.Errorf("could not find ViewState on import form")
	}
	fileInputName := "formulario:j_idt2505_input"
	for _, tag := range reInputTag.FindAllString(string(getHTML), -1) {
		typeMatch := reInputType.FindStringSubmatch(tag)
		nameMatch := reInputName.FindStringSubmatch(tag)
		if len(typeMatch) > 1 && len(nameMatch) > 1 && strings.EqualFold(typeMatch[1], "file") {
			fileInputName = nameMatch[1]
			break
		}
	}
	componentName := strings.TrimSuffix(fileInputName, "_input")

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, field := range [][2]string{
		{"javax.faces.partial.ajax", "true"},
		{"javax.faces.partial.execute", componentName},
		{"javax.faces.partial.render", "formulario"},
		{"javax.faces.source", componentName},
		{"javax.faces.ViewState", viewState},
		{"formulario", "formulario"},
		{componentName, componentName},
	} {
		if err := writer.WriteField(field[0], field[1]); err != nil {
			return "", fmt.Errorf("failed to write upload field %s: %w", field[0], err)
		}
	}
	part, err := writer.CreateFormFile(componentName, filename)
	if err != nil {
		return "", fmt.Errorf("failed to create spreadsheet upload part: %w", err)
	}
	if _, err := part.Write(excelBytes); err != nil {
		return "", fmt.Errorf("failed to write spreadsheet upload: %w", err)
	}
	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to close spreadsheet upload: %w", err)
	}

	postReq, err := http.NewRequestWithContext(ctx, "POST", importURL, &body)
	if err != nil {
		return "", err
	}
	postReq.Header.Set("Content-Type", writer.FormDataContentType())
	postReq.Header.Set("Faces-Request", "partial/ajax")
	postReq.Header.Set("X-Requested-With", "XMLHttpRequest")
	postReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	postReq.Header.Set("Referer", importURL)

	postResp, err := c.httpClient.Do(postReq)
	if err != nil {
		return "", err
	}
	postBody, err := io.ReadAll(postResp.Body)
	_ = postResp.Body.Close()
	if err != nil {
		return "", fmt.Errorf("failed to read spreadsheet upload response: %w", err)
	}
	respText := string(postBody)
	if jsfHardError(respText) {
		return "", fmt.Errorf("%s", jsfErrorDetails(respText))
	}
	if postResp.StatusCode >= 400 {
		return "", fmt.Errorf("spreadsheet upload returned status %d", postResp.StatusCode)
	}
	if vs := extractFormularioViewState(respText); vs != "" {
		viewState = vs
	}
	if onProgress != nil && strings.Contains(respText, "Planilha aberta") {
		onProgress("INJECTING_ITEMS", 70, "Planilha aceita. Processando etapas e serviços...")
	}

	createdID, err := c.pollImportUntilDoneWithBaseline(ctx, importURL, viewState, onProgress, baselineID)
	if err != nil {
		if strings.Contains(err.Error(), "timeout waiting") {
			if fallbackID := c.newlyCreatedBudgetID(ctx, baseClean, baselineID); fallbackID != "" {
				return fallbackID, nil
			}
		}
		return "", err
	}
	if createdID == "" {
		createdID = c.newlyCreatedBudgetID(ctx, baseClean, baselineID)
		if createdID == "" {
			return "", fmt.Errorf("SEOBRA import finished without a newly-created budget ID")
		}
	}
	return createdID, nil
}

func (c *Client) pollImportUntilDone(ctx context.Context, importURL, viewState string, onProgress ProgressCallback) (string, error) {
	return c.pollImportUntilDoneWithBaseline(ctx, importURL, viewState, onProgress, "")
}

func (c *Client) pollImportUntilDoneWithBaseline(ctx context.Context, importURL, viewState string, onProgress ProgressCallback, baselineID string) (string, error) {
	deadline := time.Now().Add(240 * time.Second)
	pollClient := *c.httpClient
	pollClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(800 * time.Millisecond):
		}

		form := url.Values{}
		form.Set("javax.faces.partial.ajax", "true")
		form.Set("javax.faces.source", "formulario:pollProcessamento")
		form.Set("javax.faces.partial.execute", "formulario:pollProcessamento")
		form.Set("javax.faces.partial.render", "formulario:pollProcessamento formulario:panel-status")
		form.Set("formulario", "formulario")
		form.Set("formulario:pollProcessamento", "formulario:pollProcessamento")
		form.Set("javax.faces.ViewState", viewState)

		req, err := http.NewRequestWithContext(ctx, "POST", importURL, strings.NewReader(form.Encode()))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("Faces-Request", "partial/ajax")
		req.Header.Set("X-Requested-With", "XMLHttpRequest")
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		req.Header.Set("Referer", importURL)

		resp, err := pollClient.Do(req)
		if err != nil {
			return "", err
		}
		statusCode := resp.StatusCode
		location := resp.Header.Get("Location")
		raw, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		body := string(raw)
		if statusCode >= 300 && statusCode < 400 {
			if location == "" {
				return "", fmt.Errorf("SEOBRA import polling returned redirect status %d without Location", statusCode)
			}
			id, redirectErr := pollRedirectResult(location)
			c.clearSessionIfInvalidated(redirectErr)
			return id, redirectErr
		}
		if vs := extractFormularioViewState(body); vs != "" {
			viewState = vs
		}
		if jsfHardError(body) {
			return "", fmt.Errorf("%s", jsfErrorDetails(body))
		}
		if statusCode >= 400 {
			return "", fmt.Errorf("SEOBRA import polling returned status %d", statusCode)
		}
		if isLoginHTML(body) {
			return "", fmt.Errorf("SEOBRA session expired during import polling: login HTML returned")
		}
		if id, redirectErr, redirected := jsfPollRedirect(body); redirected {
			if redirectErr != nil {
				c.clearSessionIfInvalidated(redirectErr)
				return "", redirectErr
			}
			if onProgress != nil {
				onProgress("FINALIZING", 90, "Importação concluída no SEOBRA.")
			}
			return id, nil
		}
		if importHasProcessedPanel(body) {
			id, reconcileErr := c.reconcileProcessedImport(ctx, importURL, baselineID)
			if reconcileErr != nil {
				return "", reconcileErr
			}
			if onProgress != nil {
				onProgress("FINALIZING", 90, "Importação concluída no SEOBRA.")
			}
			return id, nil
		}
		if current, total, ok := importProgress(body); ok && onProgress != nil {
			percent := 70
			if total > 0 {
				percent += current * 18 / total
			}
			if percent < 70 {
				percent = 70
			}
			if percent > 88 {
				percent = 88
			}
			onProgress("INJECTING_ITEMS", percent, fmt.Sprintf("SEOBRA processando etapas e serviços: %d/%d", current, total))
		}
	}
	if fallbackID := c.newlyCreatedBudgetID(ctx, strings.TrimSuffix(importURL, "/orcamento/importar"), baselineID); fallbackID != "" {
		return fallbackID, nil
	}
	return "", fmt.Errorf("timeout waiting for SEOBRA import to finish")
}

// DownloadPlanilha downloads the spreadsheet stored by SEOBRA, if available.
func (c *Client) DownloadPlanilha(ctx context.Context, budgetID string) ([]byte, error) {
	sess, err := c.EnsureActiveSession(ctx)
	if err != nil {
		return nil, fmt.Errorf("falha ao autenticar no SEOBRA: %w", err)
	}

	base := strings.TrimRight(sess.URLBase, "/")
	id := url.PathEscape(budgetID)
	paths := []string{
		fmt.Sprintf("%s/orcamento/%s/exportar", base, id),
		fmt.Sprintf("%s/orcamento/%s/planilha", base, id),
		fmt.Sprintf("%s/orcamento/%s/download", base, id),
		fmt.Sprintf("%s/orcamento/%s.xlsx", base, id),
	}
	var lastErr error
	for _, downloadURL := range paths {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		body, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}
		contentType := strings.ToLower(resp.Header.Get("Content-Type"))
		if resp.StatusCode == http.StatusOK && (bytes.HasPrefix(body, []byte("PK")) || strings.Contains(contentType, "spreadsheet") || strings.Contains(contentType, "excel")) {
			return body, nil
		}
		lastErr = fmt.Errorf("SEOBRA download returned status %d from %s", resp.StatusCode, downloadURL)
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("no SEOBRA spreadsheet download succeeded")
	}
	return nil, fmt.Errorf("failed to download SEOBRA spreadsheet for budget %s: %w", budgetID, lastErr)
}
