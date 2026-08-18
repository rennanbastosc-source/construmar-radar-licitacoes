package seobra

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
)

func TestImportPlanilhaUsesPrimeFacesComponentFileName(t *testing.T) {
	var fileNames []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/orcamento/importar" {
			http.NotFound(w, r)
			return
		}

		if r.Method == http.MethodGet {
			w.Header().Set("Content-Type", "text/html")
			_, _ = fmt.Fprint(w, `<form id="formulario"><input name="javax.faces.ViewState" value="view-state"><input type="file" name="formulario:j_idt2505_input"></form>`)
			return
		}

		if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/") {
			if err := r.ParseMultipartForm(1 << 20); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			for name := range r.MultipartForm.File {
				fileNames = append(fileNames, name)
			}
			w.Header().Set("Content-Type", "text/xml")
			_, _ = fmt.Fprint(w, `<partial-response><changes><update id="mensagem">Planilha aberta corretamente</update></changes></partial-response>`)
			return
		}

		w.Header().Set("Content-Type", "text/xml")
		_, _ = fmt.Fprint(w, `<partial-response><redirect url="/seobra2/orcamento/123/itens"></redirect></partial-response>`)
	}))
	defer server.Close()

	client := NewClient(nil)
	client.config.URLBase = server.URL
	client.httpClient = server.Client()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	id, err := client.importPlanilhaSeobra(ctx, []byte("PK-test"), "orcamento.xlsx", nil)
	if err != nil {
		t.Fatalf("importPlanilhaSeobra failed: %v", err)
	}
	if id != "123" {
		t.Fatalf("budget ID = %q, want 123", id)
	}

	foundComponent := false
	for _, name := range fileNames {
		if name == "formulario:j_idt2505" {
			foundComponent = true
		}
		if name == "formulario:j_idt2505_input" {
			t.Fatalf("browser input name was used as upload part")
		}
	}
	if !foundComponent {
		t.Fatalf("upload file part %q was not sent; got %v", "formulario:j_idt2505", fileNames)
	}
}

func TestJSFErrorDetails(t *testing.T) {
	body := `<partial-response><error><error-name>class java.lang.NullPointerException</error-name><error-message><![CDATA[Cannot invoke "javax.servlet.http.Part.getSize()" because "this.part" is null]]></error-message></error></partial-response>`
	if !jsfHardError(body) {
		t.Fatal("expected JSF error to be detected")
	}
	details := jsfErrorDetails(body)
	for _, want := range []string{"NullPointerException", "Part.getSize"} {
		if !strings.Contains(details, want) {
			t.Errorf("JSF error details %q do not contain %q", details, want)
		}
	}
}

func TestJSFSuccessDoesNotTriggerHardError(t *testing.T) {
	body := `<partial-response><changes><update id="mensagem">Planilha aberta corretamente</update></changes></partial-response>`
	if jsfHardError(body) {
		t.Fatal("successful JSF response was treated as an error")
	}
}

func newPollTestClient(t *testing.T, handler http.Handler) (*Client, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(handler)
	client := NewClient(nil)
	client.config.URLBase = server.URL
	client.httpClient = server.Client()
	return client, server
}

func assertSessionInvalidationError(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("expected session invalidation error")
	}
	for _, want := range []string{
		"session invalidated",
		"another session/computer",
		"close the other session",
		"check seobra",
		"before dispatching again",
	} {
		if !strings.Contains(strings.ToLower(err.Error()), want) {
			t.Errorf("error %q does not contain %q", err, want)
		}
	}
}

func TestPollJSFSessionInvalidationRedirects(t *testing.T) {
	for _, location := range []string{"/seobra2/login", "/seobra2/entrar?jsessionid=stale"} {
		t.Run(location, func(t *testing.T) {
			client, server := newPollTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = fmt.Fprintf(w, `<partial-response><redirect url="%s"></redirect></partial-response>`, location)
			}))
			defer server.Close()
			client.session = &domain.SeobraSession{IsActive: true}

			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			started := time.Now()
			_, err := client.pollImportUntilDone(ctx, server.URL+"/orcamento/importar", "view-state", nil)
			assertSessionInvalidationError(t, err)
			if client.session != nil {
				t.Fatal("session was not cleared after invalidating JSF redirect")
			}
			if elapsed := time.Since(started); elapsed >= 2*time.Second {
				t.Fatalf("session invalidation redirect was not handled promptly: %s", elapsed)
			}
		})
	}
}

