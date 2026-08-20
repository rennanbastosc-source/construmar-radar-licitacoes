package repository

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/construmar/radar-licitacoes-backend/internal/domain"
	"github.com/google/uuid"
)

type OpportunityRepository struct {
	db *sql.DB
}

func NewOpportunityRepository(db *sql.DB) *OpportunityRepository {
	return &OpportunityRepository{db: db}
}

func (r *OpportunityRepository) PingDB(ctx context.Context) error {
	return r.db.PingContext(ctx)
}

func incomingIsNewer(incoming, existing *time.Time) bool {
	if incoming == nil {
		return false
	}
	if existing == nil {
		return true
	}
	return incoming.After(*existing)
}

// UpsertOpportunity inserts or updates an opportunity idempotently using the stable deduplication key when available.
func (r *OpportunityRepository) UpsertOpportunity(ctx context.Context, opp *domain.LicitacaoOportunidade) (bool, bool, error) {
	if opp == nil {
		return false, false, fmt.Errorf("opportunity cannot be nil")
	}

	if opp.CrossDedupKey == "" && opp.PurchaseNumber != nil && opp.PurchaseYear != nil {
		opp.CrossDedupKey = domain.BuildCrossDedupKey(opp.MunicipalityName, *opp.PurchaseNumber, *opp.PurchaseYear)
	}

	// TCE-CE has priority over PNCP: do not write an incoming PNCP duplicate.
	if opp.Source == domain.SourcePNCP && opp.CrossDedupKey != "" {
		var existingID string
		err := r.db.QueryRowContext(ctx,
			"SELECT id FROM licitacao_oportunidade WHERE source = ? AND is_archived = 0 AND cross_dedup_key = ? LIMIT 1",
			domain.SourceTCECE, opp.CrossDedupKey,
		).Scan(&existingID)
		if err == nil {
			return false, true, nil
		}
		if err != sql.ErrNoRows {
			return false, false, fmt.Errorf("failed to check cross-source duplicate: %w", err)
		}
	}

	termsJSON, err := json.Marshal(opp.ClassificationTerms)
	if err != nil {
		termsJSON = []byte("[]")
	}

	upsert := func() (bool, error) {
		if opp.DedupKey != "" {
			var existingID string
			var existingSourceUpdatedAt sql.NullTime
			err := r.db.QueryRowContext(ctx,
				"SELECT id, source_updated_at FROM licitacao_oportunidade WHERE source = ? AND dedup_key = ?",
				opp.Source, opp.DedupKey,
			).Scan(&existingID, &existingSourceUpdatedAt)

			if err == nil {
				opp.ID = existingID
				var existingUpdatedAt *time.Time
				if existingSourceUpdatedAt.Valid {
					existingUpdatedAt = &existingSourceUpdatedAt.Time
				}

				if !incomingIsNewer(opp.SourceUpdatedAt, existingUpdatedAt) {
					// Content is up to date, but the item was seen in this sync:
					// bump last_seen_at (and resurrect if previously archived) so staleness stays accurate.
					if _, err := r.db.ExecContext(ctx,
						"UPDATE licitacao_oportunidade SET cross_dedup_key = ?, last_seen_at = ?, is_archived = 0, archived_at = NULL WHERE id = ?",
						opp.CrossDedupKey, opp.LastSeenAt, existingID,
					); err != nil {
						return false, fmt.Errorf("failed to bump last_seen_at: %w", err)
					}
					return false, nil
				}

				query := `
			UPDATE licitacao_oportunidade SET
				source_external_id = ?, organization_cnpj = ?, organization_name = ?, unit_name = ?,
				municipality_name = ?, municipality_ibge_code = ?, uf = ?,
				purchase_number = ?, purchase_year = ?, modality_name = ?,
				dispute_mode_name = ?, status_source = ?, status_normalized = ?,
				object_raw = ?, object_normalized = ?, estimated_total_value = ?,
				value_status = ?, proposal_start_at = ?, proposal_end_at = ?,
				published_at = ?, source_updated_at = ?, classification = ?,
				classification_score = ?, classification_terms = ?, classifier_version = ?,
				source_url = ?, dedup_key = ?, cross_dedup_key = ?, last_seen_at = ?, updated_at = ?,
				is_archived = 0, archived_at = NULL
			WHERE id = ?`

				_, err = r.db.ExecContext(ctx, query,
					opp.SourceExternalID, opp.OrganizationCNPJ, opp.OrganizationName, opp.UnitName,
					opp.MunicipalityName, opp.MunicipalityIBGE, opp.UF,
					opp.PurchaseNumber, opp.PurchaseYear, opp.ModalityName,
					opp.DisputeModeName, opp.StatusSource, opp.StatusNormalized,
					opp.ObjectRaw, opp.ObjectNormalized, opp.EstimatedTotalValue,
					opp.ValueStatus, opp.ProposalStartAt, opp.ProposalEndAt,
					opp.PublishedAt, opp.SourceUpdatedAt, opp.Classification,
					opp.ClassificationScore, string(termsJSON), opp.ClassifierVersion,
					opp.SourceURL, opp.DedupKey, opp.CrossDedupKey, opp.LastSeenAt, opp.UpdatedAt,
					opp.ID,
				)
				if err != nil {
					return false, fmt.Errorf("failed to update opportunity: %w", err)
				}
				return false, nil
			}
			if err != sql.ErrNoRows {
				return false, fmt.Errorf("failed to check existing opportunity by dedup key: %w", err)
			}
		}

		// Check if already exists by source + source_external_id.
		var existingID string
		err := r.db.QueryRowContext(ctx,
			"SELECT id FROM licitacao_oportunidade WHERE source = ? AND source_external_id = ?",
			opp.Source, opp.SourceExternalID,
		).Scan(&existingID)

		if err == sql.ErrNoRows {
			if opp.ID == "" {
				opp.ID = uuid.New().String()
			}
			query := `
			INSERT INTO licitacao_oportunidade (
				id, source, source_external_id, dedup_key, cross_dedup_key, organization_cnpj, organization_name,
				unit_name, municipality_name, municipality_ibge_code, uf,
				purchase_number, purchase_year, modality_name, dispute_mode_name,
				status_source, status_normalized, object_raw, object_normalized,
				estimated_total_value, value_status, proposal_start_at, proposal_end_at,
				published_at, source_updated_at, classification, classification_score,
				classification_terms, classifier_version, source_url, last_seen_at,
				created_at, updated_at
			) VALUES (
				?, ?, ?, ?, ?, ?, ?, ?,
				?, ?, ?, ?, ?, ?, ?, ?,
				?, ?, ?, ?, ?, ?, ?, ?,
				?, ?, ?, ?, ?, ?, ?, ?,
				?)`

			_, err = r.db.ExecContext(ctx, query,
				opp.ID, opp.Source, opp.SourceExternalID, opp.DedupKey, opp.CrossDedupKey, opp.OrganizationCNPJ, opp.OrganizationName,
				opp.UnitName, opp.MunicipalityName, opp.MunicipalityIBGE, opp.UF,
				opp.PurchaseNumber, opp.PurchaseYear, opp.ModalityName, opp.DisputeModeName,
				opp.StatusSource, opp.StatusNormalized, opp.ObjectRaw, opp.ObjectNormalized,
				opp.EstimatedTotalValue, opp.ValueStatus, opp.ProposalStartAt, opp.ProposalEndAt,
				opp.PublishedAt, opp.SourceUpdatedAt, opp.Classification, opp.ClassificationScore,
				string(termsJSON), opp.ClassifierVersion, opp.SourceURL, opp.LastSeenAt,
				opp.CreatedAt, opp.UpdatedAt,
			)
			if err != nil {
				return false, fmt.Errorf("failed to insert opportunity: %w", err)
			}
			return true, nil
		}
		if err != nil {
			return false, fmt.Errorf("failed to check existing opportunity: %w", err)
		}

		opp.ID = existingID
		query := `
		UPDATE licitacao_oportunidade SET
			organization_cnpj = ?, organization_name = ?, unit_name = ?,
			municipality_name = ?, municipality_ibge_code = ?, uf = ?,
			purchase_number = ?, purchase_year = ?, modality_name = ?,
			dispute_mode_name = ?, status_source = ?, status_normalized = ?,
			object_raw = ?, object_normalized = ?, estimated_total_value = ?,
			value_status = ?, proposal_start_at = ?, proposal_end_at = ?,
			published_at = ?, source_updated_at = ?, classification = ?,
			classification_score = ?, classification_terms = ?, classifier_version = ?,
			source_url = ?, dedup_key = ?, cross_dedup_key = ?, last_seen_at = ?, updated_at = ?,
			is_archived = 0, archived_at = NULL
		WHERE id = ?`

		_, err = r.db.ExecContext(ctx, query,
			opp.OrganizationCNPJ, opp.OrganizationName, opp.UnitName,
			opp.MunicipalityName, opp.MunicipalityIBGE, opp.UF,
			opp.PurchaseNumber, opp.PurchaseYear, opp.ModalityName,
			opp.DisputeModeName, opp.StatusSource, opp.StatusNormalized,
			opp.ObjectRaw, opp.ObjectNormalized, opp.EstimatedTotalValue,
			opp.ValueStatus, opp.ProposalStartAt, opp.ProposalEndAt,
			opp.PublishedAt, opp.SourceUpdatedAt, opp.Classification,
			opp.ClassificationScore, string(termsJSON), opp.ClassifierVersion,
			opp.SourceURL, opp.DedupKey, opp.CrossDedupKey, opp.LastSeenAt, opp.UpdatedAt,
			opp.ID,
		)
		if err != nil {
			return false, fmt.Errorf("failed to update opportunity: %w", err)
		}
		return false, nil
	}

	isNew, err := upsert()
	var preArchived int64
	if err != nil && opp.Source == domain.SourcePNCP && isUniqueConstraintError(err) {
		return false, true, nil
	}
	if err != nil && opp.Source == domain.SourceTCECE && opp.CrossDedupKey != "" && isUniqueConstraintError(err) {
		preArchived, err = r.ArchiveSupersededPNCP(ctx, opp)
		if err != nil {
			return false, false, fmt.Errorf("failed to archive superseded PNCP opportunities before retry: %w", err)
		}
		isNew, err = upsert()
	}
	if err != nil {
		return false, false, err
	}

	if opp.Source == domain.SourceTCECE {
		archivedCount, err := r.ArchiveSupersededPNCP(ctx, opp)
		if err != nil {
			return isNew, false, fmt.Errorf("failed to archive superseded PNCP opportunities: %w", err)
		}
		log.Printf("[Dedup] TCE-CE %s arquivou %d duplicata(s) PNCP", opp.SourceExternalID, preArchived+archivedCount)
	}

	return isNew, false, nil
}

