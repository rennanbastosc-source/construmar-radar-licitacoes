package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
)

type EditalRepository struct {
	db *sql.DB
}

func NewEditalRepository(db *sql.DB) *EditalRepository {
	return &EditalRepository{db: db}
}

// CreateAnalysis persists a new edital analysis with its sub-entities in a transaction.
func (r *EditalRepository) CreateAnalysis(ctx context.Context, a *domain.EditalAnalysis) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	stmt := `
		INSERT INTO edital_analysis (
			id, oportunidade_id, titulo, orgao, numero_edital, numero_processo,
			modalidade, modo_disputa, objeto_completo, localidade, data_abertura,
			valor_estimado, bdi_maximo_permitido, prazo_execucao, regime_execucao,
			status, original_file_name, file_type, total_paginas, resumo_executivo,
			parecer_tecnico, score_aderencia, erro_mensagem, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = tx.ExecContext(ctx, stmt,
		a.ID, a.OportunidadeID, a.Titulo, a.Orgao, a.NumeroEdital, a.NumeroProcesso,
		a.Modalidade, a.ModoDisputa, a.ObjetoCompleto, a.Localidade, a.DataAbertura,
		a.ValorEstimado, a.BDIMaximoPermitido, a.PrazoExecucao, a.RegimeExecucao,
		a.Status, a.OriginalFileName, a.FileType, a.TotalPaginas, a.ResumoExecutivo,
		a.ParecerTecnico, a.ScoreAderencia, a.ErroMensagem, a.CreatedAt, a.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert edital_analysis: %w", err)
	}

	// Insert Pegadinhas
	for _, p := range a.Pegadinhas {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO edital_pegadinha (id, analysis_id, clausula, titulo, descricao, severidade, recomendacao, impacto)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, p.ID, a.ID, p.Clausula, p.Titulo, p.Descricao, p.Severidade, p.Recomendacao, p.Impacto)
		if err != nil {
			return fmt.Errorf("failed to insert pegadinha: %w", err)
		}
	}

	// Insert Qualificações Técnicas
	for _, q := range a.QualificacoesTecnicas {
		visitaInt := 0
		if q.ExigeVisitaTecnica {
			visitaInt = 1
		}
		declInt := 0
		if q.AceitaDeclaracao {
			declInt = 1
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO edital_qualificacao_tecnica (id, analysis_id, item_servico, unidade, quantidade_exigida, parcela_minima, exige_visita_tecnica, aceita_declaracao, observacao)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, q.ID, a.ID, q.ItemServico, q.Unidade, q.QuantidadeExigida, q.ParcelaMinima, visitaInt, declInt, q.Observacao)
		if err != nil {
			return fmt.Errorf("failed to insert qualificacao tecnica: %w", err)
		}
	}

	// Insert Requisitos Habilitação
	for _, req := range a.RequisitosHabilitacao {
		obrigInt := 0
		if req.Obrigatorio {
			obrigInt = 1
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO edital_requisito_habilitacao (id, analysis_id, categoria, documento, obrigatorio, detalhes)
			VALUES (?, ?, ?, ?, ?, ?)
		`, req.ID, a.ID, req.Categoria, req.Documento, obrigInt, req.Detalhes)
		if err != nil {
			return fmt.Errorf("failed to insert requisito habilitacao: %w", err)
		}
	}

	// Insert Checklist
	for _, chk := range a.ChecklistDocumentos {
		marcadoInt := 0
		if chk.Marcado {
			marcadoInt = 1
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO edital_checklist_item (id, analysis_id, numero, descricao, fase, marcado, observacao)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, chk.ID, a.ID, chk.Numero, chk.Descricao, chk.Fase, marcadoInt, chk.Observacao)
		if err != nil {
			return fmt.Errorf("failed to insert checklist item: %w", err)
		}
	}

	// Insert Índices Financeiros
	for _, ind := range a.IndicesFinanceiros {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO edital_indice_financeiro (id, analysis_id, sigla, nome, valor_minimo, formula, observacao)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, ind.ID, a.ID, ind.Sigla, ind.Nome, ind.ValorMinimo, ind.Formula, ind.Observacao)
		if err != nil {
			return fmt.Errorf("failed to insert indice financeiro: %w", err)
		}
	}

	return tx.Commit()
}

