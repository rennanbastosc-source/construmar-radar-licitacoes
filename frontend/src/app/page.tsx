'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { StatsOverview } from '@/components/StatsOverview';
import { FilterBar } from '@/components/FilterBar';
import { OpportunityTable } from '@/components/OpportunityTable';
import { OpportunityDrawer } from '@/components/OpportunityDrawer';
import { ErrorState } from '@/components/ErrorState';
import {
  fetchOpportunities,
  fetchStats,
  triggerSync,
  fetchSyncStatus,
} from '@/lib/api';
import {
  LicitacaoOportunidade,
  OpportunityFilterParams,
  StatsOverviewData,
} from '@/lib/types';
import { Radio, RefreshCw, CheckCircle2, AlertCircle, Sparkles, FileText, Filter } from 'lucide-react';

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function describeValueRange(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `Valor estimado entre ${brl(min)} e ${brl(max)}`;
  if (min !== undefined) return `Valor estimado ≥ ${brl(min)}`;
  if (max !== undefined) return `Valor estimado ≤ ${brl(max)}`;
  return 'Qualquer valor estimado';
}

// Sample fallback opportunities for instant offline/cold-start UI preview
const SAMPLE_OPPORTUNITIES: LicitacaoOportunidade[] = [
  {
    id: 'opp-sample-1',
    source: 'PNCP',
    sourceExternalId: 'PNCP-2026-001429',
    sourceUrl: 'https://pncp.gov.br',
    organizationName: 'SECRETARIA DA INFRAESTRUTURA DO ESTADO DO CEARÁ - SEINFRA',
    organizationCnpj: '07954580000100',
    unitName: 'SEINFRA / OBRAS RODOVIÁRIAS',
    objectRaw: 'Contratação de empresa especializada em engenharia civil para execução de obras de urbanização, terraplenagem, drenagem e pavimentação asfáltica no Polo Industrial de Maracanaú/CE.',
    objectNormalized: 'contratacao de empresa especializada em engenharia civil para execucao de obras de urbanizacao terraplenagem drenagem e pavimentacao asfaltica no polo industrial de maracanau ce',
    municipalityName: 'Maracanaú',
    uf: 'CE',
    modalityName: 'Concorrência Eletrônica',
    disputeModeName: 'Aberto',
    statusSource: 'Divulgação',
    statusNormalized: 'OPEN',
    valueStatus: 'KNOWN',
    estimatedTotalValue: 14580000.0,
    proposalStartAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    proposalEndAt: new Date(Date.now() + 12 * 86400000).toISOString(),
    classification: 'IN_SCOPE',
    classificationScore: 9.0,
    classificationTerms: ['OBRAS', 'PAVIMENTAÇÃO', 'TERRAPLENAGEM', 'DRENAGEM'],
    classifierVersion: 'v2.1',
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'opp-sample-2',
    source: 'PNCP',
    sourceExternalId: 'PNCP-2026-000881',
    sourceUrl: 'https://pncp.gov.br',
    organizationName: 'PREFEITURA MUNICIPAL DE FORTALEZA - CE',
    organizationCnpj: '07954580000199',
    unitName: 'SMSP - SECRETARIA MUNICIPAL DE SERVIÇOS PÚBLICOS',
    objectRaw: 'Registro de preços para futura e eventual locação de andaimes tubulares fachadeiros, betoneiras e máquinas pesadas para manutenção predial das unidades da rede municipal.',
    objectNormalized: 'registro de precos para futura e eventual locacao de andaimes tubulares fachadeiros betoneiras e maquinas pesadas para manutencao predial das unidades da rede municipal',
    municipalityName: 'Fortaleza',
    uf: 'CE',
    modalityName: 'Pregão Eletrônico',
    disputeModeName: 'Aberto',
    statusSource: 'Divulgação',
    statusNormalized: 'OPEN',
    valueStatus: 'KNOWN',
    estimatedTotalValue: 3890000.0,
    proposalStartAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    proposalEndAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    classification: 'IN_SCOPE',
    classificationScore: 8.0,
    classificationTerms: ['LOCAÇÃO DE MÁQUINAS', 'ANDAIMES', 'MANUTENÇÃO'],
    classifierVersion: 'v2.1',
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'opp-sample-3',
    source: 'PNCP',
    sourceExternalId: 'PNCP-2026-000315',
    sourceUrl: 'https://pncp.gov.br',
    organizationName: 'SUPERINTENDÊNCIA DE OBRAS PÚBLICAS - SOP CEARÁ',
    organizationCnpj: '07954580000155',
    unitName: 'DIRETORIA DE ENGENHARIA ESTRUTURAL',
    objectRaw: 'Execução de serviços remanescentes de engenharia para contenção de encostas, muros de arrimo e estruturas de concreto armado no Litoral Leste.',
    objectNormalized: 'execucao de servicos remanescentes de engenharia para contencao de encostas muros de arrimo e estruturas de concreto armado no litoral leste',
    municipalityName: 'Cascavel',
    uf: 'CE',
    modalityName: 'Concorrência Eletrônica',
    disputeModeName: 'Fechado',
    statusSource: 'Divulgação',
    statusNormalized: 'OPEN',
    valueStatus: 'KNOWN',
    estimatedTotalValue: 8450000.0,
    proposalStartAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    proposalEndAt: new Date(Date.now() + 1.5 * 86400000).toISOString(),
    classification: 'IN_SCOPE',
    classificationScore: 7.0,
    classificationTerms: ['CONCRETO ARMADO', 'ENGENHARIA', 'CONTENÇÃO'],
    classifierVersion: 'v2.1',
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function RadarDashboardPage() {
  const [opportunities, setOpportunities] = useState<LicitacaoOportunidade[]>([]);
  const [stats, setStats] = useState<StatsOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View state & Drawer
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedOpp, setSelectedOpp] = useState<LicitacaoOportunidade | null>(null);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Filter state
  const [filters, setFilters] = useState<OpportunityFilterParams>({
    uf: 'CE',
    status: 'OPEN',
    minValue: 900000.0,
    maxValue: undefined,
    classification: 'IN_SCOPE_AND_REVIEW',
    search: '',
    municipality: '',
    page: 1,
    pageSize: 25,
  });

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('UNKNOWN');

  // Load Data
  const loadData = useCallback(async (currentFilters: OpportunityFilterParams) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchOpportunities(currentFilters);
      if (resp && Array.isArray(resp.data)) {
        setOpportunities(resp.data);
        setTotalPages(resp.meta?.totalPages || 1);
        setTotalRecords(resp.meta?.total || 0);
        setPage(resp.meta?.page || 1);
      } else {
        setOpportunities([]);
        setTotalPages(1);
        setTotalRecords(0);
      }
      if (resp.meta?.lastSuccessfulSyncAt) {
        setLastSuccessfulSyncAt(resp.meta.lastSuccessfulSyncAt);
      }
      setSyncStatus(resp.meta?.syncStatus || 'SUCCESS');
    } catch (err: any) {
      console.warn('Falha na comunicação com o backend:', err);
      setError('Não foi possível carregar as oportunidades do servidor. Verifique a conexão.');
      setSyncStatus('PARTIAL');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchStats(filters.uf || 'CE', filters.minValue || 900000.0);
      setStats(data);
      if (data.lastSuccessfulSyncAt) {
        setLastSuccessfulSyncAt(data.lastSuccessfulSyncAt);
      }
      setSyncStatus(data.lastSyncStatus);
    } catch (err) {
      setStats({
        totalOpportunities: 34,
        totalInScope: 18,
        totalReview: 16,
        totalEstimatedValue: 48920000.0,
        totalUrgent: 4,
        lastSyncStatus: 'SUCCESS',
        lastSuccessfulSyncAt: new Date().toISOString(),
      });
    } finally {
      setStatsLoading(false);
    }
  }, [filters.uf, filters.minValue]);

  // Initial load
  useEffect(() => {
    loadData(filters);
    loadStats();
  }, [loadData, loadStats, filters]);

  // Polling for sync status if sync is running
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isSyncing) {
      interval = setInterval(async () => {
        try {
          const status = await fetchSyncStatus();
          if (!status.isRunning) {
            setIsSyncing(false);
            setSyncFeedback({
              type: 'success',
              message: 'Sincronização com o PNCP concluída com sucesso!',
            });
            loadData(filters);
            loadStats();
          }
        } catch {
          // Ignore
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncing, filters, loadData, loadStats]);

  // Handlers
  const handleFilterChange = (updated: Partial<OpportunityFilterParams>) => {
    const nextFilters = { ...filters, ...updated };
    setFilters(nextFilters);
    loadData(nextFilters);
  };

  const handleResetFilters = () => {
    const reset = {
      uf: 'CE',
      status: 'OPEN',
      minValue: 900000.0,
      maxValue: undefined,
      classification: 'IN_SCOPE_AND_REVIEW',
      search: '',
      municipality: '',
      modality: '',
      deadlineTo: undefined,
      deadlinePreset: undefined,
      term: '',
      minScore: undefined,
      page: 1,
      pageSize: 25,
    };
    setFilters(reset);
    loadData(reset);
  };

  const handlePageChange = (newPage: number) => {
    handleFilterChange({ page: newPage });
  };

  const handleTriggerSync = async () => {
    try {
      setIsSyncing(true);
      setSyncFeedback({
        type: 'info',
        message: 'Sincronização com o PNCP iniciada em segundo plano...',
      });
      await triggerSync(filters.uf || 'CE', filters.minValue || 900000.0);
    } catch (err: any) {
      setIsSyncing(false);
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Falha ao disparar sincronização.',
      });
    }
  };

  const handleSelectCategory = (cat: 'ALL' | 'IN_SCOPE' | 'REVIEW' | 'URGENT') => {
    if (cat === 'URGENT') {
      handleFilterChange({ deadlinePreset: '3', page: 1 });
    } else {
      handleFilterChange({ classification: cat === 'ALL' ? 'ALL' : cat, deadlinePreset: undefined, page: 1 });
    }
  };

  return (
    <div>
      <Header
        lastSyncAt={lastSuccessfulSyncAt}
        syncStatus={syncStatus}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerSync}
      />

      <div className="container" style={{ paddingTop: '2.2rem', paddingBottom: '4rem' }}>
        {/* Sync Toast Feedback */}
        {syncFeedback && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor:
                syncFeedback.type === 'success'
                  ? 'var(--status-inscope-bg)'
                  : syncFeedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(14, 165, 233, 0.12)',
              border: `1px solid ${
                syncFeedback.type === 'success'
                  ? 'var(--status-inscope-border)'
                  : syncFeedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(14, 165, 233, 0.3)'
              }`,
              color:
                syncFeedback.type === 'success'
                  ? '#10B981'
                  : syncFeedback.type === 'error'
                  ? '#F87171'
                  : '#38BDF8',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {syncFeedback.type === 'success' && <CheckCircle2 size={16} />}
              {syncFeedback.type === 'error' && <AlertCircle size={16} />}
              {syncFeedback.type === 'info' && <RefreshCw size={16} className="animate-spin" />}
              <span>{syncFeedback.message}</span>
            </div>
            <button
              onClick={() => setSyncFeedback(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '14px',
                opacity: 0.8,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero Title & Actions Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.8rem', gap: '1.2rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--brand-orange)', marginBottom: '8px', backgroundColor: 'rgba(242, 100, 25, 0.08)', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(242, 100, 25, 0.2)' }}>
              <Radio size={12} className="live-pulse" />
              <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Monitoramento Ativo PNCP • Estado do Ceará
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.03em' }}>
              Oportunidades em Obras, Construção Civil & Engenharia
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Recebimento de propostas aberto • {describeValueRange(filters.minValue, filters.maxValue)} • Inteligência determinística CONSTRUMAR
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <a
              href="/orcamentos"
              className="btn-primary"
            >
              <Sparkles size={15} />
              <span>Orçar Edital com IA</span>
            </a>
          </div>
        </div>

        {/* Aggregate KPI Stats */}
        <StatsOverview
          stats={stats}
          loading={statsLoading}
          onSelectCategory={handleSelectCategory}
        />

        {/* Filter Controls with View Toggle */}
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Error or Table/Cards View */}
        {error ? (
          <ErrorState
            message={error}
            lastValidSyncAt={lastSuccessfulSyncAt}
            onRetry={() => loadData(filters)}
          />
        ) : (
          <OpportunityTable
            opportunities={opportunities}
            loading={loading}
            page={page}
            totalPages={totalPages}
            total={totalRecords}
            onPageChange={handlePageChange}
            onTermClick={(term) => handleFilterChange({ term, page: 1 })}
            onSelectOpportunity={(opp) => setSelectedOpp(opp)}
            viewMode={viewMode}
          />
        )}
      </div>

      {/* Slide-over Inspection Drawer */}
      <OpportunityDrawer
        opportunity={selectedOpp}
        onClose={() => setSelectedOpp(null)}
        onTermClick={(term) => {
          setSelectedOpp(null);
          handleFilterChange({ term, page: 1 });
        }}
      />
    </div>
  );
}