// ArchiveSupersededPNCP archives active PNCP duplicates and repoints related records to the TCE-CE opportunity.
func (r *OpportunityRepository) ArchiveSupersededPNCP(ctx context.Context, tceOpp *domain.LicitacaoOportunidade) (int64, error) {
	if tceOpp == nil || tceOpp.PurchaseNumber == nil || tceOpp.PurchaseYear == nil {
		return 0, nil
	}

	crossDedupKey := tceOpp.CrossDedupKey
	if crossDedupKey == "" {
		crossDedupKey = domain.BuildCrossDedupKey(tceOpp.MunicipalityName, *tceOpp.PurchaseNumber, *tceOpp.PurchaseYear)
	}
	if crossDedupKey == "" {
		return 0, nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to begin superseded opportunity archive: %w", err)
	}
	rollback := func(err error) (int64, error) {
		_ = tx.Rollback()
		return 0, err
	}

	query := `
		SELECT id
		FROM licitacao_oportunidade
		WHERE source = ? AND is_archived = 0 AND cross_dedup_key = ?`

	rows, err := tx.QueryContext(ctx, query, domain.SourcePNCP, crossDedupKey)
	if err != nil {
		return rollback(fmt.Errorf("failed to find superseded PNCP opportunities: %w", err))
	}
	ids := make([]string, 0)
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

	var archived int64
	for _, id := range ids {
		result, err := tx.ExecContext(ctx,
			"UPDATE licitacao_oportunidade SET is_archived = 1, archived_at = ?, cross_dedup_key = '' WHERE id = ?",
			time.Now().UTC(), id,
		)
		if err != nil {
			return rollback(fmt.Errorf("failed to archive PNCP opportunity %s: %w", id, err))
		}
		affected, err := result.RowsAffected()
		if err != nil {
			return rollback(err)
		}
		if affected == 0 {
			continue
		}

		if _, err := tx.ExecContext(ctx, "UPDATE orcamento SET oportunidade_id = ? WHERE oportunidade_id = ?", tceOpp.ID, id); err != nil {
			return rollback(fmt.Errorf("failed to repoint orcamento from %s: %w", id, err))
		}
		if _, err := tx.ExecContext(ctx, "UPDATE edital_analysis SET oportunidade_id = ? WHERE oportunidade_id = ?", tceOpp.ID, id); err != nil {
			return rollback(fmt.Errorf("failed to repoint edital analysis from %s: %w", id, err))
		}
		archived += affected
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit superseded opportunity archive: %w", err)
	}
	return archived, nil
}

