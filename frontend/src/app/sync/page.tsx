'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
        alignItems: 'center',
        gap: '7px',
        fontSize: '12px',
        fontWeight: 700,
        color,
        padding: '6px 12px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: bg,
        border: `1px solid ${border}`,
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
        <p style={{ fontSize: '11.5px', color: '#FF81B2', margin: 0 }}>{run.errorMessage}</p>
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
                      <div style={{ fontSize: '11px', color: '#FF81B2', marginTop: '4px', maxWidth: '300px' }}>
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
  const pncpBusy = isSyncing || latestPncp?.status === 'RUNNING';
  const tceBusy = isSyncingTce || latestTce?.status === 'RUNNING';

  const triggerPncp = async () => {
    try {
      await handleTriggerSync();
    } finally {
      loadHistory(true);
    }
  };

  const triggerTce = async () => {
    try {
      await handleTriggerTceSync();
    } finally {
      loadHistory(true);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header isSyncing={isSyncing} onTriggerSync={handleTriggerSync} />

      <main className="container" style={{ flex: 1, paddingTop: '36px', paddingBottom: '80px', maxWidth: '1400px' }}>
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
            <span>Pipeline Operacional & Telemetria</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px' }}>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '34px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.15,
                  margin: 0,
                }}
              >
                Histórico de Sincronizações{' '}
                <span style={{ fontStyle: 'italic', fontWeight: 600, color: 'var(--brand-primary)' }}>
                  Ceará
                </span>
              </h1>
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '8px' }}>
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div className="wishlabs-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  PNCP Ceará
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Portal Nacional de Contratações Públicas
                </p>
              </div>
              <HealthPill label="PNCP" health={pncpHealth} errored={pncpHealthError} />
            </div>
            <LastRunSummary run={latestPncp} />
            <button onClick={triggerPncp} disabled={pncpBusy} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
              <RefreshCw size={13} className={pncpBusy ? 'animate-spin' : ''} />
              <span>{pncpBusy ? 'Varrendo PNCP...' : 'Sincronizar PNCP'}</span>
            </button>
          </div>

          <div className="wishlabs-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  TCE-CE (Municípios do Ceará)
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Portal de licitações municipais do TCE-CE
                </p>
              </div>
              <HealthPill label="TCE-CE" health={tceHealth} errored={tceHealthError} />
            </div>
            <LastRunSummary run={latestTce} />
            <button onClick={triggerTce} disabled={tceBusy} className="btn-secondary" style={{ alignSelf: 'flex-start' }}>
              <RefreshCw size={13} className={tceBusy ? 'animate-spin' : ''} />
              <span>{tceBusy ? 'Varrendo TCE-CE...' : 'Sincronizar TCE-CE'}</span>
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