// GetAnalysisByID retrieves an edital analysis with all relational sub-items.
func (r *EditalRepository) GetAnalysisByID(ctx context.Context, id string) (*domain.EditalAnalysis, error) {
	stmt := `
		SELECT id, oportunidade_id, titulo, orgao, numero_edital, numero_processo,
		       modalidade, modo_disputa, objeto_completo, localidade, data_abertura,
		       valor_estimado, bdi_maximo_permitido, prazo_execucao, regime_execucao,
		       status, original_file_name, file_type, total_paginas, resumo_executivo,
		       parecer_tecnico, score_aderencia, erro_mensagem, created_at, updated_at
		FROM edital_analysis
		WHERE id = ?
	`
	row := r.db.QueryRowContext(ctx, stmt, id)

	var a domain.EditalAnalysis
	var bdiNull sql.NullFloat64
	var err error

	err = row.Scan(
		&a.ID, &a.OportunidadeID, &a.Titulo, &a.Orgao, &a.NumeroEdital, &a.NumeroProcesso,
		&a.Modalidade, &a.ModoDisputa, &a.ObjetoCompleto, &a.Localidade, &a.DataAbertura,
		&a.ValorEstimado, &bdiNull, &a.PrazoExecucao, &a.RegimeExecucao,
		&a.Status, &a.OriginalFileName, &a.FileType, &a.TotalPaginas, &a.ResumoExecutivo,
		&a.ParecerTecnico, &a.ScoreAderencia, &a.ErroMensagem, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query edital_analysis: %w", err)
	}
	if bdiNull.Valid {
		a.BDIMaximoPermitido = &bdiNull.Float64
	}

	// Fetch Pegadinhas
	rowsP, err := r.db.QueryContext(ctx, "SELECT id, analysis_id, clausula, titulo, descricao, severidade, recomendacao, impacto FROM edital_pegadinha WHERE analysis_id = ?", id)
	if err == nil {
		defer rowsP.Close()
		for rowsP.Next() {
			var p domain.EditalPegadinha
			if err := rowsP.Scan(&p.ID, &p.AnalysisID, &p.Clausula, &p.Titulo, &p.Descricao, &p.Severidade, &p.Recomendacao, &p.Impacto); err == nil {
				a.Pegadinhas = append(a.Pegadinhas, p)
			}
		}
	}

	// Fetch Qualificações Técnicas
	rowsQ, err := r.db.QueryContext(ctx, "SELECT id, analysis_id, item_servico, unidade, quantidade_exigida, parcela_minima, exige_visita_tecnica, aceita_declaracao, observacao FROM edital_qualificacao_tecnica WHERE analysis_id = ?", id)
	if err == nil {
		defer rowsQ.Close()
		for rowsQ.Next() {
			var q domain.EditalQualificacaoTecnica
			var obsNull sql.NullString
			var visitaInt, declInt int
			if err := rowsQ.Scan(&q.ID, &q.AnalysisID, &q.ItemServico, &q.Unidade, &q.QuantidadeExigida, &q.ParcelaMinima, &visitaInt, &declInt, &obsNull); err == nil {
				q.ExigeVisitaTecnica = visitaInt == 1
				q.AceitaDeclaracao = declInt == 1
				if obsNull.Valid {
					q.Observacao = obsNull.String
				}
				a.QualificacoesTecnicas = append(a.QualificacoesTecnicas, q)
			}
		}
	}

	// Fetch Requisitos Habilitação
	rowsR, err := r.db.QueryContext(ctx, "SELECT id, analysis_id, categoria, documento, obrigatorio, detalhes FROM edital_requisito_habilitacao WHERE analysis_id = ?", id)
	if err == nil {
		defer rowsR.Close()
		for rowsR.Next() {
			var req domain.EditalRequisitoHabilitacao
			var obrigInt int
			var detNull sql.NullString
			if err := rowsR.Scan(&req.ID, &req.AnalysisID, &req.Categoria, &req.Documento, &obrigInt, &detNull); err == nil {
				req.Obrigatorio = obrigInt == 1
				if detNull.Valid {
					req.Detalhes = detNull.String
				}
				a.RequisitosHabilitacao = append(a.RequisitosHabilitacao, req)
			}
		}
	}

	// Fetch Checklist
	rowsC, err := r.db.QueryContext(ctx, "SELECT id, analysis_id, numero, descricao, fase, marcado, observacao FROM edital_checklist_item WHERE analysis_id = ? ORDER BY numero ASC", id)
	if err == nil {
		defer rowsC.Close()
		for rowsC.Next() {
			var chk domain.EditalChecklistItem
			var marcInt int
			var obsNull sql.NullString
			if err := rowsC.Scan(&chk.ID, &chk.AnalysisID, &chk.Numero, &chk.Descricao, &chk.Fase, &marcInt, &obsNull); err == nil {
				chk.Marcado = marcInt == 1
				if obsNull.Valid {
					chk.Observacao = obsNull.String
				}
				a.ChecklistDocumentos = append(a.ChecklistDocumentos, chk)
			}
		}
	}

	// Fetch Índices
	rowsI, err := r.db.QueryContext(ctx, "SELECT id, analysis_id, sigla, nome, valor_minimo, formula, observacao FROM edital_indice_financeiro WHERE analysis_id = ?", id)
	if err == nil {
		defer rowsI.Close()
		for rowsI.Next() {
			var ind domain.EditalIndiceFinanceiro
			var formNull, obsNull sql.NullString
			if err := rowsI.Scan(&ind.ID, &ind.AnalysisID, &ind.Sigla, &ind.Nome, &ind.ValorMinimo, &formNull, &obsNull); err == nil {
				if formNull.Valid {
					ind.Formula = formNull.String
				}
				if obsNull.Valid {
					ind.Observacao = obsNull.String
				}
				a.IndicesFinanceiros = append(a.IndicesFinanceiros, ind)
			}
		}
	}

	return &a, nil
}

