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
  triggerTCESync,
  fetchSyncStatus,
  fetchSyncHistory,
} from '@/lib/api';
import {
  LicitacaoOportunidade,
  OpportunityFilterParams,
  StatsOverviewData,
} from '@/lib/types';

const RADAR_CACHE_KEY = 'CONSTRUMAR_RADAR_OPPS_CACHE_V1';
const RADAR_STATS_CACHE_KEY = 'CONSTRUMAR_RADAR_STATS_CACHE_V1';
const RADAR_META_CACHE_KEY = 'CONSTRUMAR_RADAR_META_CACHE_V1';

interface RadarContextType {
  opportunities: LicitacaoOportunidade[];
  stats: StatsOverviewData | null;
  loading: boolean;
  isRefreshing: boolean;
  statsLoading: boolean;
  statsError: string | null;
  error: string | null;
  viewMode: 'table' | 'cards';
  selectedOpp: LicitacaoOportunidade | null;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
  filters: OpportunityFilterParams;
  isSyncing: boolean;
  isSyncingTce: boolean;
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
  handleTriggerTceSync: () => Promise<void>;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedInitially, setHasLoadedInitially] = useState<boolean>(false);
  const opportunitiesRef = React.useRef<LicitacaoOportunidade[]>([]);

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
  const [isSyncingTce, setIsSyncingTce] = useState<boolean>(false);
  const tceSyncStartedAtRef = React.useRef<number>(0);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('UNKNOWN');

  // 1. Instant Cache Hydration on Mount (Stale-While-Revalidate)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedOpps = localStorage.getItem(RADAR_CACHE_KEY);
        if (cachedOpps) {
          const parsedOpps = JSON.parse(cachedOpps);
          if (Array.isArray(parsedOpps) && parsedOpps.length > 0) {
            opportunitiesRef.current = parsedOpps;
            setOpportunities(parsedOpps);
          }
        }

        const cachedStats = localStorage.getItem(RADAR_STATS_CACHE_KEY);
        if (cachedStats) {
          const parsedStats = JSON.parse(cachedStats);
          if (parsedStats && typeof parsedStats === 'object') {
            setStats(parsedStats);
          }
        }

        const cachedMeta = localStorage.getItem(RADAR_META_CACHE_KEY);
        if (cachedMeta) {
          const parsedMeta = JSON.parse(cachedMeta);
          if (parsedMeta?.total) setTotalRecords(parsedMeta.total);
          if (parsedMeta?.totalPages) setTotalPages(parsedMeta.totalPages);
          if (parsedMeta?.lastSuccessfulSyncAt) setLastSuccessfulSyncAt(parsedMeta.lastSuccessfulSyncAt);
          if (parsedMeta?.syncStatus) setSyncStatus(parsedMeta.syncStatus);
        }
      } catch (err) {
        console.warn('[RadarCache] Erro ao carregar cache local:', err);
      }
    }
  }, []);

  // 2. Load Data from Backend with Cache Persistence
  const loadData = useCallback(async (currentFilters: OpportunityFilterParams) => {
    const hasPreviousData = opportunitiesRef.current.length > 0;
    setLoading(!hasPreviousData);
    setIsRefreshing(hasPreviousData);
    setError(null);
    try {
      const resp = await fetchOpportunities(currentFilters);
      const data = resp.data || [];
      opportunitiesRef.current = data;
      setOpportunities(data);
      setTotalPages(resp.meta?.totalPages || 1);
      setTotalRecords(resp.meta?.total || 0);
      setPage(resp.meta?.page || 1);
      if (resp?.meta?.lastSuccessfulSyncAt) {
        setLastSuccessfulSyncAt(resp.meta.lastSuccessfulSyncAt);
      }
      if (resp?.meta?.syncStatus) {
        setSyncStatus(resp.meta.syncStatus);
      }

      // Persist to local cache if default view has items
      if (typeof window !== 'undefined' && data.length > 0 && (!currentFilters.search && currentFilters.page === 1)) {
        try {
          localStorage.setItem(RADAR_CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(RADAR_META_CACHE_KEY, JSON.stringify(resp.meta));
        } catch (e) {
          console.warn('[RadarCache] Não foi possível gravar cache local:', e);
        }
      }
    } catch (err: any) {
      console.warn('[RadarContext] Falha ao carregar oportunidades da API:', err);
      setError(err.message || 'Erro ao carregar oportunidades de licitação do backend.');
      // Keep cached items intact so user never sees an empty screen on transient errors
      setOpportunities((prev) => {
        if (prev.length > 0) return prev;
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem(RADAR_CACHE_KEY);
            if (cached) {
              const cachedOpps = JSON.parse(cached);
              opportunitiesRef.current = cachedOpps;
              return cachedOpps;
            }
          } catch {}
        }
        return [];
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // 3. Load Stats with Cache Persistence
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await fetchStats(filters.uf || 'CE', filters.minValue || 900000.0);
      setStats(data);
      if (data.lastSuccessfulSyncAt) {
        setLastSuccessfulSyncAt(data.lastSuccessfulSyncAt);
      }
      if (data.lastSyncStatus) {
        setSyncStatus(data.lastSyncStatus);
      }
      if (typeof window !== 'undefined' && data) {
        try {
          localStorage.setItem(RADAR_STATS_CACHE_KEY, JSON.stringify(data));
        } catch {}
      }
    } catch (err: any) {
      console.warn('[RadarContext] Erro ao carregar estatísticas do radar:', err);
      setStatsError(err?.message || 'Erro ao carregar os indicadores do radar.');
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

  // ponytail: poll history for TCE-CE — /sync/status.isRunning is PNCP-only
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (!isSyncingTce) {
      return () => {
        if (interval) clearInterval(interval);
      };
    }

    const pollStartedAt = Date.now();
    interval = setInterval(async () => {
      try {
        if (Date.now() - pollStartedAt > 8 * 60 * 1000) {
          setIsSyncingTce(false);
          setSyncFeedback({
            type: 'info',
            message:
              'A sincronização com o TCE-CE segue em segundo plano. Atualize o histórico em instantes.',
          });
          return;
        }

        const history = await fetchSyncHistory(20);
        const latestTce = (history || [])
          .filter((run) => run.source === 'TCE-CE')
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

        if (!latestTce) return;
        const runStarted = new Date(latestTce.startedAt).getTime();
        if (runStarted + 2000 < tceSyncStartedAtRef.current && latestTce.status !== 'RUNNING') {
          return;
        }
        if (latestTce.status === 'RUNNING') return;

        setIsSyncingTce(false);
        if (latestTce.status === 'SUCCESS') {
          setSyncFeedback({
            type: 'success',
            message: `Sincronização TCE-CE concluída com sucesso! (${latestTce.totalReceived} recebidas, ${latestTce.totalIncluded} em escopo).`,
          });
        } else if (latestTce.status === 'PARTIAL') {
          setSyncFeedback({
            type: 'info',
            message: `Sincronização TCE-CE parcial (${latestTce.totalReceived} recebidas, ${latestTce.totalIncluded} em escopo). Aviso: ${latestTce.errorMessage || 'Alguns lotes pendentes'}.`,
          });
        } else if (latestTce.status === 'FAILED') {
          setSyncFeedback({
            type: 'error',
            message: `Falha na sincronização com o TCE-CE: ${latestTce.errorMessage || 'Serviço temporariamente indisponível'}.`,
          });
        } else {
          setSyncFeedback({
            type: 'success',
            message: 'Sincronização TCE-CE finalizada. Dados atualizados.',
          });
        }
        loadData(filters);
        loadStats();
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncingTce, filters, loadData, loadStats]);

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

  const handleTriggerTceSync = async () => {
    try {
      tceSyncStartedAtRef.current = Date.now();
      setIsSyncingTce(true);
      setSyncFeedback({
        type: 'info',
        message: 'Sincronização com o portal TCE-CE iniciada em segundo plano...',
      });
      await triggerTCESync();
    } catch (err: any) {
      setIsSyncingTce(false);
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Falha ao disparar sincronização com o portal TCE-CE.',
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
        isRefreshing,
        statsLoading,
        statsError,
        error,
        viewMode,
        selectedOpp,
        page,
        pageSize,
        totalPages,
        totalRecords,
        filters,
        isSyncing,
        isSyncingTce,
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
        handleTriggerTceSync,
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
