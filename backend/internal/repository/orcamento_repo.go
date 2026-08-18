package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
)

type OrcamentoRepository struct {
	db *sql.DB
}

func NewOrcamentoRepository(db *sql.DB) *OrcamentoRepository {
	return &OrcamentoRepository{db: db}
}

// CreateOrcamento inserts a new Orcamento along with all its items in a single transaction.
func (r *OrcamentoRepository) CreateOrcamento(ctx context.Context, o *domain.Orcamento) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	now := time.Now().UTC()
	if o.CreatedAt.IsZero() {
		o.CreatedAt = now
	}
	o.UpdatedAt = now

	insertOrcamentoSQL := `
		INSERT INTO orcamento (
			id, oportunidade_id, titulo, objeto, orgao, localidade, data_preco_base,
			bdi, desconto_geral, desconto_mao_de_obra, desconto_material, status, original_file_name, file_type, valor_total_estimado, valor_total_com_bdi,
			total_itens, confianca_media, seobra_budget_id, seobra_budget_url, progress_step,
			progress_percent, progress_message, erro_mensagem, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err = tx.ExecContext(ctx, insertOrcamentoSQL,
		o.ID, o.OportunidadeID, o.Titulo, o.Objeto, o.Orgao, o.Localidade, o.DataPrecoBase,
		o.BDI, o.DescontoGeral, o.DescontoMaoDeObra, o.DescontoMaterial, string(o.Status), o.OriginalFileName, o.FileType, o.ValorTotalEstimado, o.ValorTotalComBDI,
		o.TotalItens, o.ConfiancaMedia, o.SeobraBudgetId, o.SeobraBudgetURL, o.ProgressStep,
		o.ProgressPercent, o.ProgressMessage, o.ErroMensagem, o.CreatedAt, o.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert orcamento: %w", err)
	}

	insertItemSQL := `
		INSERT INTO orcamento_item (
			id, orcamento_id, item_numero, codigo_referencia, fonte, descricao,
			unidade, categoria, quantidade, preco_unitario, preco_total, confianca,
			flag_revisao, observacao_ia, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	for _, item := range o.Itens {
		itemCreatedAt := item.CreatedAt
		if itemCreatedAt.IsZero() {
			itemCreatedAt = now
		}
		itemUpdatedAt := now

		flagRevInt := 0
		if item.FlagRevisao {
			flagRevInt = 1
		}
		categoria := item.Categoria
		if categoria == "" {
			categoria = domain.InferCategoria(item.Descricao, item.Unidade)
		}

		_, err = tx.ExecContext(ctx, insertItemSQL,
			item.ID, o.ID, item.ItemNumero, item.CodigoReferencia, item.Fonte, item.Descricao,
			item.Unidade, categoria, item.Quantidade, item.PrecoUnitario, item.PrecoTotal, item.Confianca,
			flagRevInt, item.ObservacaoIA, itemCreatedAt, itemUpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert orcamento item %s: %w", item.ItemNumero, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit orcamento transaction: %w", err)
	}

	return nil
}

