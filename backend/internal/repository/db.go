package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
	_ "modernc.org/sqlite"
)

func InitDB(dbPath string) (*sql.DB, error) {
	var db *sql.DB
	var err error

	if strings.HasPrefix(dbPath, "libsql://") || strings.HasPrefix(dbPath, "http://") || strings.HasPrefix(dbPath, "https://") {
		// Connect to Turso / LibSQL Cloud Database
		db, err = sql.Open("libsql", dbPath)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to Turso cloud database: %w", err)
		}
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(5)
	} else {
		// Connect to local SQLite database
		connStr := dbPath
		if !strings.Contains(connStr, "?") {
			connStr += "?_pragma=journal_mode(wal)&_pragma=busy_timeout(10000)&_pragma=synchronous(NORMAL)"
		}
		db, err = sql.Open("sqlite", connStr)
		if err != nil {
			return nil, fmt.Errorf("failed to open sqlite database: %w", err)
		}
		// For local SQLite, strictly serialize writes with 1 open connection
		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)
		db.SetConnMaxLifetime(0)
	}

	if err := createTables(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to create database tables: %w", err)
	}
	if err := migrateDedup(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to migrate deduplication: %w", err)
	}
	if err := migrateOrcamentoProgress(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to migrate orcamento progress: %w", err)
	}
	if err := migrateOrcamentoDescontos(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to migrate orcamento discounts: %w", err)
	}
	if err := migrateLicitacaoArchived(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to migrate licitacao archived columns: %w", err)
	}
	if err := migrateCrossDedup(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to migrate cross-source deduplication: %w", err)
	}
	if err := recoverInterruptedSyncRuns(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to recover interrupted sync runs: %w", err)
	}

	return db, nil
}

// recoverInterruptedSyncRuns marca como FAILED qualquer sync_run órfão deixado
// em RUNNING por um processo encerrado abruptamente. Sem isso, a UI exibiria
// "Sincronizando…" para sempre, com tempo decorrido acumulando do run antigo.
func recoverInterruptedSyncRuns(db *sql.DB) error {
	_, err := db.Exec(`
		UPDATE licitacao_sync_run
		SET status = 'FAILED', finished_at = ?, error_message = 'Interrompida por reinício do servidor'
		WHERE status = 'RUNNING'`, time.Now().UTC())
	return err
}

func migrateLicitacaoArchived(db *sql.DB) error {
	cols := []string{
		"ALTER TABLE licitacao_oportunidade ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",
		"ALTER TABLE licitacao_oportunidade ADD COLUMN archived_at DATETIME",
		"CREATE INDEX IF NOT EXISTS idx_opp_archived ON licitacao_oportunidade(is_archived)",
	}
	for _, sqlStmt := range cols {
		_, _ = db.Exec(sqlStmt)
	}
	return nil
}

func migrateCrossDedup(db *sql.DB) error {
	_, _ = db.Exec("ALTER TABLE licitacao_oportunidade ADD COLUMN cross_dedup_key TEXT NOT NULL DEFAULT ''")

	if _, err := db.Exec("DROP INDEX IF EXISTS idx_opp_cross_dedup"); err != nil {
		return err
	}
	if _, err := db.Exec("UPDATE licitacao_oportunidade SET cross_dedup_key = ''"); err != nil {
		return err
	}
	if _, err := db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_opp_cross_dedup ON licitacao_oportunidade(cross_dedup_key) WHERE cross_dedup_key <> '' AND is_archived = 0"); err != nil {
		return err
	}

	rows, err := db.Query(`
		SELECT id, municipality_name, purchase_number, purchase_year
		FROM licitacao_oportunidade
		WHERE cross_dedup_key = '' AND purchase_number IS NOT NULL AND purchase_number <> ''
		ORDER BY (CASE WHEN source = 'TCE-CE' THEN 0 ELSE 1 END), created_at ASC`)
	if err != nil {
		return err
	}

	type opportunityCrossKey struct {
		id           string
		municipality string
		number       string
		year         sql.NullInt64
	}
	opportunities := make([]opportunityCrossKey, 0)
	for rows.Next() {
		var opportunity opportunityCrossKey
		if err := rows.Scan(&opportunity.id, &opportunity.municipality, &opportunity.number, &opportunity.year); err != nil {
			_ = rows.Close()
			return err
		}
		opportunities = append(opportunities, opportunity)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, opportunity := range opportunities {
		if !opportunity.year.Valid {
			continue
		}
		key := domain.BuildCrossDedupKey(opportunity.municipality, opportunity.number, int(opportunity.year.Int64))
		if key == "" {
			continue
		}

		if _, err := db.Exec("UPDATE licitacao_oportunidade SET cross_dedup_key = ? WHERE id = ?", key, opportunity.id); err == nil {
			continue
		} else if !isUniqueConstraintError(err) {
			return err
		}

		if _, err := db.Exec("UPDATE licitacao_oportunidade SET is_archived = 1, archived_at = ? WHERE id = ?", time.Now().UTC(), opportunity.id); err != nil {
			return err
		}
	}

	return nil
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unique constraint") || strings.Contains(message, "constraint failed") && strings.Contains(message, "unique")
}

