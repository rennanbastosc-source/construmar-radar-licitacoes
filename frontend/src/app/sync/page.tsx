'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { fetchSyncHistory, fetchPncpHealth, fetchTceHealth } from '@/lib/api';
import { LicitacaoSyncRun, OpportunitySource, PncpHealth, resolveOpportunitySource } from '@/lib/types';
import { formatDateTime } from '@/lib/formatters';
import { useRadar } from '@/context/RadarContext';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { ErrorState } from '@/components/ErrorState';
import { SourceBadge } from '@/components/SourceBadge';

type HealthTone = 'up' | 'down' | 'amber' | 'loading';
type SyncSource = 'PNCP' | 'TCE-CE';

function pickLatest(runs: LicitacaoSyncRun[], source: OpportunitySource): LicitacaoSyncRun | undefined {
  return runs
    .filter((run) => resolveOpportunitySource(run.source) === source)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
}

function healthTone(health: PncpHealth | null, errored: boolean): HealthTone {
  if (errored) return 'amber';
  if (!health) return 'loading';
  return health.status === 'UP' ? 'up' : 'down';
}

function HealthPill({
  label,
  health,
  errored,
}: {
  label: string;
  health: PncpHealth | null;
  errored: boolean;
}) {
  const tone = healthTone(health, errored);
  const color =
    tone === 'up' ? 'var(--brand-primary)' : tone === 'down' ? '#FF81B2' : '#F59E0B';
  const bg =
    tone === 'up'
      ? 'var(--brand-primary-bg)'
      : tone === 'down'
      ? 'rgba(255, 129, 178, 0.12)'
      : 'rgba(245, 158, 11, 0.12)';
  const border =
    tone === 'up'
      ? 'var(--brand-primary-border)'
      : tone === 'down'
      ? 'rgba(255, 129, 178, 0.3)'
      : 'rgba(245, 158, 11, 0.3)';
  const text =
    tone === 'up'
      ? `${label} ao vivo`
      : tone === 'down'
      ? `${label} instável`
      : tone === 'amber'
      ? `${label} offline`
      : 'Verificando...';

  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '7px',
        fontSize: '12px',
        fontWeight: 700,
        color,
        padding: '6px 12px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        maxWidth: '100%',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: tone === 'up' ? `0 0 10px ${color}` : 'none',
        }}
        className={tone === 'up' ? 'live-pulse' : ''}
      />
      <span>{text}</span>
      {health && tone === 'up' && (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, opacity: 0.85 }}>
          {health.latencyMs}ms
        </span>
      )}
    </div>
  );
}

function LastRunSummary({ run }: { run?: LicitacaoSyncRun }) {
  if (!run) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
        Nenhuma varredura registrada nesta fonte.
      </p>
    );
  }

  const isSuccess = run.status === 'SUCCESS';
  const isPartial = run.status === 'PARTIAL';
  const isRunning = run.status === 'RUNNING';
  const statusColor = isSuccess
    ? 'var(--brand-primary)'
    : isPartial
    ? 'var(--status-review)'
    : isRunning
    ? '#38BDF8'
    : '#FF81B2';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: statusColor }}>{run.status}</span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {formatDateTime(run.finishedAt || run.startedAt)}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
        }}
      >
        <span style={{ color: '#FFFFFF' }}>{run.totalReceived} recebidos</span>
        <span style={{ color: 'var(--brand-primary)' }}>{run.totalIncluded} em escopo</span>
        <span style={{ color: 'var(--status-review)' }}>{run.totalReviewed} revisão</span>
        <span style={{ color: run.totalFailed > 0 ? '#FF81B2' : 'var(--text-secondary)' }}>
          {run.totalFailed} falhas
        </span>
      </div>
      {run.errorMessage && (
        <p style={{ fontSize: '11.5px', color: '#FF81B2', margin: 0, overflowWrap: 'anywhere' }}>{run.errorMessage}</p>
      )}
    </div>
  );
}

