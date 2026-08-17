'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { fetchSyncHistory, triggerSync } from '@/lib/api';
import { LicitacaoSyncRun } from '@/lib/types';
import { formatDateTime } from '@/lib/formatters';
import { ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, Activity } from 'lucide-react';

export default function SyncHistoryPage() {
  const [history, setHistory] = useState<LicitacaoSyncRun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchSyncHistory(30);
      setHistory(data);
    } catch (err) {
      console.error(err);
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
    <div>
      <Header isSyncing={isSyncing} onTriggerSync={handleTriggerSync} />

      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem' }}>
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
            }}
          >
            <ArrowLeft size={16} /> Voltar para o Radar de Licitações
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Histórico de Sincronizações com o PNCP
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Registro operacional das coletas automáticas e manuais de licitações no Ceará.
            </p>
          </div>

          <button
            onClick={loadHistory}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid var(--border-subtle)',
                borderTopColor: 'var(--brand-primary)',
                borderRadius: '50%',
                margin: '0 auto 1rem',
              }}
              className="animate-spin"
            />
            <p style={{ color: 'var(--text-secondary)' }}>Carregando histórico operacional...</p>
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
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
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderBottom: '1px solid var(--border-strong)',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '12px 16px' }}>Status / Fonte</th>
                    <th style={{ padding: '12px 16px' }}>Início / Conclusão</th>
                    <th style={{ padding: '12px 16px' }}>Recebidos</th>
                    <th style={{ padding: '12px 16px' }}>Em Escopo</th>
                    <th style={{ padding: '12px 16px' }}>Revisão</th>
                    <th style={{ padding: '12px 16px' }}>Descartados</th>
                    <th style={{ padding: '12px 16px' }}>Atualizados</th>
                    <th style={{ padding: '12px 16px' }}>Falhas</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((run) => {
                    const isSuccess = run.status === 'SUCCESS';
                    const isPartial = run.status === 'PARTIAL';
                    const isRunning = run.status === 'RUNNING';

                    return (
                      <tr key={run.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: isSuccess
                                ? 'var(--status-inscope-bg)'
                                : isPartial
                                ? 'var(--status-review-bg)'
                                : isRunning
                                ? 'var(--accent-blue-subtle)'
                                : 'rgba(239, 68, 68, 0.15)',
                              color: isSuccess
                                ? 'var(--status-inscope-text)'
                                : isPartial
                                ? 'var(--status-review-text)'
                                : isRunning
                                ? '#93c5fd'
                                : '#f87171',
                              border: `1px solid ${
                                isSuccess
                                  ? 'var(--status-inscope-border)'
                                  : isPartial
                                  ? 'var(--status-review-border)'
                                  : isRunning
                                  ? 'rgba(59, 130, 246, 0.3)'
                                  : 'rgba(239, 68, 68, 0.3)'
                              }`,
                            }}
                          >
                            {isSuccess && <CheckCircle size={12} />}
                            {isPartial && <AlertTriangle size={12} />}
                            {isRunning && <Clock size={12} className="animate-spin" />}
                            {!isSuccess && !isPartial && !isRunning && <XCircle size={12} />}
                            {run.status}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({run.source})
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatDateTime(run.startedAt)}
                          </div>
                          {run.finishedAt && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Fim: {formatDateTime(run.finishedAt)}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {run.totalReceived}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#34d399' }}>
                          {run.totalIncluded}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fbbf24' }}>
                          {run.totalReviewed}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                          {run.totalExcluded}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#60a5fa' }}>
                          {run.totalUpdated}
                        </td>
                        <td style={{ padding: '12px 16px', color: run.totalFailed > 0 ? '#f87171' : 'var(--text-muted)' }}>
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
