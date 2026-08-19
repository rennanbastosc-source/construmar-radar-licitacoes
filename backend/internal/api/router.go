package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(oppHandler *OpportunityHandler, syncHandler *SyncHandler, orcHandler *OrcamentoHandler, apiAuthToken string, allowedOrigins []string) http.Handler {
	r := chi.NewRouter()

	// Standard middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// CORS is restricted to the explicitly configured origins. An empty list
	// intentionally installs no CORS middleware, which fails closed.
	if origins := explicitOrigins(allowedOrigins); len(origins) > 0 {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   origins,
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"},
			ExposedHeaders:   []string{"Link", "X-Request-ID"},
			AllowCredentials: false,
			MaxAge:           300,
		}))
	}

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "UP",
			"app":    "Radar de Licitações PNCP & Orçamentos SEOBRA",
		})
	})

	r.Route("/api", func(r chi.Router) {
		r.Use(bearerAuth(apiAuthToken))

		// Licitações API
		r.Route("/licitacoes", func(r chi.Router) {
			r.Get("/oportunidades", oppHandler.ListOpportunities)
			r.Get("/oportunidades/{id}", oppHandler.GetOpportunityDetail)
			r.Get("/stats", oppHandler.GetStatsOverview)

			r.Post("/sync", syncHandler.TriggerSync)
			r.Get("/sync/status", syncHandler.GetSyncStatus)
			r.Get("/sync/history", syncHandler.ListSyncHistory)
			r.Get("/pncp-health", syncHandler.GetPncpHealth)
		})

		// Orçamentos Inteligentes & SEOBRA API
		if orcHandler != nil {
			r.Route("/orcamentos", func(r chi.Router) {
				r.Post("/upload", orcHandler.UploadDocument)
				r.Get("/", orcHandler.ListOrcamentos)
				r.Get("/{id}", orcHandler.GetOrcamento)
				r.Get("/{id}/exportar-seobra-xlsx", orcHandler.ExportSeobraXLSX)
				r.Put("/{id}/itens", orcHandler.UpdateItens)
				r.Post("/{id}/despachar-seobra", orcHandler.DespacharSeobra)
			})

			r.Route("/seobra", func(r chi.Router) {
				r.Get("/status", orcHandler.SeobraStatus)
			})
		}
	})

	return r
}

func explicitOrigins(origins []string) []string {
	allowed := make([]string, 0, len(origins))
	for _, origin := range origins {
		origin = strings.TrimSpace(origin)
		if origin == "" || strings.Contains(origin, "*") {
			continue
		}
		allowed = append(allowed, origin)
	}
	return allowed
}

func bearerAuth(expectedToken string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !validBearerToken(r.Header.Get("Authorization"), expectedToken) {
				w.Header().Set("WWW-Authenticate", "Bearer")
				http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func validBearerToken(header, expectedToken string) bool {
	if strings.TrimSpace(expectedToken) == "" {
		return false
	}

	scheme, providedToken, ok := strings.Cut(header, " ")
	if !ok || scheme != "Bearer" || providedToken == "" || strings.ContainsAny(providedToken, " \t\r\n") {
		return false
	}

	expectedDigest := sha256.Sum256([]byte(expectedToken))
	providedDigest := sha256.Sum256([]byte(providedToken))
	return subtle.ConstantTimeCompare(expectedDigest[:], providedDigest[:]) == 1
}
