export type ClassificationType = 'IN_SCOPE' | 'REVIEW' | 'OUT_OF_SCOPE';
export type ValueStatusType = 'KNOWN' | 'VALUE_CONFIDENTIAL' | 'VALUE_UNKNOWN';
export type StatusNormalizedType = 'OPEN' | 'CLOSED' | 'UNKNOWN';
export type OpportunitySource = 'PNCP' | 'TCE-CE';

export function isTceSource(source?: string | null): boolean {
  return source === 'TCE-CE';
}

export function resolveOpportunitySource(source?: string | null): OpportunitySource {
  return source === 'TCE-CE' ? 'TCE-CE' : 'PNCP';
}

export function sourcePortalLabel(source?: string | null): string {
  return isTceSource(source) ? 'Ver no portal TCE-CE' : 'Ver no PNCP';
}

export interface LicitacaoOportunidade {
  id: string;
  source: OpportunitySource | string;
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
  source: OpportunitySource | string;
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
  maxValue?: number;
  classification?: string;
  municipality?: string;
  modality?: string;
  search?: string;
  term?: string;
  minScore?: number;
  deadlineFrom?: string;
  deadlineTo?: string;
  deadlinePreset?: string; // '7' | '15' | '30' — deadlineTo derivado na requisição
  page?: number;
  pageSize?: number;
}

export type OrcamentoStatusType =
  | 'PROCESSANDO_IA'
  | 'AGUARDANDO_REVISAO'
  | 'DESPACHANDO_SEOBRA'
  | 'CONCLUIDO'
  | 'ERRO';

export interface OrcamentoItem {
  id: string;
  orcamentoId: string;
  itemNumero: string;
  codigoReferencia: string;
  fonte: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  confianca: number;
  flagRevisao: boolean;
  observacaoIa?: string;
  categoria?: 'MAO_DE_OBRA' | 'MATERIAL' | 'SERVICO';
  createdAt: string;
  updatedAt: string;
}

export interface Orcamento {
  id: string;
  oportunidadeId?: string;
  titulo: string;
  objeto: string;
  orgao: string;
  localidade: string;
  dataPrecoBase: string;
  bdi: number;
  descontoGeral?: number;
  descontoMaoDeObra?: number;
  descontoMaterial?: number;
  status: OrcamentoStatusType;
  originalFileName: string;
  fileType: string;
  valorTotalEstimado: number;
  valorTotalComBdi: number;
  totalItens: number;
  confiancaMedia: number;
  seobraBudgetId?: string;
  seobraBudgetUrl?: string;
  progressStep?: string;
  progressPercent?: number;
  progressMessage?: string;
  erroMensagem?: string;
  createdAt: string;
  updatedAt: string;
  itens?: OrcamentoItem[];
}

export interface PaginatedOrcamentosResponse {
  total: number;
  limit: number;
  offset: number;
  items: Orcamento[];
}

export interface SeobraStatusResponse {
  status: 'ONLINE' | 'OFFLINE';
  activeSession?: {
    id: string;
    usuario: string;
    urlBase: string;
    isActive: boolean;
    ultimoPing: string;
  };
}

export interface PncpHealth {
  status: 'UP' | 'DOWN';
  latencyMs: number;
  checkedAt: string;
  message: string;
}

export type EditalAnalysisStatusType = 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
export type SeveridadeRiscoType = 'CRITICA' | 'ATENCAO' | 'NORMAL';

export interface EditalPegadinha {
  id: string;
  analysisId: string;
  clausula: string;
  titulo: string;
  descricao: string;
  severidade: SeveridadeRiscoType;
  recomendacao: string;
  impacto: 'DESCLASSIFICACAO' | 'FINANCEIRO' | 'OPERACIONAL';
}

export interface EditalQualificacaoTecnica {
  id: string;
  analysisId: string;
  itemServico: string;
  unidade: string;
  quantidadeExigida: number;
  parcelaMinima: string;
  exigeVisitaTecnica: boolean;
  aceitaDeclaracao: boolean;
  observacao?: string;
}

export interface EditalRequisitoHabilitacao {
  id: string;
  analysisId: string;
  categoria: 'JURIDICA' | 'FISCAL_TRABALHISTA' | 'ECONOMICA' | 'TECNICA';
  documento: string;
  obrigatorio: boolean;
  detalhes?: string;
}

export interface EditalChecklistItem {
  id: string;
  analysisId: string;
  numero: number;
  descricao: string;
  fase: 'PROPOSTA' | 'HABILITACAO' | 'CONTRATACAO';
  marcado: boolean;
  observacao?: string;
}

export interface EditalIndiceFinanceiro {
  id: string;
  analysisId: string;
  sigla: string;
  nome: string;
  valorMinimo: string;
  formula?: string;
  observacao?: string;
}

export interface EditalAnalysis {
  id: string;
  oportunidadeId?: string;
  titulo: string;
  orgao: string;
  numeroEdital: string;
  numeroProcesso: string;
  modalidade: string;
  modoDisputa: string;
  objetoCompleto: string;
  localidade: string;
  dataAbertura: string;
  valorEstimado: number;
  bdiMaximoPermitido?: number;
  prazoExecucao: string;
  regimeExecucao: string;
  status: EditalAnalysisStatusType;
  originalFileName: string;
  fileType: string;
  totalPaginas: number;
  resumoExecutivo: string;
  parecerTecnico: string;
  scoreAderencia: number;
  erroMensagem?: string;
  createdAt: string;
  updatedAt: string;
  pegadinhas?: EditalPegadinha[];
  qualificacoesTecnicas?: EditalQualificacaoTecnica[];
  requisitosHabilitacao?: EditalRequisitoHabilitacao[];
  checklistDocumentos?: EditalChecklistItem[];
  indicesFinanceiros?: EditalIndiceFinanceiro[];
}

export interface PaginatedEditalAnalysesResponse {
  items: EditalAnalysis[];
  total: number;
  limit: number;
  offset: number;
}

// -------------------------------------------------------------
// ORIGIN PLATFORM & REVERSE API TYPES
// -------------------------------------------------------------

export type PlatformCode =
  | 'LICITAMAIS'
  | 'BLL'
  | 'COMPRASGOV'
  | 'SEPLAG_CE'
  | 'BBMNET'
  | 'PNCP'
  | 'TCE_CE'
  | 'OTHER';

export interface OriginPlatformInfo {
  platformName: string;
  platformCode: PlatformCode;
  originUrl: string;
  directSearchUrl: string;
  isDirectMatch: boolean;
  badgeColor: string;
  extraParams?: Record<string, string>;
}

export interface EditalDocumentFile {
  id: string;
  title: string;
  docType: string;
  url: string;
  dataPublicacao?: string;
  isDownloadable: boolean;
}

export interface OpportunityOriginDetail {
  opportunityId: string;
  sourceExternalId: string;
  organizationName: string;
  organizationCnpj: string;
  municipalityName: string;
  uf: string;
  purchaseNumber?: string;
  purchaseYear: number;
  processo?: string;
  modalityName?: string;
  primaryPlatform: OriginPlatformInfo;
  availablePlatforms: OriginPlatformInfo[];
  documents: EditalDocumentFile[];
  directAuditAvailable: boolean;
  suggestedDocumentUrl?: string;
  suggestedDocumentName?: string;
}
