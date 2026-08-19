'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
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

interface RadarContextType {
  opportunities: LicitacaoOportunidade[];
  stats: StatsOverviewData | null;
  loading: boolean;
  statsLoading: boolean;
  error: string | null;
  viewMode: 'table' | 'cards';
  selectedOpp: LicitacaoOportunidade | null;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
  filters: OpportunityFilterParams;
  isSyncing: boolean;
  syncFeedback: { type: 'success' | 'info' | 'error'; message: string } | null;
  lastSuccessfulSyncAt: string | null;
  syncStatus: string;

  // Actions
  setViewMode: (mode: 'table' | 'cards') => void;
  setSelectedOpp: (opp: LicitacaoOportunidade | null) => void;
  setSyncFeedback: (fb: { type: 'success' | 'info' | 'error'; message: string } | null) => void;
  handleFilterChange: (updated: Partial<OpportunityFilterParams>) => void;
  handleResetFilters: () => void;
  handlePageChange: (newPage: number) => void;
  handleTriggerSync: () => Promise<void>;
  handleSelectCategory: (cat: 'ALL' | 'IN_SCOPE' | 'REVIEW' | 'URGENT') => void;
  reload: () => Promise<void>;
}

const defaultFilters: OpportunityFilterParams = {
  uf: 'CE',
  status: 'OPEN',
  minValue: 900000.0,
  maxValue: undefined,
  classification: 'IN_SCOPE_AND_REVIEW',
  search: '',
  municipality: '',
  page: 1,
  pageSize: 25,
};

const RadarContext = createContext<RadarContextType | undefined>(undefined);

export const RadarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [opportunities, setOpportunities] = useState<LicitacaoOportunidade[]>([]);
  const [stats, setStats] = useState<StatsOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedInitially, setHasLoadedInitially] = useState<boolean>(false);

  // View state & Drawer
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedOpp, setSelectedOpp] = useState<LicitacaoOportunidade | null>(null);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Filter state
  const [filters, setFilters] = useState<OpportunityFilterParams>(defaultFilters);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('UNKNOWN');

  // Load Data with caching (only set full loading spinner if no items are currently cached)
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
      // If we don't have any cached items, ensure empty array
      setOpportunities((prev) => (prev.length > 0 ? prev : []));
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

  // Initial load once when provider mounts
  useEffect(() => {
    if (!hasLoadedInitially) {
      setHasLoadedInitially(true);
      loadData(filters);
      loadStats();
    }
  }, [hasLoadedInitially, loadData, loadStats, filters]);

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

  const handleFilterChange = (updated: Partial<OpportunityFilterParams>) => {
    const nextFilters = { ...filters, ...updated };
    setFilters(nextFilters);
    loadData(nextFilters);
  };

  const handleResetFilters = () => {
    const reset = { ...defaultFilters };
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
      handleFilterChange({
        classification: cat === 'ALL' ? 'ALL' : cat,
        deadlinePreset: undefined,
        page: 1,
      });
    }
  };

  const reload = async () => {
    await Promise.all([loadData(filters), loadStats()]);
  };

  return (
    <RadarContext.Provider
      value={{
        opportunities,
        stats,
        loading,
        statsLoading,
        error,
        viewMode,
        selectedOpp,
        page,
        pageSize,
        totalPages,
        totalRecords,
        filters,
        isSyncing,
        syncFeedback,
        lastSuccessfulSyncAt,
        syncStatus,
        setViewMode,
        setSelectedOpp,
        setSyncFeedback,
        handleFilterChange,
        handleResetFilters,
        handlePageChange,
        handleTriggerSync,
        handleSelectCategory,
        reload,
      }}
    >
      {children}
    </RadarContext.Provider>
  );
};

export const useRadar = (): RadarContextType => {
  const context = useContext(RadarContext);
  if (!context) {
    throw new Error('useRadar must be used within a RadarProvider');
  }
  return context;
};