// ListAnalyses returns paginated edital analyses.
func (r *EditalRepository) ListAnalyses(ctx context.Context, limit, offset int) ([]domain.EditalAnalysis, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var total int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM edital_analysis").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count edital_analysis: %w", err)
	}

	stmt := `
		SELECT id, oportunidade_id, titulo, orgao, numero_edital, numero_processo,
		       modalidade, modo_disputa, objeto_completo, localidade, data_abertura,
		       valor_estimado, bdi_maximo_permitido, prazo_execucao, regime_execucao,
		       status, original_file_name, file_type, total_paginas, resumo_executivo,
		       parecer_tecnico, score_aderencia, erro_mensagem, created_at, updated_at
		FROM edital_analysis
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.db.QueryContext(ctx, stmt, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list edital_analysis: %w", err)
	}
	defer rows.Close()

	var list []domain.EditalAnalysis
	for rows.Next() {
		var a domain.EditalAnalysis
		var bdiNull sql.NullFloat64
		if err := rows.Scan(
			&a.ID, &a.OportunidadeID, &a.Titulo, &a.Orgao, &a.NumeroEdital, &a.NumeroProcesso,
			&a.Modalidade, &a.ModoDisputa, &a.ObjetoCompleto, &a.Localidade, &a.DataAbertura,
			&a.ValorEstimado, &bdiNull, &a.PrazoExecucao, &a.RegimeExecucao,
			&a.Status, &a.OriginalFileName, &a.FileType, &a.TotalPaginas, &a.ResumoExecutivo,
			&a.ParecerTecnico, &a.ScoreAderencia, &a.ErroMensagem, &a.CreatedAt, &a.UpdatedAt,
		); err == nil {
			if bdiNull.Valid {
				a.BDIMaximoPermitido = &bdiNull.Float64
			}
			list = append(list, a)
		}
	}

	return list, total, nil
}

// ToggleChecklistItem toggles the status of a proposal checklist item.
func (r *EditalRepository) ToggleChecklistItem(ctx context.Context, itemID string, marcado bool) error {
	val := 0
	if marcado {
		val = 1
	}
	_, err := r.db.ExecContext(ctx, "UPDATE edital_checklist_item SET marcado = ? WHERE id = ?", val, itemID)
	return err
}
