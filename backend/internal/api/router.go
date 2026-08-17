package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(oppHandler *OpportunityHandler, syncHandler *SyncHandler) http.Handler {
	r := chi.NewRouter()

	// Standard middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Permissive CORS for development & API consumption
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowOriginFunc:  func(r *http.Request, origin string) bool { return true },
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"},
		ExposedHeaders:   []string{"Link", "X-Request-ID"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "UP",
			"app":    "Radar de Licitações PNCP",
		})
	})

	// Licitações API
	r.Route("/api/licitacoes", func(r chi.Router) {
		r.Get("/oportunidades", oppHandler.ListOpportunities)
		r.Get("/oportunidades/{id}", oppHandler.GetOpportunityDetail)
		r.Get("/stats", oppHandler.GetStatsOverview)

		r.Post("/sync", syncHandler.TriggerSync)
		r.Get("/sync/status", syncHandler.GetSyncStatus)
		r.Get("/sync/history", syncHandler.ListSyncHistory)
	})

	return r
}
