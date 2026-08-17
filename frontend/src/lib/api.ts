import {
  OpportunityDetailResponse,
  OpportunityFilterParams,
  PaginatedOpportunitiesResponse,
  StatsOverviewData,
  LicitacaoSyncRun,
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
  return 'http://localhost:8080';
}

const API_BASE = getApiBase();

export async function fetchOpportunities(
  params: OpportunityFilterParams
): Promise<PaginatedOpportunitiesResponse> {
  const query = new URLSearchParams();
  if (params.uf) query.set('uf', params.uf);
  if (params.status) query.set('status', params.status);
  if (params.minValue !== undefined) query.set('minValue', params.minValue.toString());
  if (params.classification) query.set('classification', params.classification);
  if (params.municipality) query.set('municipality', params.municipality);
  if (params.modality) query.set('modality', params.modality);
  if (params.search) query.set('search', params.search);
  if (params.deadlineFrom) query.set('deadlineFrom', params.deadlineFrom);
  if (params.deadlineTo) query.set('deadlineTo', params.deadlineTo);
  if (params.page) query.set('page', params.page.toString());
  if (params.pageSize) query.set('pageSize', params.pageSize.toString());

  const res = await fetch(`${API_BASE}/api/licitacoes/oportunidades?${query.toString()}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao carregar oportunidades de licitação.');
  }

  return res.json();
}

export async function fetchOpportunityDetail(id: string): Promise<OpportunityDetailResponse> {
  const res = await fetch(`${API_BASE}/api/licitacoes/oportunidades/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao carregar detalhes da oportunidade.');
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
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erro ao disparar sincronização com PNCP.');
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
  });

  if (!res.ok) {
    throw new Error('Erro ao carregar histórico de sincronizações.');
  }

  const json = await res.json();
  return json.data;
}
