package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/ai"
	"github.com/construmar/radar-licitacoes-backend/internal/api"
	"github.com/construmar/radar-licitacoes-backend/internal/config"
	"github.com/construmar/radar-licitacoes-backend/internal/pncp"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
	"github.com/construmar/radar-licitacoes-backend/internal/seobra"
	"github.com/construmar/radar-licitacoes-backend/internal/service"
)

func main() {
	cfg := config.LoadConfig()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Fatal: invalid configuration: %v", err)
	}

	log.Printf("=====================================================")
	log.Printf("  CONSTRUMAR — Radar de Licitações MVP PNCP (Go)     ")
	log.Printf("=====================================================")
	log.Printf("Port: %s | DB: %s | MinValue: R$ %.2f | UF: %s", cfg.Port, cfg.DBPath, cfg.MinEstimatedValue, cfg.DefaultUF)

	// 1. Initialize SQLite database
	db, err := repository.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Fatal: Database initialization error: %v", err)
	}
	defer db.Close()

	// 2. Initialize Repositories and Clients
	oppRepo := repository.NewOpportunityRepository(db)
	orcRepo := repository.NewOrcamentoRepository(db)
	pncpClient := pncp.NewClient(cfg.PNCPBaseURL, 60*time.Second)
	aiExtractor := ai.NewAIExtractor(cfg.AIAPIURL, cfg.AIAPIKey, cfg.AIModel)
	seobraClient := seobra.NewClient(orcRepo)

	// 3. Initialize Services
	syncService := service.NewSyncService(oppRepo, pncpClient)
	oppService := service.NewOpportunityService(oppRepo)
	orcService := service.NewOrcamentoService(orcRepo, aiExtractor, seobraClient)

	// 4. Initialize Handlers and Router
	oppHandler := api.NewOpportunityHandler(oppService)
	syncHandler := api.NewSyncHandler(syncService, oppService)
	orcHandler := api.NewOrcamentoHandler(orcService, seobraClient)
	router := api.NewRouter(oppHandler, syncHandler, orcHandler, cfg.APIAuthToken, cfg.CORSAllowedOrigins)

	// 5. Periodic Background Sync (optional ticker)
	if cfg.SyncIntervalHours > 0 {
		ticker := time.NewTicker(time.Duration(cfg.SyncIntervalHours) * time.Hour)
		go func() {
			for range ticker.C {
				log.Printf("[Scheduler] Triggering scheduled sync for UF=%s...", cfg.DefaultUF)
				ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
				_, _ = syncService.RunSync(ctx, cfg.DefaultUF, cfg.MinEstimatedValue)
				cancel()
			}
		}()
	}

	// 6. HTTP Server (Configured for large AI document extraction & multimodal uploads)
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  180 * time.Second,
		WriteTimeout: 300 * time.Second,
		IdleTimeout:  300 * time.Second,
	}

	go func() {
		log.Printf("Backend API listening on http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// 7. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced shutdown: %v", err)
	}

	fmt.Println("Server exited properly.")
}
