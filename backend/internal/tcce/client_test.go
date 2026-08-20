package tcce

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestClientFetchesTCCE(t *testing.T) {
	openBody, err := os.ReadFile("testdata/abertas.html")
	if err != nil {
		t.Fatal(err)
	}
	detailBody, err := os.ReadFile("testdata/detalhes.html")
	if err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/index.php/licitacao/abertas":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(openBody)
		case "/index.php/licitacao/detalhes/proc/268767/licit/187006":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(detailBody)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewClient(0)
	client.BaseURL = server.URL
	client.MaxRetries = 0

	items, err := client.FetchAbertas(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) < 40 || items[0].Number != "005/2026-CE" {
		t.Fatalf("unexpected list response: len=%d first=%q", len(items), items[0].Number)
	}

	detail, err := client.FetchDetalhes(t.Context(), "268767", "187006")
	if err != nil {
		t.Fatal(err)
	}
	if detail.Number != "005/2026-CE" || !strings.Contains(detail.Local, "compras.m2atecnologia") {
		t.Fatalf("unexpected detail response: number=%q local=%q", detail.Number, detail.Local)
	}
}