func TestPollJSFBudgetRedirectReturnsID(t *testing.T) {
	client, server := newPollTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprint(w, `<partial-response><redirect url="/seobra2/orcamento/123/itens"></redirect></partial-response>`)
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	id, err := client.pollImportUntilDone(ctx, server.URL+"/orcamento/importar", "view-state", nil)
	if err != nil {
		t.Fatalf("budget redirect failed: %v", err)
	}
	if id != "123" {
		t.Fatalf("budget ID = %q, want 123", id)
	}
}

func TestPollProcessedPanelReconcilesNewBudgetID(t *testing.T) {
	listCalls := 0
	client, server := newPollTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/orcamento/importar":
			_, _ = fmt.Fprint(w, `<partial-response><changes><update id="formulario:panel-status"><div class="ui-outputpanel ui-widget col-12 PROCESSADO" id="formulario:panel-status"></div></update></changes></partial-response>`)
		case r.Method == http.MethodGet && r.URL.Path == "/orcamentos":
			listCalls++
			if listCalls == 1 {
				_, _ = fmt.Fprint(w, `<a href="/seobra2/orcamento/41/itens">baseline</a>`)
				return
			}
			_, _ = fmt.Fprint(w, `<a href="/seobra2/orcamento/41/itens">baseline</a><a href="/seobra2/orcamento/42/itens">new</a>`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	var progressStep string
	var progressPercent int
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	id, err := client.pollImportUntilDoneWithBaseline(ctx, server.URL+"/orcamento/importar", "view-state", func(step string, percent int, _ string) {
		progressStep, progressPercent = step, percent
	}, "41")
	if err != nil {
		t.Fatalf("processed panel polling failed: %v", err)
	}
	if id != "42" {
		t.Fatalf("budget ID = %q, want 42", id)
	}
	if progressStep != "FINALIZING" || progressPercent != 90 {
		t.Fatalf("unexpected final progress: %q %d", progressStep, progressPercent)
	}
	if listCalls < 2 {
		t.Fatalf("list eventual-consistency retry did not occur; calls = %d", listCalls)
	}
}

func TestPollProcessedPanelReauthenticatesListWithoutReupload(t *testing.T) {
	var listCalls int
	var loginGETCalls int
	var loginPOSTCalls int
	var followedLoginRedirects int
	var uploadCalls int
	client, server := newPollTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/orcamento/importar":
			if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/") {
				uploadCalls++
				http.Error(w, "upload must not be retried", http.StatusInternalServerError)
				return
			}
			_, _ = fmt.Fprint(w, `<partial-response><changes><update id="formulario:panel-status"><div id="formulario:panel-status" class="ui-outputpanel processado"></div></update></changes></partial-response>`)
		case r.Method == http.MethodGet && r.URL.Path == "/orcamentos":
			listCalls++
			if listCalls == 1 {
				w.Header().Set("Location", "/seobra2/login")
				w.WriteHeader(http.StatusFound)
				return
			}
			_, _ = fmt.Fprint(w, `<a href="/seobra2/orcamento/43/itens">new budget</a>`)
		case r.Method == http.MethodGet && r.URL.Path == "/seobra2/login":
			followedLoginRedirects++
			_, _ = fmt.Fprint(w, `<html><input name="loginInput"><input name="senhaInput"></html>`)
		case r.Method == http.MethodGet && r.URL.Path == "/login":
			loginGETCalls++
			_, _ = fmt.Fprint(w, `<form><input name="javax.faces.ViewState" value="reauth-state"></form>`)
		case r.Method == http.MethodPost && r.URL.Path == "/login":
			loginPOSTCalls++
			_, _ = fmt.Fprint(w, `<html>authenticated</html>`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	client.session = &domain.SeobraSession{IsActive: true}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	id, err := client.pollImportUntilDoneWithBaseline(ctx, server.URL+"/orcamento/importar", "view-state", nil, "42")
	if err != nil {
		t.Fatalf("processed panel reauthentication failed: %v", err)
	}
	if id != "43" {
		t.Fatalf("budget ID = %q, want 43", id)
	}
	if loginGETCalls != 1 || loginPOSTCalls != 1 {
		t.Fatalf("reauthentication calls = GET %d, POST %d, want one each", loginGETCalls, loginPOSTCalls)
	}
	if followedLoginRedirects != 0 {
		t.Fatalf("list snapshot followed login redirect %d time(s)", followedLoginRedirects)
	}
	if uploadCalls != 0 {
		t.Fatalf("upload endpoint was retried %d time(s)", uploadCalls)
	}
}

func TestPollHTTPRedirects(t *testing.T) {
	tests := []struct {
		name     string
		location string
		absolute bool
		wantID   string
		wantErr  bool
	}{
		{name: "budget", location: "/seobra2/orcamento/456/itens", wantID: "456"},
		{name: "login", location: "/seobra2/login", wantErr: true},
		{name: "entrar", location: "/seobra2/entrar?session=stale", wantErr: true},
		{name: "absolute entrar", location: "/seobra2/entrar?session=stale", absolute: true, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, server := newPollTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				location := tt.location
				if tt.absolute {
					location = "http://" + r.Host + tt.location
				}
				w.Header().Set("Location", location)
				w.WriteHeader(http.StatusFound)
			}))
			defer server.Close()
			client.session = &domain.SeobraSession{IsActive: true}
			initialSession := client.session

			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			id, err := client.pollImportUntilDone(ctx, server.URL+"/orcamento/importar", "view-state", nil)
			if tt.wantErr {
				assertSessionInvalidationError(t, err)
				if client.session != nil {
					t.Fatal("session was not cleared after invalidating HTTP redirect")
				}
				return
			}
			if err != nil || id != tt.wantID {
				t.Fatalf("budget redirect = id %q err %v, want id %q", id, err, tt.wantID)
			}
			if client.session != initialSession {
				t.Fatal("budget redirect unexpectedly cleared the session")
			}
		})
	}
}

