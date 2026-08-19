package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/pncp"
	"github.com/construmar/radar-licitacoes-backend/internal/repository"
	"github.com/construmar/radar-licitacoes-backend/internal/service"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

func main() {
	tursoURL := os.Getenv("TURSO_DB_URL")
	if tursoURL == "" {
		log.Fatal("TURSO_DB_URL environment variable is required (libsql:// URL with authToken)")
	}

	db, err := repository.InitDB(tursoURL)
	if err != nil {
		log.Fatalf("InitDB Turso error: %v", err)
	}
	defer db.Close()

	oppRepo := repository.NewOpportunityRepository(db)
	pncpClient := pncp.NewClient("https://pncp.gov.br/api/consulta", 60*time.Second)
	syncService := service.NewSyncService(oppRepo, pncpClient)

	fmt.Println("Syncing PNCP Ceará directly into Turso cloud database...")
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	run, err := syncService.RunSync(ctx, "CE", 900000.0)
	if err != nil {
		log.Fatalf("Sync error: %v", err)
	}

	fmt.Printf("SUCCESS: Turso populated! Received: %d, InScope: %d, Reviewed: %d, Excluded: %d\n",
		run.TotalReceived, run.TotalIncluded, run.TotalReviewed, run.TotalExcluded)

	var count int
	_ = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM licitacao_oportunidade WHERE is_archived = 0").Scan(&count)
	fmt.Printf("Total active in Turso: %d\n", count)
}