func (r *OpportunityRepository) SaveSnapshot(ctx context.Context, oppID, resourceType string, rawJSON []byte) error {
	hasher := sha256.New()
	hasher.Write(rawJSON)
	hash := hex.EncodeToString(hasher.Sum(nil))

	query := `
	INSERT INTO licitacao_payload_snapshot (id, opportunity_id, resource_type, raw_json, payload_hash, created_at)
	VALUES (?, ?, ?, ?, ?, ?)`

	_, err := r.db.ExecContext(ctx, query, uuid.New().String(), oppID, resourceType, string(rawJSON), hash, time.Now().UTC())
	return err
}

func (r *OpportunityRepository) SaveDocument(ctx context.Context, doc *domain.LicitacaoDocumento) error {
	if doc.ID == "" {
		doc.ID = uuid.New().String()
	}
	query := `
	INSERT OR IGNORE INTO licitacao_documento (id, opportunity_id, title, doc_type, url, source_doc_id, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?)`

	_, err := r.db.ExecContext(ctx, query, doc.ID, doc.OpportunityID, doc.Title, doc.DocType, doc.URL, doc.SourceDocID, doc.CreatedAt)
	return err
}

func (r *OpportunityRepository) GetOpportunityByID(ctx context.Context, id string) (*domain.LicitacaoOportunidade, error) {
	query := `
	SELECT id, source, source_external_id, cross_dedup_key, organization_cnpj, organization_name,
		unit_name, municipality_name, municipality_ibge_code, uf,
		purchase_number, purchase_year, modality_name, dispute_mode_name,
		status_source, status_normalized, object_raw, object_normalized,
		estimated_total_value, value_status, proposal_start_at, proposal_end_at,
		published_at, source_updated_at, classification, classification_score,
		classification_terms, classifier_version, source_url, last_seen_at,
		created_at, updated_at
	FROM licitacao_oportunidade WHERE id = ?`

	row := r.db.QueryRowContext(ctx, query, id)
	return scanOpportunity(row)
}

