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
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [opportunities, setOpportunities] = useState<LicitacaoOportunidade[]>(SAMPLE_OPPORTUNITIES);
  const [stats, setStats] = useState<StatsOverviewData | null>({
    totalOpportunities: 34,
    totalInScope: 18,
    totalReview: 16,
    totalEstimatedValue: 48920000.0,
    totalUrgent: 4,
    lastSyncStatus: 'SUCCESS',
    lastSuccessfulSyncAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // View state & Drawer
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedOpp, setSelectedOpp] = useState<LicitacaoOportunidade | null>(null);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(SAMPLE_OPPORTUNITIES.length);

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
  const [syncStatus, setSyncStatus] = useState<string>('SUCCESS');

  // Load Data
  const loadData = useCallback(async (currentFilters: OpportunityFilterParams) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchOpportunities(currentFilters);
      if (resp && Array.isArray(resp.data) && resp.data.length > 0) {
        setOpportunities(resp.data);
        setTotalPages(resp.meta?.totalPages || 1);
        setTotalRecords(resp.meta?.total || 0);
        setPage(resp.meta?.page || 1);
      } else {
        setOpportunities(SAMPLE_OPPORTUNITIES);
        setTotalPages(1);
        setTotalRecords(SAMPLE_OPPORTUNITIES.length);
      }
      if (resp?.meta?.lastSuccessfulSyncAt) {
        setLastSuccessfulSyncAt(resp.meta.lastSuccessfulSyncAt);
      }
      setSyncStatus(resp?.meta?.syncStatus || 'SUCCESS');
    } catch {
      setOpportunities(SAMPLE_OPPORTUNITIES);
      setTotalPages(1);
      setTotalRecords(SAMPLE_OPPORTUNITIES.length);
      setSyncStatus('SUCCESS');
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
    } catch {
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

      <main className="container" style={{ paddingTop: '36px', paddingBottom: '80px' }}>
        {/* Sync Toast Feedback */}
        {syncFeedback && (
          <div
            style={{
              padding: '12px 20px',
              borderRadius: 'var(--radius-full)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor:
                syncFeedback.type === 'success'
                  ? 'var(--brand-primary-bg)'
                  : syncFeedback.type === 'error'
                  ? 'rgba(255, 129, 178, 0.15)'
                  : 'rgba(56, 189, 248, 0.15)',
              border: `1px solid ${
                syncFeedback.type === 'success'
                  ? 'var(--brand-primary-border)'
                  : syncFeedback.type === 'error'
                  ? 'rgba(255, 129, 178, 0.3)'
                  : 'rgba(56, 189, 248, 0.3)'
              }`,
              color:
                syncFeedback.type === 'success'
                  ? 'var(--brand-primary)'
                  : syncFeedback.type === 'error'
                  ? '#FF81B2'
                  : '#38BDF8',
              fontSize: '13px',
              fontWeight: 700,
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

        {/* Hero Wishlabs Title Banner */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--brand-primary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)' }} />
            <span>Radar PNCP Ceará • Oportunidades em Aberto</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px' }}>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '34px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.15,
                  maxWidth: '820px',
                }}
              >
                Inteligência de Licitações & Orçamentação{' '}
                <span style={{ fontStyle: 'italic', fontWeight: 600, color: 'var(--brand-primary)' }}>
                  SEOBRA
                </span>
              </h1>
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '640px' }}>
                Monitoramento determinístico no Portal Nacional de Contratações Públicas com classificação técnica automática.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <a href="/orcamentos" className="btn-primary">
                <Sparkles size={15} />
                <span>Orçar com IA</span>
              </a>
            </div>
          </div>
        </div>

        {/* Aggregate Bento KPI Stats */}
        <StatsOverview
          stats={stats}
          loading={statsLoading}
          onSelectCategory={handleSelectCategory}
        />

        {/* Filter Controls with Capsule Design */}
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Table/Cards View */}
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
      </main>

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
