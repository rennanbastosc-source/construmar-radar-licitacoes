package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

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

	oppRepo := repository.NewOpportunityRepository(db)
	oppService := service.NewOpportunityService(oppRepo)
	oppHandler := NewOpportunityHandler(oppService)
	syncHandler := NewSyncHandler(service.NewSyncService(oppRepo, nil), oppService)
	router := NewRouter(oppHandler, syncHandler, nil, nil, apiToken, []string{"http://localhost:3000"})

	tests := []struct {
		name   string
		path   string
		header string
		want   int
	}{
		{name: "health is public", path: "/health", want: http.StatusOK},
		{name: "api without token", path: "/api/licitacoes/oportunidades", want: http.StatusUnauthorized},
		{name: "api with incorrect token", path: "/api/licitacoes/oportunidades", header: "Bearer wrong-token", want: http.StatusUnauthorized},
		{name: "api with correct token reaches handler", path: "/api/licitacoes/oportunidades", header: "Bearer " + apiToken, want: http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
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
