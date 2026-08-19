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
	editalRepo := repository.NewEditalRepository(db)
	pncpClient := pncp.NewClient(cfg.PNCPBaseURL, 60*time.Second)
	aiExtractor := ai.NewAIExtractor(cfg.AIAPIURL, cfg.AIAPIKey, cfg.AIModel)
	editalAnalyst := ai.NewEditalAIAnalyst(cfg.AIAPIURL, cfg.AIAPIKey, cfg.AIModel)
	seobraClient := seobra.NewClient(orcRepo)

	// 3. Initialize Services
	syncService := service.NewSyncService(oppRepo, pncpClient)
	oppService := service.NewOpportunityService(oppRepo)
	orcService := service.NewOrcamentoService(orcRepo, aiExtractor, seobraClient)
	editalService := service.NewEditalService(editalRepo, editalAnalyst)

	// 4. Initialize Handlers and Router
	oppHandler := api.NewOpportunityHandler(oppService, editalService)
	syncHandler := api.NewSyncHandler(syncService, oppService)
	orcHandler := api.NewOrcamentoHandler(orcService, seobraClient)
	editalHandler := api.NewEditalHandler(editalService)
	router := api.NewRouter(oppHandler, syncHandler, orcHandler, editalHandler, cfg.APIAuthToken, cfg.CORSAllowedOrigins)

	// 5. Auto-Warmup: Immediately populate database if empty on startup
	go func() {
		time.Sleep(1 * time.Second)
		warmCtx, warmCancel := context.WithTimeout(context.Background(), 10*time.Second)
		stats, err := oppRepo.GetStatsOverview(warmCtx, cfg.DefaultUF, cfg.MinEstimatedValue)
		warmCancel()

		if err == nil && stats != nil && stats.TotalOpportunities == 0 {
			log.Printf("[Auto-Warmup] Database has 0 active opportunities for UF=%s. Triggering initial PNCP sync in background...", cfg.DefaultUF)
			syncCtx, syncCancel := context.WithTimeout(context.Background(), 20*time.Minute)
			defer syncCancel()
			if _, syncErr := syncService.RunSync(syncCtx, cfg.DefaultUF, cfg.MinEstimatedValue); syncErr != nil {
				log.Printf("[Auto-Warmup Warning] Initial sync encountered issue: %v", syncErr)
			} else {
				log.Printf("[Auto-Warmup Success] Initial database population completed successfully!")
			}
		} else if err == nil && stats != nil {
			log.Printf("[Auto-Warmup] Database already populated with %d active opportunities.", stats.TotalOpportunities)
		}
	}()

	// 6. Periodic Background Sync (Daily fallback scheduler aligned with 12:00 PM UTC-3)
	if cfg.SyncIntervalHours > 0 {
		go func() {
			for {
				now := time.Now().UTC()
				// 12:00 PM UTC-3 is 15:00 UTC
				nextSync := time.Date(now.Year(), now.Month(), now.Day(), 15, 0, 0, 0, time.UTC)
				if !now.Before(nextSync) {
					nextSync = nextSync.Add(24 * time.Hour)
				}
				sleepDuration := time.Until(nextSync)
				log.Printf("[Scheduler] Next internal daily sync scheduled for %s (in %v)", nextSync.Format(time.RFC3339), sleepDuration.Round(time.Minute))
				time.Sleep(sleepDuration)

				log.Printf("[Scheduler] Triggering daily scheduled sync (12:00 PM UTC-3) for UF=%s...", cfg.DefaultUF)
				ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
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
