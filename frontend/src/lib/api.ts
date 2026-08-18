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
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:8080`;
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
  if (params.maxValue !== undefined) query.set('maxValue', params.maxValue.toString());
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
  });

  if (!res.ok) {
    throw new Error('Erro ao carregar lista de orçamentos.');
  }

  return res.json();
}

export async function fetchOrcamentoDetail(id: string): Promise<Orcamento> {
  const res = await fetch(`${API_BASE}/api/orcamentos/${id}`, {
    cache: 'no-store',
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
  const res = await fetch(`${API_BASE}/api/orcamentos/${id}/exportar-seobra-xlsx`);
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
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao despachar para SEOBRA');
    throw new Error(errText || 'Falha na comunicação com o SEOBRA.');
  }

  return res.json();
}

export async function fetchSeobraStatus(): Promise<SeobraStatusResponse> {
  const res = await fetch(`${API_BASE}/api/seobra/status`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return { status: 'OFFLINE' };
  }

  return res.json();
}
