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
      setOpportunities(resp.data || []);
      setTotalPages(resp.meta?.totalPages || 1);
      setTotalRecords(resp.meta?.total || 0);
      setPage(resp.meta?.page || 1);
      if (resp?.meta?.lastSuccessfulSyncAt) {
        setLastSuccessfulSyncAt(resp.meta.lastSuccessfulSyncAt);
      }
      if (resp?.meta?.syncStatus) {
        setSyncStatus(resp.meta.syncStatus);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar oportunidades de licitação do backend.');
      setOpportunities([]);
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
      if (data.lastSyncStatus) {
        setSyncStatus(data.lastSyncStatus);
      }
    } catch (err) {
      console.warn('Erro ao carregar estatísticas do radar:', err);
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
            if (status.latestRun?.status === 'SUCCESS') {
              setSyncFeedback({
                type: 'success',
                message: `Sincronização concluída com sucesso! (${status.latestRun.totalReceived} recebidas, ${status.latestRun.totalIncluded} em escopo).`,
              });
            } else if (status.latestRun?.status === 'PARTIAL') {
              setSyncFeedback({
                type: 'info',
                message: `Sincronização parcial (${status.latestRun.totalReceived} recebidas, ${status.latestRun.totalIncluded} em escopo). Aviso: ${status.latestRun.errorMessage || 'Alguns lotes pendentes'}.`,
              });
            } else if (status.latestRun?.status === 'FAILED') {
              setSyncFeedback({
                type: 'error',
                message: `Falha na sincronização com o PNCP: ${status.latestRun.errorMessage || 'Serviço temporariamente indisponível'}.`,
              });
            } else {
              setSyncFeedback({
                type: 'success',
                message: 'Sincronização finalizada. Dados atualizados.',
              });
            }
            loadData(filters);
            loadStats();
          }
        } catch {
          // Ignore polling errors
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
        message: err.message || 'Falha ao disparar sincronização com o PNCP.',
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
              padding: '14px 20px',
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

        {/* Table/Cards View or Error State */}
        {error ? (
          <ErrorState
            message={error}
            lastValidSyncAt={lastSuccessfulSyncAt}
            onRetry={() => {
              loadData(filters);
              loadStats();
            }}
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
