package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/pncp"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
	"github.com/construmar/radar-licitacoes-backend/internal/service"
)

func TestRouterBearerAuthAndHealth(t *testing.T) {
	const apiToken = "test-shared-token"
	t.Setenv("API_AUTH_TOKEN", apiToken)
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

	db, err := repository.InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	db.SetMaxOpenConns(1)
	defer db.Close()

	pncpClient := pncp.NewClient("http://127.0.0.1:0", 100*time.Millisecond)
	oppRepo := repository.NewOpportunityRepository(db)
	oppService := service.NewOpportunityService(oppRepo)
	oppHandler := NewOpportunityHandler(oppService, nil)
	syncHandler := NewSyncHandler(service.NewSyncService(oppRepo, pncpClient, nil), oppService)
	router := NewRouter(oppHandler, syncHandler, nil, nil, apiToken, []string{"http://localhost:3000"})

	tests := []struct {
		name   string
		path   string
		method string
		header string
		want   int
	}{
		{name: "health is public", path: "/health", method: http.MethodGet, want: http.StatusOK},
		{name: "public read opportunities", path: "/api/licitacoes/oportunidades", method: http.MethodGet, want: http.StatusOK},
		{name: "public read stats", path: "/api/licitacoes/stats", method: http.MethodGet, want: http.StatusOK},
		{name: "protected sync without token", path: "/api/licitacoes/sync", method: http.MethodPost, want: http.StatusUnauthorized},
		{name: "protected sync with incorrect token", path: "/api/licitacoes/sync", method: http.MethodPost, header: "Bearer wrong-token", want: http.StatusUnauthorized},
		{name: "protected sync with correct token reaches handler", path: "/api/licitacoes/sync", method: http.MethodPost, header: "Bearer " + apiToken, want: http.StatusAccepted},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			method := tt.method
			if method == "" {
				method = http.MethodGet
			}
			req := httptest.NewRequest(method, tt.path, nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != tt.want {
				t.Fatalf("expected status %d, got %d: %s", tt.want, rec.Code, rec.Body.String())
			}
		})
	}
}
