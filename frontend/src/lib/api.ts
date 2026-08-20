import {
  OpportunityDetailResponse,
  OpportunityFilterParams,
  PaginatedOpportunitiesResponse,
  StatsOverviewData,
  LicitacaoSyncRun,
  PncpHealth,
  OpportunityOriginDetail,
} from './types';

function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:8080`;
  }
  return 'http://localhost:8080';
}

const API_BASE = getApiBase();
const API_AUTH_TOKEN = process.env.NEXT_PUBLIC_API_AUTH_TOKEN ?? '';

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${API_AUTH_TOKEN}` };
}

export async function fetchOpportunities(
  params: OpportunityFilterParams
): Promise<PaginatedOpportunitiesResponse> {
  const query = new URLSearchParams();
  if (params.uf) query.set('uf', params.uf);
  if (params.status) query.set('status', params.status);
  if (params.minValue !== undefined) query.set('minValue', params.minValue.toString());
  if (params.maxValue !== undefined) query.set('maxValue', params.maxValue.toString());
  if (params.classification) query.set('classification', params.classification);
  if (params.municipality) query.set('municipality', params.municipality);
  if (params.modality) query.set('modality', params.modality);
  if (params.search) query.set('search', params.search);
  if (params.term) query.set('term', params.term);
  if (params.minScore !== undefined) query.set('minScore', params.minScore.toString());
  if (params.deadlineFrom) query.set('deadlineFrom', params.deadlineFrom);
  if (params.deadlineTo) query.set('deadlineTo', params.deadlineTo);
  if (!params.deadlineTo && params.deadlinePreset) {
    const days = Number(params.deadlinePreset);
    if (days > 0) query.set('deadlineTo', new Date(Date.now() + days * 86400000).toISOString());
  }
  if (params.page) query.set('page', params.page.toString());
  if (params.pageSize) query.set('pageSize', params.pageSize.toString());

  const res = await fetch(`${API_BASE}/api/licitacoes/oportunidades?${query.toString()}`, {
    cache: 'no-store',
    headers: authHeaders(),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao carregar oportunidades de licitação.');
  }

  return res.json();
}

export async function fetchOpportunityDetail(id: string): Promise<OpportunityDetailResponse> {
  const encodedId = encodeURIComponent(id);
  const res = await fetch(`${API_BASE}/api/licitacoes/oportunidades/${encodedId}`, {
    cache: 'no-store',
    headers: authHeaders(),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao carregar detalhes da oportunidade.');
  }

  return res.json();
}

export async function fetchOpportunityOrigin(id: string): Promise<OpportunityOriginDetail> {
  const encodedId = encodeURIComponent(id);
  const res = await fetch(`${API_BASE}/api/licitacoes/oportunidades/${encodedId}/origem`, {
    cache: 'no-store',
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao carregar origem da licitação.');
  }

  const json = await res.json();
  return json.data;
}

export async function triggerDirectEditalAnalysis(
  opportunityId: string,
  documentUrl?: string
): Promise<EditalAnalysis> {
  const encodedId = encodeURIComponent(opportunityId);
  const res = await fetch(`${API_BASE}/api/licitacoes/oportunidades/${encodedId}/auditar-edital`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ documentUrl }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Falha ao processar e auditar o edital.');
  }

  return res.json();
}

export async function fetchStats(
  uf: string = 'CE',
  minValue: number = 900000.0
): Promise<StatsOverviewData> {
  const query = new URLSearchParams({
    uf,
    minValue: minValue.toString(),
  });

  const res = await fetch(`${API_BASE}/api/licitacoes/stats?${query.toString()}`, {
    cache: 'no-store',
    headers: authHeaders(),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error('Erro ao carregar resumo de estatísticas.');
  }

  const json = await res.json();
  return json.data;
}

export async function triggerSync(
  uf: string = 'CE',
  minValue: number = 900000.0
): Promise<{ message: string; status: string }> {
  const query = new URLSearchParams({
    uf,
    minValue: minValue.toString(),
  });

  const res = await fetch(`${API_BASE}/api/licitacoes/sync?${query.toString()}`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao disparar sincronização com PNCP.');
  }

  return res.json();
}

export async function triggerTCESync(): Promise<{
  message: string;
  status: string;
  startedAt: string;
}> {
  const res = await fetch(`${API_BASE}/api/licitacoes/sync-tce`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || 'Erro ao disparar sincronização com o portal TCE-CE.'
    );
  }

  return res.json();
}

export interface SyncStatusResponse {
  isRunning: boolean;
  currentRun?: LicitacaoSyncRun | null;
  latestRun?: LicitacaoSyncRun | null;
}

export async function fetchSyncStatus(): Promise<SyncStatusResponse> {
  const res = await fetch(`${API_BASE}/api/licitacoes/sync/status`, {
    cache: 'no-store',
    headers: authHeaders(),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error('Erro ao verificar status da sincronização.');
  }

  const json = await res.json();
  return json.data;
}

export async function fetchSyncHistory(limit: number = 20): Promise<LicitacaoSyncRun[]> {
  const res = await fetch(`${API_BASE}/api/licitacoes/sync/history?limit=${limit}`, {
    cache: 'no-store',
    headers: authHeaders(),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error('Erro ao carregar histórico de sincronizações.');
  }

  const json = await res.json();
  return json.data;
}

// -------------------------------------------------------------
// ORÇAMENTOS INTELIGENTES & SEOBRA API
// -------------------------------------------------------------

import {
  Orcamento,
  PaginatedOrcamentosResponse,
  SeobraStatusResponse,
} from './types';

export async function uploadEditalOrcamento(
  file: File,
  oportunidadeId?: string
): Promise<Orcamento> {
  const formData = new FormData();
  formData.append('file', file);
  if (oportunidadeId) {
    formData.append('oportunidadeId', oportunidadeId);
  }

  const res = await fetch(`${API_BASE}/api/orcamentos/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Falha no upload/processamento');
    throw new Error(errText || 'Falha ao processar e extrair itens do documento.');
  }

  return res.json();
}

export async function fetchOrcamentos(
  limit: number = 20,
  offset: number = 0
): Promise<PaginatedOrcamentosResponse> {
  const res = await fetch(`${API_BASE}/api/orcamentos?limit=${limit}&offset=${offset}`, {
    cache: 'no-store',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error('Erro ao carregar lista de orçamentos.');
  }

  return res.json();
}

export async function fetchOrcamentoDetail(id: string): Promise<Orcamento> {
  const res = await fetch(`${API_BASE}/api/orcamentos/${id}`, {
    cache: 'no-store',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error('Erro ao carregar detalhes do orçamento.');
  }

  return res.json();
}

export async function updateOrcamentoItens(orcamento: Orcamento): Promise<Orcamento> {
  const res = await fetch(`${API_BASE}/api/orcamentos/${orcamento.id}/itens`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orcamento),
  });

  if (!res.ok) {
    throw new Error('Erro ao salvar alterações na planilha orçamentária.');
  }

  return res.json();
}

export async function downloadOrcamentoSeobraXlsx(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/orcamentos/${id}/exportar-seobra-xlsx`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error('Erro ao baixar planilha SEOBRA.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orcamento_seobra_${id.slice(0, 8)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function despacharParaSeobra(id: string): Promise<Orcamento> {
  const res = await fetch(`${API_BASE}/api/orcamentos/${id}/despachar-seobra`, {
    method: 'POST',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao despachar para SEOBRA');
    throw new Error(errText || 'Falha na comunicação com o SEOBRA.');
  }

  return res.json();
}

export async function fetchPncpHealth(): Promise<PncpHealth> {
  const res = await fetch(`${API_BASE}/api/licitacoes/pncp-health`, {
    cache: 'no-store',
    headers: authHeaders(),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('Erro ao verificar saúde da API PNCP.');
  const json = await res.json();
  return json.data;
}

export async function fetchTceHealth(): Promise<PncpHealth> {
  const res = await fetch(`${API_BASE}/api/licitacoes/tce-health`, {
    cache: 'no-store',
    headers: authHeaders(),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('Erro ao verificar saúde do portal TCE-CE.');
  const json = await res.json();
  return json.data;
}

export async function fetchSeobraStatus(): Promise<SeobraStatusResponse> {
  const res = await fetch(`${API_BASE}/api/seobra/status`, {
    cache: 'no-store',
    headers: authHeaders(),
  });

  if (!res.ok) {
    return { status: 'OFFLINE' };
  }

  return res.json();
}

// -------------------------------------------------------------
// ANALISTA IA DE EDITAIS & REQUISITOS DE HABILITAÇÃO API
// -------------------------------------------------------------

import {
  EditalAnalysis,
  PaginatedEditalAnalysesResponse,
} from './types';

export async function uploadEditalForAnalysis(
  files: File | File[],
  oportunidadeId?: string
): Promise<EditalAnalysis> {
  const formData = new FormData();
  if (Array.isArray(files)) {
    files.forEach((f) => formData.append('files', f));
    // Also append the first file to 'file' for legacy fallback
    if (files.length > 0) {
      formData.append('file', files[0]);
    }
  } else {
    formData.append('file', files);
    formData.append('files', files);
  }

  if (oportunidadeId) {
    formData.append('oportunidadeId', oportunidadeId);
  }

  const res = await fetch(`${API_BASE}/api/editais/analisar`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Falha na análise do edital');
    throw new Error(errText || 'Falha ao processar e auditar os editais.');
  }

  return res.json();
}

export async function fetchEditalAnalyses(
  limit: number = 20,
  offset: number = 0
): Promise<PaginatedEditalAnalysesResponse> {
  const res = await fetch(`${API_BASE}/api/editais?limit=${limit}&offset=${offset}`, {
    cache: 'no-store',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error('Erro ao carregar histórico de análises de editais.');
  }

  return res.json();
}

export async function fetchEditalAnalysisDetail(id: string): Promise<EditalAnalysis> {
  const res = await fetch(`${API_BASE}/api/editais/${id}`, {
    cache: 'no-store',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error('Erro ao carregar detalhes da análise do edital.');
  }

  return res.json();
}

export async function toggleEditalChecklist(itemId: string, marcado: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/api/editais/checklist/${itemId}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ marcado }),
  });

  if (!res.ok) {
    throw new Error('Erro ao atualizar item do checklist.');
  }
}
