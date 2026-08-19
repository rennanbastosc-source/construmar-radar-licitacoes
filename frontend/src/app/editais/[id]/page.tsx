'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import {
  ArrowLeft,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Scale,
  CheckSquare,
  Building2,
  Printer,
  Sparkles,
  TrendingUp,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  fetchEditalAnalysisDetail,
  toggleEditalChecklist,
} from '@/lib/api';
import { EditalAnalysis, SeveridadeRiscoType } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { ErrorState } from '@/components/ErrorState';

export default function EditalDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [analysis, setAnalysis] = useState<EditalAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pegadinhas' | 'qualificacao' | 'habilitacao' | 'checklist' | 'indices'>('pegadinhas');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDetail = async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchEditalAnalysisDetail(id);
      if (data) {
        setAnalysis(data);
      } else {
        setErrorMessage('Auditoria de edital não encontrada.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar auditoria do edital.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const handleToggleCheck = async (itemId: string, currentStatus: boolean) => {
    if (!analysis) return;
    const nextStatus = !currentStatus;

    setAnalysis({
      ...analysis,
      checklistDocumentos: analysis.checklistDocumentos?.map((c) =>
        c.id === itemId ? { ...c, marcado: nextStatus } : c
      ),
    });

    try {
      await toggleEditalChecklist(itemId, nextStatus);
    } catch (err) {
      console.error('Falha ao alternar checklist:', err);
    }
  };

  const getSeverityBadge = (severidade: SeveridadeRiscoType) => {
    switch (severidade) {
      case 'CRITICA':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 129, 178, 0.15)',
              border: '1px solid rgba(255, 129, 178, 0.3)',
              color: '#FF81B2',
              fontWeight: 800,
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldAlert size={12} /> CRÍTICA (RISCO DE DESCLASSIFICAÇÃO)
          </span>
        );
      case 'ATENCAO':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#FBBF24',
              fontWeight: 800,
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertTriangle size={12} /> ATENÇÃO REQUERIDA
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--brand-primary-bg)',
              border: '1px solid var(--brand-primary-border)',
              color: 'var(--brand-primary)',
              fontWeight: 700,
              fontSize: '11px',
            }}
          >
            NORMAL
          </span>
        );
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main className="container" style={{ flex: 1, paddingTop: '32px', paddingBottom: '80px', maxWidth: '1400px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/editais"
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
            <ArrowLeft size={16} /> Voltar para o Hub de Editais
          </Link>
        </div>

        {errorMessage ? (
          <ErrorState message={errorMessage} onRetry={loadDetail} />
        ) : isLoading ? (
          <div className="wishlabs-card" style={{ padding: '64px 24px', textAlign: 'center' }}>
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>Carregando parecer do edital...</p>
          </div>
        ) : !analysis ? (
          <ErrorState message="Auditoria não encontrada." onRetry={loadDetail} />
        ) : (
          <>
            {/* Top Hero Card */}
            <div
              className="wishlabs-card"
              style={{
                padding: '32px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: '#FFFFFF',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {analysis.numeroEdital} • {analysis.modalidade}
                  </span>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--brand-primary-bg)',
                      color: 'var(--brand-primary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      border: '1px solid var(--brand-primary-border)',
                    }}
                  >
                    SCORE ADERÊNCIA: {analysis.scoreAderencia}/10
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => window.print()}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    <Printer size={14} /> Imprimir Parecer
                  </button>
                  <Link href="/orcamentos" className="btn-primary">
                    <Sparkles size={14} /> Orçar no SEOBRA
                  </Link>
                </div>
              </div>

              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '26px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  lineHeight: 1.3,
                  margin: '0 0 12px',
                  letterSpacing: '-0.03em',
                }}
              >
                {analysis.titulo}
              </h1>

              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                <Building2 size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {analysis.orgao} • {analysis.localidade || 'Ceará / CE'}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  paddingTop: '20px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Valor Estimado
                  </span>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(analysis.valorEstimado || 0)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Prazo de Execução
                  </span>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
                    {analysis.prazoExecucao || '—'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Regime de Execução
                  </span>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
                    {analysis.regimeExecucao || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Resumo Executivo Bento Box */}
            <div
              className="wishlabs-card"
              style={{
                padding: '24px 32px',
                marginBottom: '24px',
                backgroundColor: '#161618',
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--brand-primary)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Resumo Executivo da Auditoria
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {analysis.resumoExecutivo}
              </p>
            </div>

            {/* Capsule Navigation Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              {[
                { key: 'pegadinhas', label: `Radar de Pegadinhas (${(analysis.pegadinhas || []).length})`, icon: ShieldAlert },
                { key: 'qualificacao', label: `Qualificação Técnica (${(analysis.qualificacoesTecnicas || []).length})`, icon: Scale },
                { key: 'habilitacao', label: `Habilitação Jurídica (${(analysis.requisitosHabilitacao || []).length})`, icon: CheckCircle2 },
                { key: 'checklist', label: `Checklist Obrigatório (${(analysis.checklistDocumentos || []).length})`, icon: CheckSquare },
                { key: 'indices', label: `Índices Financeiros (${(analysis.indicesFinanceiros || []).length})`, icon: TrendingUp },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: 'var(--radius-full)',
                      border: active ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: active ? 'var(--brand-primary-bg)' : '#101012',
                      color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            {activeTab === 'pegadinhas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(analysis.pegadinhas || []).length === 0 ? (
                  <div className="wishlabs-card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhuma pegadinha ou risco identificado no edital.
                  </div>
                ) : (
                  (analysis.pegadinhas || []).map((item) => (
                    <div key={item.id} className="wishlabs-card" style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            {item.clausula}
                          </span>
                          {getSeverityBadge(item.severidade)}
                        </div>
                      </div>

                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px' }}>
                        {item.titulo}
                      </h3>

                      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
                        {item.descricao}
                      </p>

                      <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: '#101012', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--brand-primary)', display: 'block', marginBottom: '4px' }}>
                          RECOMENDAÇÃO TÉCNICA:
                        </span>
                        <p style={{ fontSize: '13px', color: '#FFFFFF', margin: 0 }}>
                          {item.recomendacao}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'qualificacao' && (
              <div className="wishlabs-card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <th style={{ padding: '14px 20px' }}>Item / Serviço Exigido</th>
                        <th style={{ padding: '14px 16px', width: '80px', textAlign: 'center' }}>Und</th>
                        <th style={{ padding: '14px 16px', width: '120px', textAlign: 'right' }}>Qtd. Edital</th>
                        <th style={{ padding: '14px 16px', width: '140px', textAlign: 'right' }}>Parcela Mínima</th>
                        <th style={{ padding: '14px 20px' }}>Observações da IA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analysis.qualificacoesTecnicas || []).map((qt) => (
                        <tr key={qt.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '16px 20px', fontWeight: 700, color: '#FFFFFF' }}>
                            {qt.itemServico}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {qt.unidade}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFFFFF' }}>
                            {qt.quantidadeExigida.toLocaleString('pt-BR')}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--brand-primary)' }}>
                            {qt.parcelaMinima}
                          </td>
                          <td style={{ padding: '16px 20px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            {qt.observacao || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'habilitacao' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                {(analysis.requisitosHabilitacao || []).map((item) => (
                  <div key={item.id} className="wishlabs-card" style={{ padding: '20px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                      {item.categoria}
                    </span>
                    <h4 style={{ fontSize: '14.5px', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.4 }}>
                      {item.documento}
                    </h4>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="wishlabs-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(analysis.checklistDocumentos || []).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleCheck(item.id, item.marcado)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '14px 18px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#101012',
                        border: `1px solid ${item.marcado ? 'var(--brand-primary-border)' : 'var(--border-subtle)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          border: `2px solid ${item.marcado ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                          backgroundColor: item.marcado ? 'var(--brand-primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#0E0E10',
                        }}
                      >
                        {item.marcado && <Check size={14} strokeWidth={3} />}
                      </div>

                      <span
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: item.marcado ? '#FFFFFF' : 'var(--text-secondary)',
                          textDecoration: item.marcado ? 'none' : 'none',
                        }}
                      >
                        {item.numero}. {item.descricao}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'indices' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {(analysis.indicesFinanceiros || []).map((item) => (
                  <div key={item.id} className="wishlabs-card" style={{ padding: '24px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-cyan)', textTransform: 'uppercase' }}>
                      {item.sigla}
                    </span>
                    <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: '4px 0 12px' }}>
                      {item.nome}
                    </h4>
                    <div style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', marginBottom: '8px' }}>
                      {item.valorMinimo}
                    </div>
                    {item.formula && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', backgroundColor: '#101012', padding: '6px 10px', borderRadius: '4px' }}>
                        {item.formula}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
