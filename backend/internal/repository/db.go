package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
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
	if err := migrateDedup(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to migrate deduplication: %w", err)
	}

	return db, nil
}

func createTables(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS licitacao_oportunidade (
		id TEXT PRIMARY KEY,
		source TEXT NOT NULL,
		source_external_id TEXT NOT NULL,
		dedup_key TEXT NOT NULL DEFAULT '',
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

func migrateDedup(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	rollback := func(err error) error {
		_ = tx.Rollback()
		return err
	}

	columns, err := tx.Query("PRAGMA table_info(licitacao_oportunidade)")
	if err != nil {
		return rollback(err)
	}
	hasDedupKey := false
	for columns.Next() {
		var cid, notNull, pk int
		var name, columnType string
		var defaultValue sql.NullString
		if err := columns.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			_ = columns.Close()
			return rollback(err)
		}
		if name == "dedup_key" {
			hasDedupKey = true
		}
	}
	if err := columns.Close(); err != nil {
		return rollback(err)
	}
	if err := columns.Err(); err != nil {
		return rollback(err)
	}

	if !hasDedupKey {
		if _, err := tx.Exec("ALTER TABLE licitacao_oportunidade ADD COLUMN dedup_key TEXT NOT NULL DEFAULT ''"); err != nil {
			return rollback(err)
		}
	}

	type opportunityIdentity struct {
		id   string
		cnpj string
	}
	opportunitiesRows, err := tx.Query("SELECT id, organization_cnpj FROM licitacao_oportunidade")
	if err != nil {
		return rollback(err)
	}
	var opportunities []opportunityIdentity
	for opportunitiesRows.Next() {
		var opportunity opportunityIdentity
		if err := opportunitiesRows.Scan(&opportunity.id, &opportunity.cnpj); err != nil {
			_ = opportunitiesRows.Close()
			return rollback(err)
		}
		opportunities = append(opportunities, opportunity)
	}
	if err := opportunitiesRows.Close(); err != nil {
		return rollback(err)
	}
	if err := opportunitiesRows.Err(); err != nil {
		return rollback(err)
	}

	for _, opportunity := range opportunities {
		var rawJSON string
		err := tx.QueryRow(`
			SELECT raw_json
			FROM licitacao_payload_snapshot
			WHERE opportunity_id = ? AND resource_type = 'list'
			ORDER BY created_at DESC, id DESC
			LIMIT 1`, opportunity.id).Scan(&rawJSON)
		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			return rollback(err)
		}

		var payload struct {
			Processo string `json:"processo"`
		}
		if err := json.Unmarshal([]byte(rawJSON), &payload); err != nil {
			continue
		}
		key := domain.BuildDedupKey(opportunity.cnpj, payload.Processo)
		if key == "" {
			continue
		}
		if _, err := tx.Exec("UPDATE licitacao_oportunidade SET dedup_key = ? WHERE id = ?", key, opportunity.id); err != nil {
			return rollback(err)
		}
	}

	type dedupGroup struct {
		source   string
		dedupKey string
	}
	groupsRows, err := tx.Query(`
		SELECT source, dedup_key
		FROM licitacao_oportunidade
		WHERE dedup_key <> ''
		GROUP BY source, dedup_key
		HAVING COUNT(*) > 1`)
	if err != nil {
		return rollback(err)
	}
	var groups []dedupGroup
	for groupsRows.Next() {
		var group dedupGroup
		if err := groupsRows.Scan(&group.source, &group.dedupKey); err != nil {
			_ = groupsRows.Close()
			return rollback(err)
		}
		groups = append(groups, group)
	}
	if err := groupsRows.Close(); err != nil {
		return rollback(err)
	}
	if err := groupsRows.Err(); err != nil {
		return rollback(err)
	}

	for _, group := range groups {
		rows, err := tx.Query(`
			SELECT id
			FROM licitacao_oportunidade
			WHERE source = ? AND dedup_key = ?
			ORDER BY
				CASE WHEN source_updated_at IS NULL THEN 1 ELSE 0 END,
				source_updated_at DESC,
				CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END,
				updated_at DESC,
				id DESC`, group.source, group.dedupKey)
		if err != nil {
			return rollback(err)
		}
		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				_ = rows.Close()
				return rollback(err)
			}
			ids = append(ids, id)
		}
		if err := rows.Close(); err != nil {
			return rollback(err)
		}
		if err := rows.Err(); err != nil {
			return rollback(err)
		}

		for _, id := range ids[1:] {
			if _, err := tx.Exec("DELETE FROM licitacao_oportunidade WHERE id = ?", id); err != nil {
				return rollback(err)
			}
		}
	}

	if _, err := tx.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_opp_dedup ON licitacao_oportunidade(source, dedup_key) WHERE dedup_key <> ''"); err != nil {
		return rollback(err)
	}

	return tx.Commit()
}
