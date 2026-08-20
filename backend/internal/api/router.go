package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// ipRateLimiter implements a token-bucket rate limiter per IP address
type ipRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int           // requests allowed per window
	window   time.Duration // time window
}

type visitor struct {
	lastSeen time.Time
	tokens   int
}

func newIPRateLimiter(rate int, window time.Duration) *ipRateLimiter {
	limiter := &ipRateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		window:   window,
	}

	// Periodically cleanup old visitors
	go func() {
		for {
			time.Sleep(limiter.window * 2)
			limiter.mu.Lock()
			for ip, v := range limiter.visitors {
				if time.Since(v.lastSeen) > limiter.window*3 {
					delete(limiter.visitors, ip)
				}
			}
			limiter.mu.Unlock()
		}
	}()

	return limiter
}

func (l *ipRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// ponytail: /health is exempt — Render's probes (every 5s from one IP)
		// would otherwise lock the bucket and mark the service unhealthy
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}

		l.mu.Lock()
		v, exists := l.visitors[ip]
		now := time.Now()
		if !exists || now.Sub(v.lastSeen) > l.window {
			l.visitors[ip] = &visitor{lastSeen: now, tokens: 1}
			l.mu.Unlock()
			next.ServeHTTP(w, r)
			return
		}

		if v.tokens >= l.rate {
			l.mu.Unlock()
			http.Error(w, `{"error":"Too Many Requests: limite de requisições excedido. Tente novamente em instantes."}`, http.StatusTooManyRequests)
			return
		}

		v.tokens++
		v.lastSeen = now
		l.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}

func NewRouter(
	oppHandler *OpportunityHandler,
	syncHandler *SyncHandler,
	orcHandler *OrcamentoHandler,
	editalHandler *EditalHandler,
	apiAuthToken string,
	allowedOrigins []string,
) http.Handler {
	r := chi.NewRouter()

	// Rate limiter: 120 requests per minute per IP
	apiLimiter := newIPRateLimiter(120, time.Minute)

	// Standard middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(apiLimiter.Middleware)

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

	// Health check with active database ping
	r.Get("/health", oppHandler.HealthCheck)

	r.Route("/api", func(r chi.Router) {
		r.Use(bearerAuth(apiAuthToken))

		// Licitações API
		r.Route("/licitacoes", func(r chi.Router) {
			r.Get("/oportunidades", oppHandler.ListOpportunities)
			r.Get("/oportunidades/{id}", oppHandler.GetOpportunityDetail)
			r.Get("/oportunidades/{id}/origem", oppHandler.GetOpportunityOrigin)
			r.Post("/oportunidades/{id}/auditar-edital", oppHandler.DirectAuditEdital)
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

		// Analista IA de Editais API
		if editalHandler != nil {
			r.Route("/editais", func(r chi.Router) {
				r.Post("/analisar", editalHandler.UploadAndAnalyze)
				r.Get("/", editalHandler.ListAnalyses)
				r.Get("/{id}", editalHandler.GetAnalysis)
				r.Put("/checklist/{itemId}", editalHandler.ToggleChecklist)
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
			if strings.TrimSpace(expectedToken) == "" {
				next.ServeHTTP(w, r)
				return
			}

			// Read-only dashboard queries and OPTIONS preflight are served directly
			if r.Method == http.MethodGet || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Allow direct 1-click edital audit requests from frontend UI
			if r.Method == http.MethodPost && strings.Contains(r.URL.Path, "/auditar-edital") {
				next.ServeHTTP(w, r)
				return
			}

			authHeader := r.Header.Get("Authorization")
			if authHeader != "" && validBearerToken(authHeader, expectedToken) {
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Set("WWW-Authenticate", "Bearer")
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
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