func migrateOrcamentoProgress(db *sql.DB) error {
	cols := []string{
		"ALTER TABLE orcamento ADD COLUMN progress_step TEXT DEFAULT ''",
		"ALTER TABLE orcamento ADD COLUMN progress_percent INTEGER NOT NULL DEFAULT 0",
		"ALTER TABLE orcamento ADD COLUMN progress_message TEXT DEFAULT ''",
	}
	for _, sqlStmt := range cols {
		_, _ = db.Exec(sqlStmt)
	}
	return nil
}

func migrateOrcamentoDescontos(db *sql.DB) error {
	cols := []string{
		"ALTER TABLE orcamento ADD COLUMN desconto_geral REAL NOT NULL DEFAULT 0.0",
		"ALTER TABLE orcamento ADD COLUMN desconto_mao_de_obra REAL NOT NULL DEFAULT 0.0",
		"ALTER TABLE orcamento ADD COLUMN desconto_material REAL NOT NULL DEFAULT 0.0",
		"ALTER TABLE orcamento_item ADD COLUMN categoria TEXT NOT NULL DEFAULT 'SERVICO'",
	}
	for _, sqlStmt := range cols {
		_, _ = db.Exec(sqlStmt)
	}
	return nil
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
		is_archived INTEGER NOT NULL DEFAULT 0,
		archived_at DATETIME,
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

	CREATE TABLE IF NOT EXISTS orcamento (
		id TEXT PRIMARY KEY,
		oportunidade_id TEXT,
		titulo TEXT NOT NULL,
		objeto TEXT NOT NULL,
		orgao TEXT NOT NULL,
		localidade TEXT NOT NULL,
		data_preco_base TEXT NOT NULL,
		bdi REAL NOT NULL DEFAULT 0.0,
		desconto_geral REAL NOT NULL DEFAULT 0.0,
		desconto_mao_de_obra REAL NOT NULL DEFAULT 0.0,
		desconto_material REAL NOT NULL DEFAULT 0.0,
		status TEXT NOT NULL,
		original_file_name TEXT NOT NULL,
		file_type TEXT NOT NULL,
		valor_total_estimado REAL NOT NULL DEFAULT 0.0,
		valor_total_com_bdi REAL NOT NULL DEFAULT 0.0,
		total_itens INTEGER NOT NULL DEFAULT 0,
		confianca_media REAL NOT NULL DEFAULT 0.0,
		seobra_budget_id TEXT,
		seobra_budget_url TEXT,
		progress_step TEXT DEFAULT '',
		progress_percent INTEGER NOT NULL DEFAULT 0,
		progress_message TEXT DEFAULT '',
		erro_mensagem TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(oportunidade_id) REFERENCES licitacao_oportunidade(id) ON DELETE SET NULL
	);

	CREATE INDEX IF NOT EXISTS idx_orcamento_status ON orcamento(status);
	CREATE INDEX IF NOT EXISTS idx_orcamento_oportunidade ON orcamento(oportunidade_id);
	CREATE INDEX IF NOT EXISTS idx_orcamento_created_at ON orcamento(created_at DESC);

	CREATE TABLE IF NOT EXISTS orcamento_item (
		id TEXT PRIMARY KEY,
		orcamento_id TEXT NOT NULL,
		item_numero TEXT NOT NULL,
		codigo_referencia TEXT NOT NULL,
		fonte TEXT NOT NULL,
		descricao TEXT NOT NULL,
		unidade TEXT NOT NULL,
		categoria TEXT NOT NULL DEFAULT 'SERVICO',
		quantidade REAL NOT NULL,
		preco_unitario REAL NOT NULL,
		preco_total REAL NOT NULL,
		confianca REAL NOT NULL,
		flag_revisao INTEGER NOT NULL DEFAULT 0,
		observacao_ia TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(orcamento_id) REFERENCES orcamento(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_item_orcamento ON orcamento_item(orcamento_id);

	CREATE TABLE IF NOT EXISTS seobra_session (
		id TEXT PRIMARY KEY,
		usuario TEXT NOT NULL,
		url_base TEXT NOT NULL,
		cookies TEXT NOT NULL,
		auth_token TEXT,
		is_active INTEGER NOT NULL DEFAULT 1,
		ultimo_ping DATETIME NOT NULL,
		ultimo_login DATETIME NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS edital_analysis (
		id TEXT PRIMARY KEY,
		oportunidade_id TEXT,
		titulo TEXT NOT NULL,
		orgao TEXT NOT NULL,
		numero_edital TEXT NOT NULL,
		numero_processo TEXT NOT NULL,
		modalidade TEXT NOT NULL,
		modo_disputa TEXT NOT NULL,
		objeto_completo TEXT NOT NULL,
		localidade TEXT NOT NULL,
		data_abertura TEXT NOT NULL,
		valor_estimado REAL NOT NULL DEFAULT 0.0,
		bdi_maximo_permitido REAL,
		prazo_execucao TEXT NOT NULL,
		regime_execucao TEXT NOT NULL,
		status TEXT NOT NULL,
		original_file_name TEXT NOT NULL,
		file_type TEXT NOT NULL,
		total_paginas INTEGER NOT NULL DEFAULT 0,
		resumo_executivo TEXT NOT NULL,
		parecer_tecnico TEXT NOT NULL,
		score_aderencia REAL NOT NULL DEFAULT 0.0,
		erro_mensagem TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY(oportunidade_id) REFERENCES licitacao_oportunidade(id) ON DELETE SET NULL
	);

	CREATE INDEX IF NOT EXISTS idx_edital_analysis_status ON edital_analysis(status);
	CREATE INDEX IF NOT EXISTS idx_edital_analysis_created_at ON edital_analysis(created_at DESC);

	CREATE TABLE IF NOT EXISTS edital_pegadinha (
		id TEXT PRIMARY KEY,
		analysis_id TEXT NOT NULL,
		clausula TEXT NOT NULL,
		titulo TEXT NOT NULL,
		descricao TEXT NOT NULL,
		severidade TEXT NOT NULL,
		recomendacao TEXT NOT NULL,
		impacto TEXT NOT NULL,
		FOREIGN KEY(analysis_id) REFERENCES edital_analysis(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_pegadinha_analysis ON edital_pegadinha(analysis_id);

	CREATE TABLE IF NOT EXISTS edital_qualificacao_tecnica (
		id TEXT PRIMARY KEY,
		analysis_id TEXT NOT NULL,
		item_servico TEXT NOT NULL,
		unidade TEXT NOT NULL,
		quantidade_exigida REAL NOT NULL DEFAULT 0.0,
		parcela_minima TEXT NOT NULL,
		exige_visita_tecnica INTEGER NOT NULL DEFAULT 0,
		aceita_declaracao INTEGER NOT NULL DEFAULT 1,
		observacao TEXT,
		FOREIGN KEY(analysis_id) REFERENCES edital_analysis(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_qualif_analysis ON edital_qualificacao_tecnica(analysis_id);

	CREATE TABLE IF NOT EXISTS edital_requisito_habilitacao (
		id TEXT PRIMARY KEY,
		analysis_id TEXT NOT NULL,
		categoria TEXT NOT NULL,
		documento TEXT NOT NULL,
		obrigatorio INTEGER NOT NULL DEFAULT 1,
		detalhes TEXT,
		FOREIGN KEY(analysis_id) REFERENCES edital_analysis(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_req_hab_analysis ON edital_requisito_habilitacao(analysis_id);

	CREATE TABLE IF NOT EXISTS edital_checklist_item (
		id TEXT PRIMARY KEY,
		analysis_id TEXT NOT NULL,
		numero INTEGER NOT NULL,
		descricao TEXT NOT NULL,
		fase TEXT NOT NULL,
		marcado INTEGER NOT NULL DEFAULT 0,
		observacao TEXT,
		FOREIGN KEY(analysis_id) REFERENCES edital_analysis(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_chk_analysis ON edital_checklist_item(analysis_id);

	CREATE TABLE IF NOT EXISTS edital_indice_financeiro (
		id TEXT PRIMARY KEY,
		analysis_id TEXT NOT NULL,
		sigla TEXT NOT NULL,
		nome TEXT NOT NULL,
		valor_minimo TEXT NOT NULL,
		formula TEXT,
		observacao TEXT,
		FOREIGN KEY(analysis_id) REFERENCES edital_analysis(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_ind_fin_analysis ON edital_indice_financeiro(analysis_id);
	`

	if _, err := db.Exec(schema); err != nil {
		return err
	}
	if _, err := db.Exec(`
		DELETE FROM licitacao_documento
		WHERE id NOT IN (
			SELECT MIN(id)
			FROM licitacao_documento
			GROUP BY opportunity_id, url
		)`); err != nil {
		return err
	}
	_, err := db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_opp_url ON licitacao_documento(opportunity_id, url)")
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
