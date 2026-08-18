package domain

import (
	"time"
)

// Classification statuses
const (
	ClassificationInScope    = "IN_SCOPE"
	ClassificationReview     = "REVIEW"
	ClassificationOutOfScope = "OUT_OF_SCOPE"
)

// Value statuses
const (
	ValueStatusKnown        = "KNOWN"
	ValueStatusConfidential = "VALUE_CONFIDENTIAL"
	ValueStatusUnknown      = "VALUE_UNKNOWN"
)

// Normalized statuses
const (
	StatusNormalizedOpen    = "OPEN"
	StatusNormalizedClosed  = "CLOSED"
	StatusNormalizedUnknown = "UNKNOWN"
)

// Sync run statuses
const (
	SyncStatusRunning = "RUNNING"
	SyncStatusSuccess = "SUCCESS"
	SyncStatusPartial = "PARTIAL"
	SyncStatusFailed  = "FAILED"
)

// LicitacaoOportunidade represents a normalized public bidding opportunity.
type LicitacaoOportunidade struct {
	ID               string `json:"id"`
	Source           string `json:"source"`
	SourceExternalID string `json:"sourceExternalId"`
	// DedupKey is the stable identity (cnpj|processo_digitos); empty means deduplicate by source_external_id.
	DedupKey            string     `json:"-"`
	OrganizationCNPJ    string     `json:"organizationCnpj"`
	OrganizationName    string     `json:"organizationName"`
	UnitName            string     `json:"unitName"`
	MunicipalityName    string     `json:"municipalityName"`
	MunicipalityIBGE    *string    `json:"municipalityIbgeCode,omitempty"`
	UF                  string     `json:"uf"`
	PurchaseNumber      *string    `json:"purchaseNumber,omitempty"`
	PurchaseYear        *int       `json:"purchaseYear,omitempty"`
	ModalityName        *string    `json:"modalityName,omitempty"`
	DisputeModeName     *string    `json:"disputeModeName,omitempty"`
	StatusSource        string     `json:"statusSource"`
	StatusNormalized    string     `json:"statusNormalized"`
	ObjectRaw           string     `json:"objectRaw"`
	ObjectNormalized    string     `json:"objectNormalized"`
	EstimatedTotalValue *float64   `json:"estimatedTotalValue,omitempty"`
	ValueStatus         string     `json:"valueStatus"`
	ProposalStartAt     *time.Time `json:"proposalStartAt,omitempty"`
	ProposalEndAt       *time.Time `json:"proposalEndAt,omitempty"`
	PublishedAt         *time.Time `json:"publishedAt,omitempty"`
	SourceUpdatedAt     *time.Time `json:"sourceUpdatedAt,omitempty"`
	Classification      string     `json:"classification"`
	ClassificationScore float64    `json:"classificationScore"`
	ClassificationTerms []string   `json:"classificationTerms"`
	ClassifierVersion   string     `json:"classifierVersion"`
	SourceURL           string     `json:"sourceUrl"`
	LastSeenAt          time.Time  `json:"lastSeenAt"`
	CreatedAt           time.Time  `json:"createdAt"`
	UpdatedAt           time.Time  `json:"updatedAt"`

	// Relational details (when loaded)
	Documents []LicitacaoDocumento `json:"documents,omitempty"`
}

// LicitacaoDocumento represents attached official documents or edital files.
type LicitacaoDocumento struct {
	ID            string    `json:"id"`
	OpportunityID string    `json:"opportunityId"`
	Title         string    `json:"title"`
	DocType       string    `json:"docType"`
	URL           string    `json:"url"`
	SourceDocID   string    `json:"sourceDocId"`
	CreatedAt     time.Time `json:"createdAt"`
}

// LicitacaoPayloadSnapshot represents the raw payload evidence for auditability.
type LicitacaoPayloadSnapshot struct {
	ID            string    `json:"id"`
	OpportunityID string    `json:"opportunityId"`
	ResourceType  string    `json:"resourceType"` // "list", "detail"
	RawJSON       string    `json:"rawJson"`
	PayloadHash   string    `json:"payloadHash"`
	CreatedAt     time.Time `json:"createdAt"`
}

// LicitacaoSyncRun represents the operational history of a synchronization job.
type LicitacaoSyncRun struct {
	ID            string     `json:"id"`
	Source        string     `json:"source"`
	StartedAt     time.Time  `json:"startedAt"`
	FinishedAt    *time.Time `json:"finishedAt,omitempty"`
	Status        string     `json:"status"` // RUNNING, SUCCESS, PARTIAL, FAILED
	Parameters    string     `json:"parameters"`
	TotalReceived int        `json:"totalReceived"`
	TotalIncluded int        `json:"totalIncluded"`
	TotalReviewed int        `json:"totalReviewed"`
	TotalExcluded int        `json:"totalExcluded"`
	TotalUpdated  int        `json:"totalUpdated"`
	TotalFailed   int        `json:"totalFailed"`
	ErrorMessage  *string    `json:"errorMessage,omitempty"`
	CorrelationID string     `json:"correlationId"`
}

// OpportunityFilter defines query parameters for listing opportunities.
type OpportunityFilter struct {
	UF             string
	Status         string
	MinValue       *float64
	MaxValue       *float64
	Classification string
	Term           string   // filter by classification term (matched in classification_terms JSON)
	MinScore       *float64 // minimum classification_score
	Municipality   string
	Modality       string
	Search         string
	DeadlineFrom   *time.Time
	DeadlineTo     *time.Time
	Page           int
	PageSize       int
}

// PaginatedOpportunities represents the standard API response structure.
type PaginatedOpportunities struct {
	Data []LicitacaoOportunidade `json:"data"`
	Meta OpportunityMeta         `json:"meta"`
}

type OpportunityMeta struct {
	Page                 int        `json:"page"`
	PageSize             int        `json:"pageSize"`
	Total                int        `json:"total"`
	TotalPages           int        `json:"totalPages"`
	HasNext              bool       `json:"hasNext"`
	LastSuccessfulSyncAt *time.Time `json:"lastSuccessfulSyncAt,omitempty"`
	SyncStatus           string     `json:"syncStatus"`
}

type StatsOverviewData struct {
	TotalOpportunities   int        `json:"totalOpportunities"`
	TotalInScope         int        `json:"totalInScope"`
	TotalReview          int        `json:"totalReview"`
	TotalEstimatedValue  float64    `json:"totalEstimatedValue"`
	TotalUrgent          int        `json:"totalUrgent"` // Ends in <= 3 days
	LastSuccessfulSyncAt *time.Time `json:"lastSuccessfulSyncAt,omitempty"`
	LastSyncStatus       string     `json:"lastSyncStatus"`
}
