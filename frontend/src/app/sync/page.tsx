'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { fetchSyncHistory, triggerSync } from '@/lib/api';
import { LicitacaoSyncRun } from '@/lib/types';
import { formatDateTime } from '@/lib/formatters';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, X, Clock, Activity } from 'lucide-react';
import { ErrorState } from '@/components/ErrorState';

export default function SyncHistoryPage() {
  const [history, setHistory] = useState<LicitacaoSyncRun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSyncHistory(50);
      setHistory(data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar histórico operacional do PNCP.');
      setHistory([]);
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
      }, 3000);
    } catch (err: any) {
      setIsSyncing(false);
      setError(err.message || 'Falha ao disparar sincronização manual com o PNCP.');
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

        {/* Header Title */}
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
                  PNCP Ceará
                </span>
              </h1>
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Registro cronológico de varreduras automáticas e manuais de licitações públicas no Estado do Ceará.
              </p>
            </div>

            <button onClick={loadHistory} className="btn-secondary">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Atualizar Logs</span>
            </button>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={loadHistory} />
        ) : loading ? (
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
        ) : history.length === 0 ? (
          <div className="wishlabs-card" style={{ padding: '48px', textAlign: 'center' }}>
            <Activity size={32} color="var(--text-secondary)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
              Nenhuma sincronização registrada
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Clique em &quot;Sincronizar PNCP&quot; para iniciar a primeira coleta de dados.
            </p>
          </div>
        ) : (
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
                  {history.map((run) => {
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
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                            ({run.source})
                          </span>
                          {run.errorMessage && (
                            <div style={{ fontSize: '11px', color: '#FF81B2', marginTop: '4px', maxWidth: '300px' }}>
                              {run.errorMessage}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '18px 20px' }}>
                          <div style={{ fontWeight: 700, color: '#FFFFFF' }}>
                            {formatDateTime(run.startedAt)}
                          </div>
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
                        <td style={{ padding: '18px 24px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: run.totalFailed > 0 ? '#FF81B2' : 'var(--text-secondary)' }}>
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
      </main>
    </div>
  );
}