// GetOrcamentoByID retrieves an Orcamento and all its items by ID.
func (r *OrcamentoRepository) GetOrcamentoByID(ctx context.Context, id string) (*domain.Orcamento, error) {
	queryOrcamento := `
		SELECT id, oportunidade_id, titulo, objeto, orgao, localidade, data_preco_base,
		       bdi, desconto_geral, desconto_mao_de_obra, desconto_material, status, original_file_name, file_type, valor_total_estimado, valor_total_com_bdi,
		       total_itens, confianca_media, seobra_budget_id, seobra_budget_url,
		       progress_step, progress_percent, progress_message, erro_mensagem,
		       created_at, updated_at
		FROM orcamento
		WHERE id = ?
	`

	var o domain.Orcamento
	var oportID, seobraID, seobraURL, progStep, progMsg, erroMsg sql.NullString
	var statusStr string

	err := r.db.QueryRowContext(ctx, queryOrcamento, id).Scan(
		&o.ID, &oportID, &o.Titulo, &o.Objeto, &o.Orgao, &o.Localidade, &o.DataPrecoBase,
		&o.BDI, &o.DescontoGeral, &o.DescontoMaoDeObra, &o.DescontoMaterial, &statusStr, &o.OriginalFileName, &o.FileType, &o.ValorTotalEstimado, &o.ValorTotalComBDI,
		&o.TotalItens, &o.ConfiancaMedia, &seobraID, &seobraURL,
		&progStep, &o.ProgressPercent, &progMsg, &erroMsg,
		&o.CreatedAt, &o.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query orcamento: %w", err)
	}

	o.Status = domain.OrcamentoStatus(statusStr)
	if oportID.Valid {
		o.OportunidadeID = &oportID.String
	}
	if seobraID.Valid {
		o.SeobraBudgetId = seobraID.String
	}
	if seobraURL.Valid {
		o.SeobraBudgetURL = seobraURL.String
	}
	if progStep.Valid {
		o.ProgressStep = progStep.String
	}
	if progMsg.Valid {
		o.ProgressMessage = progMsg.String
	}
	if erroMsg.Valid {
		o.ErroMensagem = erroMsg.String
	}

	queryItems := `
		SELECT id, orcamento_id, item_numero, codigo_referencia, fonte, descricao,
		       unidade, categoria, quantidade, preco_unitario, preco_total, confianca,
		       flag_revisao, observacao_ia, created_at, updated_at
		FROM orcamento_item
		WHERE orcamento_id = ?
		ORDER BY rowid ASC
	`

	rows, err := r.db.QueryContext(ctx, queryItems, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query orcamento items: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	var items []domain.OrcamentoItem
	for rows.Next() {
		var item domain.OrcamentoItem
		var flagRevInt int
		var obsIA sql.NullString

		err := rows.Scan(
			&item.ID, &item.OrcamentoID, &item.ItemNumero, &item.CodigoReferencia, &item.Fonte, &item.Descricao,
			&item.Unidade, &item.Categoria, &item.Quantidade, &item.PrecoUnitario, &item.PrecoTotal, &item.Confianca,
			&flagRevInt, &obsIA, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan orcamento item: %w", err)
		}
		item.FlagRevisao = (flagRevInt == 1)
		if obsIA.Valid {
			item.ObservacaoIA = obsIA.String
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row error reading orcamento items: %w", err)
	}

	o.Itens = items
	return &o, nil
}

// ListOrcamentos lists budgets ordered by creation time descending.
func (r *OrcamentoRepository) ListOrcamentos(ctx context.Context, limit, offset int) ([]domain.Orcamento, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var total int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM orcamento").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count orcamentos: %w", err)
	}

	query := `
		SELECT id, oportunidade_id, titulo, objeto, orgao, localidade, data_preco_base,
		       bdi, desconto_geral, desconto_mao_de_obra, desconto_material, status, original_file_name, file_type, valor_total_estimado, valor_total_com_bdi,
		       total_itens, confianca_media, seobra_budget_id, seobra_budget_url,
		       progress_step, progress_percent, progress_message, erro_mensagem,
		       created_at, updated_at
		FROM orcamento
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`

	rows, err := r.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query orcamentos: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	var list []domain.Orcamento
	for rows.Next() {
		var o domain.Orcamento
		var oportID, seobraID, seobraURL, progStep, progMsg, erroMsg sql.NullString
		var statusStr string

		err := rows.Scan(
			&o.ID, &oportID, &o.Titulo, &o.Objeto, &o.Orgao, &o.Localidade, &o.DataPrecoBase,
			&o.BDI, &o.DescontoGeral, &o.DescontoMaoDeObra, &o.DescontoMaterial, &statusStr, &o.OriginalFileName, &o.FileType, &o.ValorTotalEstimado, &o.ValorTotalComBDI,
			&o.TotalItens, &o.ConfiancaMedia, &seobraID, &seobraURL,
			&progStep, &o.ProgressPercent, &progMsg, &erroMsg,
			&o.CreatedAt, &o.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan orcamento row: %w", err)
		}

		o.Status = domain.OrcamentoStatus(statusStr)
		if oportID.Valid {
			o.OportunidadeID = &oportID.String
		}
		if seobraID.Valid {
			o.SeobraBudgetId = seobraID.String
		}
		if seobraURL.Valid {
			o.SeobraBudgetURL = seobraURL.String
		}
		if progStep.Valid {
			o.ProgressStep = progStep.String
		}
		if progMsg.Valid {
			o.ProgressMessage = progMsg.String
		}
		if erroMsg.Valid {
			o.ErroMensagem = erroMsg.String
		}

		list = append(list, o)
	}

	return list, total, nil
}

