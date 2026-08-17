package repository

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

func InitDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(wal)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	if err := createTables(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to create database tables: %w", err)
	}

	return db, nil
}

func createTables(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS licitacao_oportunidade (
		id TEXT PRIMARY KEY,
		source TEXT NOT NULL,
		source_external_id TEXT NOT NULL,
		organization_cnpj TEXT NOT NULL,
		organization_name TEXT NOT NULL,
		unit_name TEXT NOT NULL,
		municipality_name TEXT NOT NULL,
		municipality_ibge_code TEXT,
		uf TEXT NOT NULL,
		purchase_number TEXT,
		purchase_year INTEGER,
		modality_name TEXT,
		dispute_mode_name TEXT,
		status_source TEXT NOT NULL,
		status_normalized TEXT NOT NULL,
		object_raw TEXT NOT NULL,
		object_normalized TEXT NOT NULL,
		estimated_total_value REAL,
		value_status TEXT NOT NULL,
		proposal_start_at DATETIME,
		proposal_end_at DATETIME,
		published_at DATETIME,
		source_updated_at DATETIME,
		classification TEXT NOT NULL,
		classification_score REAL NOT NULL,
		classification_terms TEXT NOT NULL,
		classifier_version TEXT NOT NULL,
		source_url TEXT NOT NULL,
		last_seen_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		UNIQUE(source, source_external_id)
	);

	CREATE INDEX IF NOT EXISTS idx_opp_query ON licitacao_oportunidade(uf, status_normalized, estimated_total_value);
	CREATE INDEX IF NOT EXISTS idx_opp_deadline ON licitacao_oportunidade(proposal_end_at);
	CREATE INDEX IF NOT EXISTS idx_opp_classification ON licitacao_oportunidade(classification);
	CREATE INDEX IF NOT EXISTS idx_opp_last_seen ON licitacao_oportunidade(last_seen_at);

	CREATE TABLE IF NOT EXISTS licitacao_documento (
		id TEXT PRIMARY KEY,
		opportunity_id TEXT NOT NULL,
		title TEXT NOT NULL,
		doc_type TEXT NOT NULL,
		url TEXT NOT NULL,
		source_doc_id TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY(opportunity_id) REFERENCES licitacao_oportunidade(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_doc_opportunity ON licitacao_documento(opportunity_id);

	CREATE TABLE IF NOT EXISTS licitacao_payload_snapshot (
		id TEXT PRIMARY KEY,
		opportunity_id TEXT NOT NULL,
		resource_type TEXT NOT NULL,
		raw_json TEXT NOT NULL,
		payload_hash TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		FOREIGN KEY(opportunity_id) REFERENCES licitacao_oportunidade(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_snapshot_opportunity ON licitacao_payload_snapshot(opportunity_id);

	CREATE TABLE IF NOT EXISTS licitacao_sync_run (
		id TEXT PRIMARY KEY,
		source TEXT NOT NULL,
		started_at DATETIME NOT NULL,
		finished_at DATETIME,
		status TEXT NOT NULL,
		parameters TEXT NOT NULL,
		total_received INTEGER NOT NULL,
		total_included INTEGER NOT NULL,
		total_reviewed INTEGER NOT NULL,
		total_excluded INTEGER NOT NULL,
		total_updated INTEGER NOT NULL,
		total_failed INTEGER NOT NULL,
		error_message TEXT,
		correlation_id TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_sync_started_at ON licitacao_sync_run(started_at DESC);
	`

	_, err := db.Exec(schema)
	return err
}
