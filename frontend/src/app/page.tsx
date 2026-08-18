'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { StatsOverview } from '@/components/StatsOverview';
import { FilterBar } from '@/components/FilterBar';
import { OpportunityTable } from '@/components/OpportunityTable';
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
import { Radio, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function describeValueRange(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `Valor estimado entre ${brl(min)} e ${brl(max)}`;
  if (min !== undefined) return `Valor estimado ≥ ${brl(min)}`;
  if (max !== undefined) return `Valor estimado ≤ ${brl(max)}`;
  return 'Qualquer valor estimado';
}

export default function RadarDashboardPage() {
  const [opportunities, setOpportunities] = useState<LicitacaoOportunidade[]>([]);
  const [stats, setStats] = useState<StatsOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      setTotalPages(resp.meta.totalPages || 1);
      setTotalRecords(resp.meta.total);
      setPage(resp.meta.page);
      if (resp.meta.lastSuccessfulSyncAt) {
        setLastSuccessfulSyncAt(resp.meta.lastSuccessfulSyncAt);
      }
      setSyncStatus(resp.meta.syncStatus);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar oportunidades de licitação.');
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
      console.error('Error loading stats:', err);
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
              message: 'Sincronização concluída com sucesso! Dados atualizados.',
            });
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

  return (
    <div>
      <Header
        lastSyncAt={lastSuccessfulSyncAt}
        syncStatus={syncStatus}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerSync}
      />

      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
        {/* Sync Toast Feedback */}
        {syncFeedback && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor:
                syncFeedback.type === 'success'
                  ? 'var(--status-inscope-bg)'
                  : syncFeedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'var(--accent-blue-subtle)',
              border: `1px solid ${
                syncFeedback.type === 'success'
                  ? 'var(--status-inscope-border)'
                  : syncFeedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(59, 130, 246, 0.3)'
              }`,
              color:
                syncFeedback.type === 'success'
                  ? 'var(--status-inscope-text)'
                  : syncFeedback.type === 'error'
                  ? '#f87171'
                  : '#93c5fd',
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
                fontSize: '12px',
                opacity: 0.8,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Page Title & Intro */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-primary)', marginBottom: '4px' }}>
            <Radio size={16} />
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Radar de Licitações Públicas • Estado do Ceará
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Oportunidades em Obras, Construção Civil & Engenharia
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Filtro ativo: Recebimento de propostas aberto • {describeValueRange(filters.minValue, filters.maxValue)} • Classificação determinística auditável
          </p>
        </div>

        {/* Aggregate Stats */}
        <StatsOverview stats={stats} loading={statsLoading} />

        {/* Filter Controls */}
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {/* Error or Table */}
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
          />
        )}
      </div>
    </div>
  );
}