func TestPollProgressDoesNotCompleteWhileProcessing(t *testing.T) {
	var progressStep string
	var progressPercent int
	var progressMessage string
	client, server := newPollTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprint(w, `<partial-response><changes><update id="status">Processando 29 / 36</update></changes></partial-response>`)
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 950*time.Millisecond)
	defer cancel()
	_, err := client.pollImportUntilDone(ctx, server.URL+"/orcamento/importar", "view-state", func(step string, percent int, message string) {
		progressStep, progressPercent, progressMessage = step, percent, message
	})
	if err == nil {
		t.Fatal("processing response unexpectedly completed")
	}
	if progressStep != "INJECTING_ITEMS" || progressPercent < 70 || progressPercent > 88 || progressMessage != "SEOBRA processando etapas e serviços: 29/36" {
		t.Fatalf("unexpected processing progress: %q %d %q", progressStep, progressPercent, progressMessage)
	}
}

func TestPollProcessedChromeDoesNotComplete(t *testing.T) {
	client, server := newPollTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprint(w, `<partial-response><changes><update id="status">concluirDownload Processado</update></changes></partial-response>`)
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 950*time.Millisecond)
	defer cancel()
	id, err := client.pollImportUntilDone(ctx, server.URL+"/orcamento/importar", "view-state", nil)
	if err == nil || id != "" {
		t.Fatalf("processed chrome falsely completed: id=%q err=%v", id, err)
	}
}

func TestPartialViewStateWinsOverFormViewState(t *testing.T) {
	html := `<partial-response><changes><update id="j_id1:javax.faces.ViewState:0"><![CDATA[new-state]]></update></changes></partial-response><form id="formulario"><input name="javax.faces.ViewState" value="stale-state"></form>`
	if got := extractFormularioViewState(html); got != "new-state" {
		t.Fatalf("ViewState = %q, want new-state", got)
	}
}