function HistoryTable({ runs }: { runs: LicitacaoSyncRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="wishlabs-card" style={{ padding: '36px 24px', textAlign: 'center' }}>
        <Activity size={28} color="var(--text-secondary)" style={{ margin: '0 auto 10px' }} />
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Nenhuma sincronização registrada
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Use o botão desta fonte para iniciar a primeira coleta.
        </p>
      </div>
    );
  }

  return (
    <div className="wishlabs-card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              <th style={{ padding: '16px 24px' }}>Status / Fonte</th>
              <th style={{ padding: '16px 20px' }}>Início / Conclusão</th>
              <th style={{ padding: '16px 20px' }}>Recebidos</th>
              <th style={{ padding: '16px 20px' }}>Em Escopo</th>
              <th style={{ padding: '16px 20px' }}>Revisão</th>
              <th style={{ padding: '16px 20px' }}>Descartados</th>
              <th style={{ padding: '16px 20px' }}>Atualizados</th>
              <th style={{ padding: '16px 24px', textAlign: 'right' }}>Falhas</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const isSuccess = run.status === 'SUCCESS';
              const isPartial = run.status === 'PARTIAL';
              const isRunning = run.status === 'RUNNING';

              return (
                <tr key={run.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '18px 24px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor: isSuccess
                          ? 'var(--brand-primary-bg)'
                          : isPartial
                          ? 'rgba(245, 158, 11, 0.15)'
                          : isRunning
                          ? 'rgba(56, 189, 248, 0.15)'
                          : 'rgba(255, 129, 178, 0.15)',
                        color: isSuccess
                          ? 'var(--brand-primary)'
                          : isPartial
                          ? 'var(--status-review)'
                          : isRunning
                          ? '#38BDF8'
                          : '#FF81B2',
                        border: `1px solid ${
                          isSuccess
                            ? 'var(--brand-primary-border)'
                            : isPartial
                            ? 'rgba(245, 158, 11, 0.3)'
                            : isRunning
                            ? 'rgba(56, 189, 248, 0.3)'
                            : 'rgba(255, 129, 178, 0.3)'
                        }`,
                      }}
                    >
                      {isSuccess && <CheckCircle2 size={12} />}
                      {isPartial && <AlertTriangle size={12} />}
                      {isRunning && <Clock size={12} className="animate-spin" />}
                      {!isSuccess && !isPartial && !isRunning && <X size={12} />}
                      <span>{run.status}</span>
                    </span>
                    <span style={{ marginLeft: '8px', verticalAlign: 'middle' }}>
                      <SourceBadge source={run.source} />
                    </span>
                    {run.errorMessage && (
                      <div style={{ fontSize: '11px', color: '#FF81B2', marginTop: '4px', maxWidth: '100%', overflowWrap: 'anywhere' }}>
                        {run.errorMessage}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '18px 20px' }}>
                    <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{formatDateTime(run.startedAt)}</div>
                    {run.finishedAt && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Fim: {formatDateTime(run.finishedAt)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '18px 20px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                    {run.totalReceived}
                  </td>
                  <td style={{ padding: '18px 20px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)' }}>
                    {run.totalIncluded}
                  </td>
                  <td style={{ padding: '18px 20px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--status-review)' }}>
                    {run.totalReviewed}
                  </td>
                  <td style={{ padding: '18px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {run.totalExcluded}
                  </td>
                  <td style={{ padding: '18px 20px', fontFamily: 'var(--font-mono)', color: 'var(--brand-cyan)' }}>
                    {run.totalUpdated}
                  </td>
                  <td
                    style={{
                      padding: '18px 24px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      color: run.totalFailed > 0 ? '#FF81B2' : 'var(--text-secondary)',
                    }}
                  >
                    {run.totalFailed}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SyncHistoryPage() {
  const {
    isSyncing,
    isSyncingTce,
    handleTriggerSync,
    handleTriggerTceSync,
    syncFeedback,
    setSyncFeedback,
  } = useRadar();

  const [history, setHistory] = useState<LicitacaoSyncRun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pncpHealth, setPncpHealth] = useState<PncpHealth | null>(null);
  const [tceHealth, setTceHealth] = useState<PncpHealth | null>(null);
  const [pncpHealthError, setPncpHealthError] = useState(false);
  const [tceHealthError, setTceHealthError] = useState(false);
  const [pncpTriggering, setPncpTriggering] = useState(false);
  const [tceTriggering, setTceTriggering] = useState(false);
  const [pncpStartedAt, setPncpStartedAt] = useState<number | null>(null);
  const [tceStartedAt, setTceStartedAt] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState<number | null>(null);
  const [syncActionError, setSyncActionError] = useState<{ source: SyncSource; message: string } | null>(null);
  const lastSyncSourceRef = useRef<SyncSource | null>(null);

  const loadHistory = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchSyncHistory(50);
      setHistory(data || []);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar histórico de sincronizações.';
      if (!silent) {
        setError(message);
        setHistory([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const data = await fetchPncpHealth();
      setPncpHealth(data);
      setPncpHealthError(false);
    } catch {
      setPncpHealth(null);
      setPncpHealthError(true);
    }
    try {
      const data = await fetchTceHealth();
      setTceHealth(data);
      setTceHealthError(false);
    } catch {
      setTceHealth(null);
      setTceHealthError(true);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadHealth();
  }, [loadHistory, loadHealth]);

  useEffect(() => {
    if (!isSyncing && !isSyncingTce) return;
    const id = setInterval(() => {
      loadHistory(true);
    }, 3000);
    return () => clearInterval(id);
  }, [isSyncing, isSyncingTce, loadHistory]);

  const pncpRuns = history
    .filter((run) => resolveOpportunitySource(run.source) === 'PNCP')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const tceRuns = history
    .filter((run) => resolveOpportunitySource(run.source) === 'TCE-CE')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const latestPncp = pickLatest(history, 'PNCP');
  const latestTce = pickLatest(history, 'TCE-CE');
  const pncpBusy = pncpTriggering || isSyncing || latestPncp?.status === 'RUNNING';
  const tceBusy = tceTriggering || isSyncingTce || latestTce?.status === 'RUNNING';

  useEffect(() => {
    if (pncpBusy) {
      setPncpStartedAt((current) => {
        if (current !== null) return current;
        const runStartedAt = latestPncp?.status === 'RUNNING' ? Date.parse(latestPncp.startedAt) : Number.NaN;
        return Number.isFinite(runStartedAt) ? runStartedAt : Date.now();
      });
    } else {
      setPncpStartedAt(null);
    }
  }, [latestPncp?.startedAt, latestPncp?.status, pncpBusy]);

  useEffect(() => {
    if (tceBusy) {
      setTceStartedAt((current) => {
        if (current !== null) return current;
        const runStartedAt = latestTce?.status === 'RUNNING' ? Date.parse(latestTce.startedAt) : Number.NaN;
        return Number.isFinite(runStartedAt) ? runStartedAt : Date.now();
      });
    } else {
      setTceStartedAt(null);
    }
  }, [latestTce?.startedAt, latestTce?.status, tceBusy]);

  useEffect(() => {
    if (!pncpBusy && !tceBusy) {
      setClockNow(null);
      return;
    }

    const updateClock = () => setClockNow(Date.now());
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, [pncpBusy, tceBusy]);

  const triggerPncp = async () => {
    if (pncpBusy) return;
    lastSyncSourceRef.current = 'PNCP';
    setSyncActionError(null);
    setPncpTriggering(true);
    setPncpStartedAt(Date.now());

    try {
      await handleTriggerSync();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao iniciar a sincronização com o PNCP.';
      setSyncActionError({ source: 'PNCP', message });
    } finally {
      setPncpTriggering(false);
      await loadHistory(true);
    }
  };

  const triggerTce = async () => {
    if (tceBusy) return;
    lastSyncSourceRef.current = 'TCE-CE';
    setSyncActionError(null);
    setTceTriggering(true);
    setTceStartedAt(Date.now());

    try {
      await handleTriggerTceSync();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao iniciar a sincronização com o TCE-CE.';
      setSyncActionError({ source: 'TCE-CE', message });
    } finally {
      setTceTriggering(false);
      await loadHistory(true);
    }
  };

  const retryLastSync = () => {
    if (lastSyncSourceRef.current === 'TCE-CE') {
      void triggerTce();
      return;
    }
    void triggerPncp();
  };

  const elapsedSeconds = (startedAt: number | null) =>
    startedAt === null ? 0 : Math.max(0, Math.floor(((clockNow ?? Date.now()) - startedAt) / 1000));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%' }}>
      <Header
        lastSyncAt={latestPncp?.finishedAt || latestPncp?.startedAt}
        syncStatus={latestPncp?.status}
        isSyncing={isSyncing}
        onTriggerSync={triggerPncp}
        syncFeedback={syncFeedback}
      />

      <main className="container" style={{ flex: 1, paddingTop: '36px', paddingBottom: '80px' }}>
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={15} /> Voltar para o Radar de Licitações
          </Link>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <div className="page-eyebrow">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', flexShrink: 0 }} />
            <span>Pipeline Operacional & Telemetria</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px', minWidth: 0 }}>
            <div style={{ minWidth: 0, flex: '1 1 220px' }}>
              <h1 className="page-display-title">
                Histórico de Sincronizações{' '}
                <span style={{ fontStyle: 'italic', fontWeight: 600, color: 'var(--brand-primary)' }}>
                  Ceará
                </span>
              </h1>
              <p className="page-display-lead">
                Varreduras no PNCP e no portal TCE-CE dos municípios do Ceará.
              </p>
            </div>

            <button onClick={() => { loadHistory(); loadHealth(); }} className="btn-secondary">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Atualizar Logs</span>
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div
            role={syncFeedback.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            style={{
              padding: '14px 20px',
              borderRadius: 'var(--radius-full)',
              marginBottom: '24px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              minWidth: 0,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {syncFeedback.type === 'success' && <CheckCircle2 size={16} />}
              {syncFeedback.type === 'error' && <AlertCircle size={16} />}
              {syncFeedback.type === 'info' && <RefreshCw size={16} className="animate-spin" />}
              <span>{syncFeedback.message}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {syncFeedback.type === 'error' && (
                <button
                  onClick={retryLastSync}
                  disabled={pncpBusy || tceBusy}
                  className="btn-secondary"
                  title="Repetir a última sincronização"
                >
                  <RefreshCw size={13} />
                  <span>Tentar novamente</span>
                </button>
              )}
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
          </div>
        )}

        {syncActionError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '14px 20px',
              borderRadius: 'var(--radius-full)',
              minWidth: 0,
              marginBottom: '24px',
              backgroundColor: 'rgba(255, 129, 178, 0.15)',
              border: '1px solid rgba(255, 129, 178, 0.3)',
              color: '#FF81B2',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            <span>{syncActionError.message}</span>
            <button onClick={retryLastSync} disabled={pncpBusy || tceBusy} className="btn-secondary">
              <RefreshCw size={13} />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        <div className="sync-source-grid">
          <div className="wishlabs-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0, overflowWrap: 'break-word' }}>
                  PNCP Ceará
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Portal Nacional de Contratações Públicas
                </p>
              </div>
              <HealthPill label="PNCP" health={pncpHealth} errored={pncpHealthError} />
            </div>
            <LastRunSummary run={latestPncp} />
            {pncpBusy && (
              <div
                role="status"
                aria-live="polite"
                aria-busy={pncpBusy}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38BDF8', fontSize: '12px' }}
              >
                <RefreshCw size={14} className="animate-spin" />
                <span>Sincronizando…</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{elapsedSeconds(pncpStartedAt)}s</span>
              </div>
            )}
            <button
              onClick={triggerPncp}
              disabled={pncpBusy}
              aria-busy={pncpBusy}
              title={pncpBusy ? 'Sincronização do PNCP em andamento' : 'Iniciar sincronização com o PNCP'}
              className="btn-primary"
              style={{ alignSelf: 'flex-start' }}
            >
              <RefreshCw size={13} className={pncpBusy ? 'animate-spin' : ''} />
              <span>{pncpBusy ? 'Sincronizando…' : 'Sincronizar PNCP'}</span>
            </button>
          </div>

          <div className="wishlabs-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0, overflowWrap: 'break-word' }}>
                  TCE-CE (Municípios do Ceará)
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Portal de licitações municipais do TCE-CE
                </p>
              </div>
              <HealthPill label="TCE-CE" health={tceHealth} errored={tceHealthError} />
            </div>
            <LastRunSummary run={latestTce} />
            {tceBusy && (
              <div
                role="status"
                aria-live="polite"
                aria-busy={tceBusy}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38BDF8', fontSize: '12px' }}
              >
                <RefreshCw size={14} className="animate-spin" />
                <span>Sincronizando…</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{elapsedSeconds(tceStartedAt)}s</span>
              </div>
            )}
            <button
              onClick={triggerTce}
              disabled={tceBusy}
              aria-busy={tceBusy}
              title={tceBusy ? 'Sincronização do TCE-CE em andamento' : 'Iniciar sincronização com o TCE-CE'}
              className="btn-secondary"
              style={{ alignSelf: 'flex-start' }}
            >
              <RefreshCw size={13} className={tceBusy ? 'animate-spin' : ''} />
              <span>{tceBusy ? 'Sincronizando…' : 'Sincronizar TCE-CE'}</span>
            </button>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => loadHistory()} />
        ) : loading && history.length === 0 ? (
          <div className="wishlabs-card" style={{ padding: '48px', textAlign: 'center' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid var(--border-subtle)',
                borderTopColor: 'var(--brand-primary)',
                borderRadius: '50%',
                margin: '0 auto 16px',
              }}
              className="animate-spin"
            />
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>Carregando histórico operacional...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <section>
              <h3
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  margin: '0 0 12px',
                }}
              >
                Histórico PNCP
              </h3>
              <HistoryTable runs={pncpRuns} />
            </section>
            <section>
              <h3
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  margin: '0 0 12px',
                }}
              >
                Histórico TCE-CE
              </h3>
              <HistoryTable runs={tceRuns} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
