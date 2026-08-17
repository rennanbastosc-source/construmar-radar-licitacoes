export type ClassificationType = 'IN_SCOPE' | 'REVIEW' | 'OUT_OF_SCOPE';
export type ValueStatusType = 'KNOWN' | 'VALUE_CONFIDENTIAL' | 'VALUE_UNKNOWN';
export type StatusNormalizedType = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export interface LicitacaoOportunidade {
  id: string;
  source: string;
  sourceExternalId: string;
  organizationCnpj: string;
  organizationName: string;
  unitName: string;
  municipalityName: string;
  municipalityIbgeCode?: string;
  uf: string;
  purchaseNumber?: string;
  purchaseYear?: number;
  modalityName?: string;
  disputeModeName?: string;
  statusSource: string;
  statusNormalized: StatusNormalizedType;
  objectRaw: string;
  objectNormalized: string;
  estimatedTotalValue?: number;
  valueStatus: ValueStatusType;
  proposalStartAt?: string;
  proposalEndAt?: string;
  publishedAt?: string;
  sourceUpdatedAt?: string;
  classification: ClassificationType;
  classificationScore: number;
  classificationTerms: string[];
  classifierVersion: string;
  sourceUrl: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  documents?: LicitacaoDocumento[];
}

export interface LicitacaoDocumento {
  id: string;
  opportunityId: string;
  title: string;
  docType: string;
  url: string;
  sourceDocId: string;
  createdAt: string;
}

export interface LicitacaoPayloadSnapshot {
  id: string;
  opportunityId: string;
  resourceType: string;
  rawJson: string;
  payloadHash: string;
  createdAt: string;
}

export interface LicitacaoSyncRun {
  id: string;
  source: string;
  startedAt: string;
  finishedAt?: string;
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  parameters: string;
  totalReceived: number;
  totalIncluded: number;
  totalReviewed: number;
  totalExcluded: number;
  totalUpdated: number;
  totalFailed: number;
  errorMessage?: string;
  correlationId: string;
}

export interface OpportunityMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  lastSuccessfulSyncAt?: string;
  syncStatus: string;
}

export interface PaginatedOpportunitiesResponse {
  data: LicitacaoOportunidade[];
  meta: OpportunityMeta;
}

export interface OpportunityDetailResponse {
  data: LicitacaoOportunidade;
  snapshots: LicitacaoPayloadSnapshot[];
}

export interface StatsOverviewData {
  totalOpportunities: number;
  totalInScope: number;
  totalReview: number;
  totalEstimatedValue: number;
  totalUrgent: number;
  lastSuccessfulSyncAt?: string;
  lastSyncStatus: string;
}

export interface OpportunityFilterParams {
  uf?: string;
  status?: string;
  minValue?: number;
  classification?: string;
  municipality?: string;
  modality?: string;
  search?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  page?: number;
  pageSize?: number;
}