// UpdateOrcamentoItens replaces all items for an Orcamento and recalculates totals.
func (r *OrcamentoRepository) UpdateOrcamentoItens(ctx context.Context, o *domain.Orcamento) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	o.RecalculateTotals()
	now := time.Now().UTC()
	o.UpdatedAt = now

	// 1. Update Orcamento totals
	updateOrcamentoSQL := `
		UPDATE orcamento
		SET titulo = ?, objeto = ?, orgao = ?, localidade = ?, data_preco_base = ?,
		    bdi = ?, desconto_geral = ?, desconto_mao_de_obra = ?, desconto_material = ?, status = ?, valor_total_estimado = ?, valor_total_com_bdi = ?,
		    total_itens = ?, confianca_media = ?, updated_at = ?
		WHERE id = ?
	`
	_, err = tx.ExecContext(ctx, updateOrcamentoSQL,
		o.Titulo, o.Objeto, o.Orgao, o.Localidade, o.DataPrecoBase,
		o.BDI, o.DescontoGeral, o.DescontoMaoDeObra, o.DescontoMaterial, string(o.Status), o.ValorTotalEstimado, o.ValorTotalComBDI,
		o.TotalItens, o.ConfiancaMedia, o.UpdatedAt, o.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update orcamento totals: %w", err)
	}

	// 2. Clear old items
	_, err = tx.ExecContext(ctx, "DELETE FROM orcamento_item WHERE orcamento_id = ?", o.ID)
	if err != nil {
		return fmt.Errorf("failed to clear old items: %w", err)
	}

	// 3. Insert updated items
	insertItemSQL := `
		INSERT INTO orcamento_item (
			id, orcamento_id, item_numero, codigo_referencia, fonte, descricao,
			unidade, categoria, quantidade, preco_unitario, preco_total, confianca,
			flag_revisao, observacao_ia, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	for _, item := range o.Itens {
		flagRevInt := 0
		if item.FlagRevisao {
			flagRevInt = 1
		}
		categoria := item.Categoria
		if categoria == "" {
			categoria = domain.InferCategoria(item.Descricao, item.Unidade)
		}
		itemCreatedAt := item.CreatedAt
		if itemCreatedAt.IsZero() {
			itemCreatedAt = now
		}

		_, err = tx.ExecContext(ctx, insertItemSQL,
			item.ID, o.ID, item.ItemNumero, item.CodigoReferencia, item.Fonte, item.Descricao,
			item.Unidade, categoria, item.Quantidade, item.PrecoUnitario, item.PrecoTotal, item.Confianca,
			flagRevInt, item.ObservacaoIA, itemCreatedAt, now,
		)
		if err != nil {
			return fmt.Errorf("failed to insert updated item %s: %w", item.ItemNumero, err)
		}
	}

	return tx.Commit()
}

// UpdateOrcamentoProgress updates the real-time background dispatch progress.
func (r *OrcamentoRepository) UpdateOrcamentoProgress(ctx context.Context, id, step string, percent int, message string) error {
	query := `
		UPDATE orcamento
		SET progress_step = ?, progress_percent = ?, progress_message = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.db.ExecContext(ctx, query, step, percent, message, time.Now().UTC(), id)
	return err
}

// UpdateOrcamentoStatus updates status, error message and SEOBRA metadata.
func (r *OrcamentoRepository) UpdateOrcamentoStatus(ctx context.Context, id string, status domain.OrcamentoStatus, erroMsg, seobraBudgetId, seobraBudgetUrl string) error {
	query := `
		UPDATE orcamento
		SET status = ?, erro_mensagem = ?, seobra_budget_id = ?, seobra_budget_url = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.db.ExecContext(ctx, query, string(status), erroMsg, seobraBudgetId, seobraBudgetUrl, time.Now().UTC(), id)
	return err
}

// SaveSeobraSession saves or updates the active SEOBRA session.
func (r *OrcamentoRepository) SaveSeobraSession(ctx context.Context, s *domain.SeobraSession) error {
	now := time.Now().UTC()
	if s.CreatedAt.IsZero() {
		s.CreatedAt = now
	}
	s.UpdatedAt = now

	query := `
		INSERT INTO seobra_session (id, usuario, url_base, cookies, auth_token, is_active, ultimo_ping, ultimo_login, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			cookies = excluded.cookies,
			auth_token = excluded.auth_token,
			is_active = excluded.is_active,
			ultimo_ping = excluded.ultimo_ping,
			ultimo_login = excluded.ultimo_login,
			updated_at = excluded.updated_at
	`
	isActiveInt := 0
	if s.IsActive {
		isActiveInt = 1
	}

	_, err := r.db.ExecContext(ctx, query,
		s.ID, s.Usuario, s.URLBase, s.Cookies, s.AuthToken, isActiveInt,
		s.UltimoPing, s.UltimoLogin, s.CreatedAt, s.UpdatedAt,
	)
	return err
}

// GetActiveSeobraSession returns the latest active session if present.
func (r *OrcamentoRepository) GetActiveSeobraSession(ctx context.Context) (*domain.SeobraSession, error) {
	query := `
		SELECT id, usuario, url_base, cookies, auth_token, is_active, ultimo_ping, ultimo_login, created_at, updated_at
		FROM seobra_session
		WHERE is_active = 1
		ORDER BY updated_at DESC
		LIMIT 1
	`
	var s domain.SeobraSession
	var authToken sql.NullString
	var isActiveInt int

	err := r.db.QueryRowContext(ctx, query).Scan(
		&s.ID, &s.Usuario, &s.URLBase, &s.Cookies, &authToken, &isActiveInt,
		&s.UltimoPing, &s.UltimoLogin, &s.CreatedAt, &s.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query active seobra session: %w", err)
	}

	s.IsActive = (isActiveInt == 1)
	if authToken.Valid {
		s.AuthToken = authToken.String
	}
	return &s, nil
}
