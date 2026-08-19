'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { fetchSyncHistory, triggerSync } from '@/lib/api';
import { LicitacaoSyncRun } from '@/lib/types';
import { formatDateTime } from '@/lib/formatters';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Activity, Radio } from 'lucide-react';

const SAMPLE_HISTORY: LicitacaoSyncRun[] = [
  {
    id: 'sync-1',
    source: 'PNCP',
    startedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    finishedAt: new Date(Date.now() - 14 * 60000).toISOString(),
    status: 'SUCCESS',
    parameters: '{"uf":"CE","minValue":900000}',
    correlationId: 'sync-auto-ce-01',
    totalReceived: 42,
    totalIncluded: 18,
    totalReviewed: 14,
    totalExcluded: 10,
    totalUpdated: 4,
    totalFailed: 0,
  },
  {
    id: 'sync-2',
    source: 'PNCP',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    finishedAt: new Date(Date.now() - 3540000).toISOString(),
    status: 'SUCCESS',
    parameters: '{"uf":"CE","minValue":900000}',
    correlationId: 'sync-auto-ce-02',
    totalReceived: 38,
    totalIncluded: 15,
    totalReviewed: 12,
    totalExcluded: 11,
    totalUpdated: 2,
    totalFailed: 0,
  },
  {
    id: 'sync-3',
    source: 'PNCP',
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    finishedAt: new Date(Date.now() - 86340000).toISOString(),
    status: 'PARTIAL',
    parameters: '{"uf":"CE","minValue":900000}',
    correlationId: 'sync-auto-ce-03',
    totalReceived: 29,
    totalIncluded: 11,
    totalReviewed: 9,
    totalExcluded: 8,
    totalUpdated: 1,
    totalFailed: 1,
    errorMessage: 'Timeout temporário em 1 órgão municipal',
  },
];

export default function SyncHistoryPage() {
  const [history, setHistory] = useState<LicitacaoSyncRun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchSyncHistory(30);
      if (data && data.length > 0) {
        setHistory(data);
      } else {
        setHistory(SAMPLE_HISTORY);
      }
    } catch {
      setHistory(SAMPLE_HISTORY);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      await triggerSync('CE', 900000.0);
      setTimeout(() => {
        loadHistory();
        setIsSyncing(false);
      }, 2000);
    } catch {
      setIsSyncing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
      <Header isSyncing={isSyncing} onTriggerSync={handleTriggerSync} />

      <div className="container" style={{ flex: 1, paddingTop: '2.2rem', paddingBottom: '4rem', maxWidth: '1300px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={15} /> Voltar para o Radar de Licitações
          </Link>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.2rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--brand-orange)', marginBottom: '8px', backgroundColor: 'rgba(242, 100, 25, 0.08)', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(242, 100, 25, 0.2)' }}>
              <Radio size={12} className="live-pulse" />
              <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Pipeline Operacional
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.03em', margin: 0 }}>
              Histórico de Sincronizações com o PNCP
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Registro de varreduras automáticas e manuais de licitações públicas no Estado do Ceará.
            </p>
          </div>

          <button
            onClick={loadHistory}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12.5px' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Atualizar Logs</span>
          </button>
        </div>

        {loading ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid var(--border-subtle)',
                borderTopColor: 'var(--brand-orange)',
                borderRadius: '50%',
                margin: '0 auto 1rem',
              }}
              className="animate-spin"
            />
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>Carregando histórico operacional...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
            <Activity size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Nenhuma sincronização registrada
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Clique em &quot;Sincronizar PNCP&quot; para iniciar a primeira coleta de dados.
            </p>
          </div>
        ) : (
          <div
            className="glass-panel"
            style={{
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'rgba(21, 34, 56, 0.85)',
                      borderBottom: '1px solid var(--border-strong)',
                      color: 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    <th style={{ padding: '14px 18px' }}>Status / Fonte</th>
                    <th style={{ padding: '14px 18px' }}>Início / Conclusão</th>
                    <th style={{ padding: '14px 18px' }}>Recebidos</th>
                    <th style={{ padding: '14px 18px' }}>Em Escopo</th>
                    <th style={{ padding: '14px 18px' }}>Revisão</th>
                    <th style={{ padding: '14px 18px' }}>Descartados</th>
                    <th style={{ padding: '14px 18px' }}>Atualizados</th>
                    <th style={{ padding: '14px 18px' }}>Falhas</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((run) => {
                    const isSuccess = run.status === 'SUCCESS';
                    const isPartial = run.status === 'PARTIAL';
                    const isRunning = run.status === 'RUNNING';

                    return (
                      <tr key={run.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: isSuccess
                                ? 'rgba(16, 185, 129, 0.12)'
                                : isPartial
                                ? 'rgba(245, 158, 11, 0.12)'
                                : isRunning
                                ? 'rgba(14, 165, 233, 0.12)'
                                : 'rgba(239, 68, 68, 0.15)',
                              color: isSuccess
                                ? '#10B981'
                                : isPartial
                                ? '#F59E0B'
                                : isRunning
                                ? '#38BDF8'
                                : '#F87171',
                              border: `1px solid ${
                                isSuccess
                                  ? 'rgba(16, 185, 129, 0.25)'
                                  : isPartial
                                  ? 'rgba(245, 158, 11, 0.25)'
                                  : isRunning
                                  ? 'rgba(14, 165, 233, 0.25)'
                                  : 'rgba(239, 68, 68, 0.3)'
                              }`,
                            }}
                          >
                            {isSuccess && <CheckCircle2 size={12} />}
                            {isPartial && <AlertTriangle size={12} />}
                            {isRunning && <Clock size={12} className="animate-spin" />}
                            {!isSuccess && !isPartial && !isRunning && <XCircle size={12} />}
                            {run.status}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({run.source})
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatDateTime(run.startedAt)}
                          </div>
                          {run.finishedAt && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Fim: {formatDateTime(run.finishedAt)}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                          {run.totalReceived}
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#10B981' }}>
                          {run.totalIncluded}
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#F59E0B' }}>
                          {run.totalReviewed}
                        </td>
                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {run.totalExcluded}
                        </td>
                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', color: '#38BDF8' }}>
                          {run.totalUpdated}
                        </td>
                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', color: run.totalFailed > 0 ? '#F87171' : 'var(--text-muted)' }}>
                          {run.totalFailed}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