func (r *OpportunityRepository) GetOpportunityByExternalID(ctx context.Context, source, externalID string) (*domain.LicitacaoOportunidade, error) {
	query := `
	SELECT id, source, source_external_id, cross_dedup_key, organization_cnpj, organization_name,
		unit_name, municipality_name, municipality_ibge_code, uf,
		purchase_number, purchase_year, modality_name, dispute_mode_name,
		status_source, status_normalized, object_raw, object_normalized,
		estimated_total_value, value_status, proposal_start_at, proposal_end_at,
		published_at, source_updated_at, classification, classification_score,
		classification_terms, classifier_version, source_url, last_seen_at,
		created_at, updated_at
	FROM licitacao_oportunidade WHERE source = ? AND source_external_id = ?`

	row := r.db.QueryRowContext(ctx, query, source, externalID)
	return scanOpportunity(row)
}

func (r *OpportunityRepository) GetSnapshotsByOpportunityID(ctx context.Context, oppID string) ([]domain.LicitacaoPayloadSnapshot, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, opportunity_id, resource_type, raw_json, payload_hash, created_at FROM licitacao_payload_snapshot WHERE opportunity_id = ? ORDER BY created_at DESC", oppID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.LicitacaoPayloadSnapshot
	for rows.Next() {
		var s domain.LicitacaoPayloadSnapshot
		if err := rows.Scan(&s.ID, &s.OpportunityID, &s.ResourceType, &s.RawJSON, &s.PayloadHash, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, nil
}

func (r *OpportunityRepository) SoftDeleteOldOpportunities(ctx context.Context, source string, cutoff time.Time) (int64, error) {
	query := `
	UPDATE licitacao_oportunidade
	SET is_archived = 1, archived_at = ?, cross_dedup_key = ''
	WHERE is_archived = 0 AND source = ? AND (last_seen_at < ? OR (proposal_end_at IS NOT NULL AND proposal_end_at < ?))`

	res, err := r.db.ExecContext(ctx, query, time.Now().UTC(), source, cutoff, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to soft delete old opportunities: %w", err)
	}
	return res.RowsAffected()
}

// SoftDeleteStaleByLastSeen archives only opportunities that disappeared from the
// source listing (last_seen_at older than cutoff). Deadline is NOT considered:
// the source list is authoritative for what is still open.
func (r *OpportunityRepository) SoftDeleteStaleByLastSeen(ctx context.Context, source string, cutoff time.Time) (int64, error) {
	query := `
	UPDATE licitacao_oportunidade
	SET is_archived = 1, archived_at = ?, cross_dedup_key = ''
	WHERE is_archived = 0 AND source = ? AND last_seen_at < ?`

	res, err := r.db.ExecContext(ctx, query, time.Now().UTC(), source, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to soft delete stale opportunities: %w", err)
	}
	return res.RowsAffected()
}

func (r *OpportunityRepository) GetDocumentsByOpportunityID(ctx context.Context, oppID string) ([]domain.LicitacaoDocumento, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, opportunity_id, title, doc_type, url, source_doc_id, created_at
		FROM licitacao_documento
		WHERE opportunity_id = ?
		ORDER BY created_at ASC`, oppID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	documents := make([]domain.LicitacaoDocumento, 0)
	for rows.Next() {
		var document domain.LicitacaoDocumento
		var sourceDocID sql.NullString
		if err := rows.Scan(
			&document.ID, &document.OpportunityID, &document.Title, &document.DocType,
			&document.URL, &sourceDocID, &document.CreatedAt,
		); err != nil {
			return nil, err
		}
		if sourceDocID.Valid {
			document.SourceDocID = sourceDocID.String
		}
		documents = append(documents, document)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return documents, nil
}

func (r *OpportunityRepository) ListOpportunities(ctx context.Context, filter domain.OpportunityFilter) ([]domain.LicitacaoOportunidade, int, error) {
	var whereClauses []string
	var args []interface{}

	// By default, exclude archived opportunities
	whereClauses = append(whereClauses, "is_archived = 0")

	if filter.UF != "" {
		whereClauses = append(whereClauses, "uf = ?")
		args = append(args, filter.UF)
	}

	if filter.Status != "" && filter.Status != "ALL" {
		whereClauses = append(whereClauses, "status_normalized = ?")
		args = append(args, filter.Status)
	}

	if filter.MinValue != nil && *filter.MinValue > 0 {
		whereClauses = append(whereClauses, "(estimated_total_value IS NOT NULL AND estimated_total_value >= ?)")
		args = append(args, *filter.MinValue)
	}

	if filter.MaxValue != nil && *filter.MaxValue > 0 {
		whereClauses = append(whereClauses, "(estimated_total_value IS NOT NULL AND estimated_total_value <= ?)")
		args = append(args, *filter.MaxValue)
	}

	if filter.Classification != "" && filter.Classification != "ALL" {
		if filter.Classification == "IN_SCOPE_AND_REVIEW" {
			whereClauses = append(whereClauses, "classification IN ('IN_SCOPE', 'REVIEW')")
		} else {
			whereClauses = append(whereClauses, "classification = ?")
			args = append(args, filter.Classification)
		}
	}

	if filter.Term != "" {
		whereClauses = append(whereClauses, "LOWER(classification_terms) LIKE ?")
		args = append(args, `%"`+strings.ToLower(filter.Term)+`"%`)
	}

	if filter.MinScore != nil {
		whereClauses = append(whereClauses, "classification_score >= ?")
		args = append(args, *filter.MinScore)
	}

	if filter.Municipality != "" {
		whereClauses = append(whereClauses, "LOWER(municipality_name) LIKE ?")
		args = append(args, "%"+strings.ToLower(filter.Municipality)+"%")
	}

	if filter.Modality != "" {
		whereClauses = append(whereClauses, "LOWER(modality_name) LIKE ?")
		args = append(args, "%"+strings.ToLower(filter.Modality)+"%")
	}

	if filter.Search != "" {
		searchParam := "%" + strings.ToLower(filter.Search) + "%"
		whereClauses = append(whereClauses, "(LOWER(object_raw) LIKE ? OR LOWER(organization_name) LIKE ? OR LOWER(municipality_name) LIKE ? OR source_external_id LIKE ?)")
		args = append(args, searchParam, searchParam, searchParam, searchParam)
	}

	if filter.DeadlineFrom != nil {
		whereClauses = append(whereClauses, "proposal_end_at >= ?")
		args = append(args, *filter.DeadlineFrom)
	}

	if filter.DeadlineTo != nil {
		whereClauses = append(whereClauses, "proposal_end_at <= ?")
		args = append(args, *filter.DeadlineTo)
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM licitacao_oportunidade %s", whereSQL)
	var total int
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count opportunities: %w", err)
	}

	// Pagination & Ordering
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 25
	}
	offset := (page - 1) * pageSize

	// Order primarily by proposal deadline ascending (urgent first), nulls last
	dataQuery := fmt.Sprintf(`
	SELECT id, source, source_external_id, cross_dedup_key, organization_cnpj, organization_name,
		unit_name, municipality_name, municipality_ibge_code, uf,
		purchase_number, purchase_year, modality_name, dispute_mode_name,
		status_source, status_normalized, object_raw, object_normalized,
		estimated_total_value, value_status, proposal_start_at, proposal_end_at,
		published_at, source_updated_at, classification, classification_score,
		classification_terms, classifier_version, source_url, last_seen_at,
		created_at, updated_at
	FROM licitacao_oportunidade
	%s
	ORDER BY 
		CASE WHEN proposal_end_at IS NULL THEN 1 ELSE 0 END,
		proposal_end_at ASC,
		created_at DESC
	LIMIT ? OFFSET ?`, whereSQL)

	queryArgs := append(args, pageSize, offset)
	rows, err := r.db.QueryContext(ctx, dataQuery, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query opportunities: %w", err)
	}
	defer rows.Close()

	list := make([]domain.LicitacaoOportunidade, 0)
	for rows.Next() {
		opp, err := scanOpportunityRow(rows)
		if err != nil {
			return nil, 0, err
		}
		list = append(list, *opp)
	}

	return list, total, nil
}

func (r *OpportunityRepository) GetStatsOverview(ctx context.Context, uf string, minValue float64) (*domain.StatsOverviewData, error) {
	if uf == "" {
		uf = "CE"
	}

	// Capped min value
	query := `
	SELECT 
		COUNT(*),
		COALESCE(SUM(CASE WHEN classification = 'IN_SCOPE' THEN 1 ELSE 0 END), 0),
		COALESCE(SUM(CASE WHEN classification = 'REVIEW' THEN 1 ELSE 0 END), 0),
		COALESCE(SUM(CASE WHEN estimated_total_value IS NOT NULL AND estimated_total_value >= ? THEN estimated_total_value ELSE 0 END), 0),
		COALESCE(SUM(CASE WHEN proposal_end_at IS NOT NULL AND proposal_end_at >= datetime('now') AND proposal_end_at <= datetime('now', '+3 days') THEN 1 ELSE 0 END), 0)
	FROM licitacao_oportunidade
	WHERE is_archived = 0 AND uf = ? AND status_normalized = 'OPEN' AND (estimated_total_value IS NOT NULL AND estimated_total_value >= ?)`

	var total, inScope, review, urgent int
	var totalValue float64

	err := r.db.QueryRowContext(ctx, query, minValue, uf, minValue).Scan(&total, &inScope, &review, &totalValue, &urgent)
	if err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}

	latestRun, _ := r.GetLatestSyncRunAnySource(ctx)
	var lastSyncAt *time.Time
	lastStatus := "NEVER"
	if latestRun != nil {
		lastSyncAt = &latestRun.StartedAt
		lastStatus = latestRun.Status
	}

	return &domain.StatsOverviewData{
		TotalOpportunities:   total,
		TotalInScope:         inScope,
		TotalReview:          review,
		TotalEstimatedValue:  totalValue,
		TotalUrgent:          urgent,
		LastSuccessfulSyncAt: lastSyncAt,
		LastSyncStatus:       lastStatus,
	}, nil
}

func (r *OpportunityRepository) CreateSyncRun(ctx context.Context, run *domain.LicitacaoSyncRun) error {
	if run.ID == "" {
		run.ID = uuid.New().String()
	}
	query := `
	INSERT INTO licitacao_sync_run (
		id, source, started_at, finished_at, status, parameters,
		total_received, total_included, total_reviewed, total_excluded,
		total_updated, total_failed, error_message, correlation_id
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := r.db.ExecContext(ctx, query,
		run.ID, run.Source, run.StartedAt, run.FinishedAt, run.Status, run.Parameters,
		run.TotalReceived, run.TotalIncluded, run.TotalReviewed, run.TotalExcluded,
		run.TotalUpdated, run.TotalFailed, run.ErrorMessage, run.CorrelationID,
	)
	return err
}

func (r *OpportunityRepository) UpdateSyncRun(ctx context.Context, run *domain.LicitacaoSyncRun) error {
	query := `
	UPDATE licitacao_sync_run SET
		finished_at = ?, status = ?, total_received = ?, total_included = ?,
		total_reviewed = ?, total_excluded = ?, total_updated = ?,
		total_failed = ?, error_message = ?
	WHERE id = ?`

	_, err := r.db.ExecContext(ctx, query,
		run.FinishedAt, run.Status, run.TotalReceived, run.TotalIncluded,
		run.TotalReviewed, run.TotalExcluded, run.TotalUpdated,
		run.TotalFailed, run.ErrorMessage, run.ID,
	)
	return err
}

func (r *OpportunityRepository) GetLatestSyncRun(ctx context.Context, source string) (*domain.LicitacaoSyncRun, error) {
	query := `
	SELECT id, source, started_at, finished_at, status, parameters,
		total_received, total_included, total_reviewed, total_excluded,
		total_updated, total_failed, error_message, correlation_id
	FROM licitacao_sync_run
	WHERE source = ? AND status = 'SUCCESS'
	ORDER BY started_at DESC LIMIT 1`

	var run domain.LicitacaoSyncRun
	var finishedAt sql.NullTime
	var errorMessage sql.NullString

	err := r.db.QueryRowContext(ctx, query, source).Scan(
		&run.ID, &run.Source, &run.StartedAt, &finishedAt, &run.Status, &run.Parameters,
		&run.TotalReceived, &run.TotalIncluded, &run.TotalReviewed, &run.TotalExcluded,
		&run.TotalUpdated, &run.TotalFailed, &errorMessage, &run.CorrelationID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if finishedAt.Valid {
		run.FinishedAt = &finishedAt.Time
	}
	if errorMessage.Valid {
		run.ErrorMessage = &errorMessage.String
	}

	return &run, nil
}

func (r *OpportunityRepository) GetLatestSyncRunAnySource(ctx context.Context) (*domain.LicitacaoSyncRun, error) {
	query := `
	SELECT id, source, started_at, finished_at, status, parameters,
		total_received, total_included, total_reviewed, total_excluded,
		total_updated, total_failed, error_message, correlation_id
	FROM licitacao_sync_run
	WHERE status = 'SUCCESS'
	ORDER BY started_at DESC LIMIT 1`

	var run domain.LicitacaoSyncRun
	var finishedAt sql.NullTime
	var errorMessage sql.NullString

	err := r.db.QueryRowContext(ctx, query).Scan(
		&run.ID, &run.Source, &run.StartedAt, &finishedAt, &run.Status, &run.Parameters,
		&run.TotalReceived, &run.TotalIncluded, &run.TotalReviewed, &run.TotalExcluded,
		&run.TotalUpdated, &run.TotalFailed, &errorMessage, &run.CorrelationID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if finishedAt.Valid {
		run.FinishedAt = &finishedAt.Time
	}
	if errorMessage.Valid {
		run.ErrorMessage = &errorMessage.String
	}

	return &run, nil
}

func (r *OpportunityRepository) ListSyncRuns(ctx context.Context, limit int) ([]domain.LicitacaoSyncRun, error) {
	if limit <= 0 {
		limit = 20
	}
	query := `
	SELECT id, source, started_at, finished_at, status, parameters,
		total_received, total_included, total_reviewed, total_excluded,
		total_updated, total_failed, error_message, correlation_id
	FROM licitacao_sync_run
	ORDER BY started_at DESC LIMIT ?`

	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.LicitacaoSyncRun
	for rows.Next() {
		var run domain.LicitacaoSyncRun
		var finishedAt sql.NullTime
		var errorMessage sql.NullString

		err := rows.Scan(
			&run.ID, &run.Source, &run.StartedAt, &finishedAt, &run.Status, &run.Parameters,
			&run.TotalReceived, &run.TotalIncluded, &run.TotalReviewed, &run.TotalExcluded,
			&run.TotalUpdated, &run.TotalFailed, &errorMessage, &run.CorrelationID,
		)
		if err != nil {
			return nil, err
		}

		if finishedAt.Valid {
			run.FinishedAt = &finishedAt.Time
		}
		if errorMessage.Valid {
			run.ErrorMessage = &errorMessage.String
		}

		list = append(list, run)
	}
	return list, nil
}

func scanOpportunity(row *sql.Row) (*domain.LicitacaoOportunidade, error) {
	var opp domain.LicitacaoOportunidade
	var termsJSON string
	var ibgeCode, purchaseNumber, modalityName, disputeModeName sql.NullString
	var purchaseYear sql.NullInt64
	var estimatedValue sql.NullFloat64
	var proposalStart, proposalEnd, publishedAt, sourceUpdated sql.NullTime

	err := row.Scan(
		&opp.ID, &opp.Source, &opp.SourceExternalID, &opp.CrossDedupKey, &opp.OrganizationCNPJ, &opp.OrganizationName,
		&opp.UnitName, &opp.MunicipalityName, &ibgeCode, &opp.UF,
		&purchaseNumber, &purchaseYear, &modalityName, &disputeModeName,
		&opp.StatusSource, &opp.StatusNormalized, &opp.ObjectRaw, &opp.ObjectNormalized,
		&estimatedValue, &opp.ValueStatus, &proposalStart, &proposalEnd,
		&publishedAt, &sourceUpdated, &opp.Classification, &opp.ClassificationScore,
		&termsJSON, &opp.ClassifierVersion, &opp.SourceURL, &opp.LastSeenAt,
		&opp.CreatedAt, &opp.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if ibgeCode.Valid {
		opp.MunicipalityIBGE = &ibgeCode.String
	}
	if purchaseNumber.Valid {
		opp.PurchaseNumber = &purchaseNumber.String
	}
	if purchaseYear.Valid {
		y := int(purchaseYear.Int64)
		opp.PurchaseYear = &y
	}
	if modalityName.Valid {
		opp.ModalityName = &modalityName.String
	}
	if disputeModeName.Valid {
		opp.DisputeModeName = &disputeModeName.String
	}
	if estimatedValue.Valid {
		opp.EstimatedTotalValue = &estimatedValue.Float64
	}
	if proposalStart.Valid {
		opp.ProposalStartAt = &proposalStart.Time
	}
	if proposalEnd.Valid {
		opp.ProposalEndAt = &proposalEnd.Time
	}
	if publishedAt.Valid {
		opp.PublishedAt = &publishedAt.Time
	}
	if sourceUpdated.Valid {
		opp.SourceUpdatedAt = &sourceUpdated.Time
	}

	_ = json.Unmarshal([]byte(termsJSON), &opp.ClassificationTerms)
	return &opp, nil
}

func scanOpportunityRow(rows *sql.Rows) (*domain.LicitacaoOportunidade, error) {
	var opp domain.LicitacaoOportunidade
	var termsJSON string
	var ibgeCode, purchaseNumber, modalityName, disputeModeName sql.NullString
	var purchaseYear sql.NullInt64
	var estimatedValue sql.NullFloat64
	var proposalStart, proposalEnd, publishedAt, sourceUpdated sql.NullTime

	err := rows.Scan(
		&opp.ID, &opp.Source, &opp.SourceExternalID, &opp.CrossDedupKey, &opp.OrganizationCNPJ, &opp.OrganizationName,
		&opp.UnitName, &opp.MunicipalityName, &ibgeCode, &opp.UF,
		&purchaseNumber, &purchaseYear, &modalityName, &disputeModeName,
		&opp.StatusSource, &opp.StatusNormalized, &opp.ObjectRaw, &opp.ObjectNormalized,
		&estimatedValue, &opp.ValueStatus, &proposalStart, &proposalEnd,
		&publishedAt, &sourceUpdated, &opp.Classification, &opp.ClassificationScore,
		&termsJSON, &opp.ClassifierVersion, &opp.SourceURL, &opp.LastSeenAt,
		&opp.CreatedAt, &opp.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if ibgeCode.Valid {
		opp.MunicipalityIBGE = &ibgeCode.String
	}
	if purchaseNumber.Valid {
		opp.PurchaseNumber = &purchaseNumber.String
	}
	if purchaseYear.Valid {
		y := int(purchaseYear.Int64)
		opp.PurchaseYear = &y
	}
	if modalityName.Valid {
		opp.ModalityName = &modalityName.String
	}
	if disputeModeName.Valid {
		opp.DisputeModeName = &disputeModeName.String
	}
	if estimatedValue.Valid {
		opp.EstimatedTotalValue = &estimatedValue.Float64
	}
	if proposalStart.Valid {
		opp.ProposalStartAt = &proposalStart.Time
	}
	if proposalEnd.Valid {
		opp.ProposalEndAt = &proposalEnd.Time
	}
	if publishedAt.Valid {
		opp.PublishedAt = &publishedAt.Time
	}
	if sourceUpdated.Valid {
		opp.SourceUpdatedAt = &sourceUpdated.Time
	}

	_ = json.Unmarshal([]byte(termsJSON), &opp.ClassificationTerms)
	return &opp, nil
}
