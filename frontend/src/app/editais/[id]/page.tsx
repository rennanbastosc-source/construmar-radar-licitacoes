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
  FileText,
  Scale,
  CheckSquare,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  Printer,
  Share2,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import {
  fetchEditalAnalysisDetail,
  toggleEditalChecklist,
} from '@/lib/api';
import { EditalAnalysis, SeveridadeRiscoType } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';

export default function EditalDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [analysis, setAnalysis] = useState<EditalAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pegadinhas' | 'qualificacao' | 'habilitacao' | 'checklist' | 'indices'>('pegadinhas');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchEditalAnalysisDetail(id);
        setAnalysis(data);
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao carregar auditoria do edital.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const handleToggleCheck = async (itemId: string, currentStatus: boolean) => {
    if (!analysis) return;
    const nextStatus = !currentStatus;

    // Optimistic UI update
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
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171',
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
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#FBBF24',
              fontWeight: 700,
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
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34D399',
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            NORMAL
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
        <Header />
        <main className="container" style={{ flex: 1, padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: 'var(--brand-cyan)',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem auto',
            }}
          />
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', margin: 0 }}>Carregando Parecer Técnico do Edital...</h2>
        </main>
      </div>
    );
  }

  if (errorMessage || !analysis) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
        <Header />
        <main className="container" style={{ flex: 1, padding: '4rem 1.5rem', textAlign: 'center' }}>
          <AlertCircle size={48} color="#F87171" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Análise de Edital Não Encontrada</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{errorMessage || 'O identificador solicitado não existe no banco de dados.'}</p>
          <Link href="/editais" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Voltar ao Hub de Editais
          </Link>
        </main>
      </div>
    );
  }

  const criticalPegadinhas = analysis.pegadinhas?.filter((p) => p.severidade === 'CRITICA') || [];
  const checklistCheckedCount = analysis.checklistDocumentos?.filter((c) => c.marcado).length || 0;
  const checklistTotalCount = analysis.checklistDocumentos?.length || 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
      <Header />

      <main className="container" style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: '1350px' }}>
        {/* Navigation Breadcrumb & Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
          <Link
            href="/editais"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Voltar para Hub de Editais
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => window.print()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Printer size={15} /> Imprimir Parecer
            </button>
          </div>
        </div>

        {/* Executive Summary Hero Card */}
        <div
          className="saas-card"
          style={{
            padding: '2rem',
            marginBottom: '2rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ flex: '1 1 500px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(14, 165, 233, 0.15)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    color: 'var(--brand-cyan)',
                    fontWeight: 800,
                    fontSize: '12px',
                  }}
                >
                  {analysis.numeroEdital || 'Edital'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {analysis.orgao} • {analysis.localidade}
                </span>
              </div>

              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: '0 0 10px 0',
                  lineHeight: 1.3,
                }}
              >
                {analysis.titulo || analysis.objetoCompleto}
              </h1>

              <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                {analysis.resumoExecutivo}
              </p>

              {/* Technical Opinion Pill */}
              {analysis.parecerTecnico && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#34D399', display: 'block', marginBottom: '2px' }}>Parecer do Especialista CONSTRUMAR:</strong>
                    <span>{analysis.parecerTecnico}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Metrics Column */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))',
                gap: '12px',
                minWidth: '320px',
              }}
            >
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Valor Estimado</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, color: '#10B981' }}>
                  {analysis.valorEstimado > 0 ? formatCurrency(analysis.valorEstimado) : 'Sigiloso'}
                </span>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Aderência ao Escopo</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-cyan)' }}>
                  {analysis.scoreAderencia.toFixed(1)} / 10.0
                </span>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>BDI Máximo</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {analysis.bdiMaximoPermitido ? `${analysis.bdiMaximoPermitido.toFixed(2)}%` : 'Livre'}
                </span>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Prazo de Execução</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {analysis.prazoExecucao || 'Conforme Edital'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '12px',
          }}
        >
          <button
            onClick={() => setActiveTab('pegadinhas')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: activeTab === 'pegadinhas' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              border: `1px solid ${activeTab === 'pegadinhas' ? 'rgba(239, 68, 68, 0.4)' : 'transparent'}`,
              color: activeTab === 'pegadinhas' ? '#F87171' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <ShieldAlert size={16} /> Radar de Pegadinhas ({analysis.pegadinhas?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('qualificacao')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: activeTab === 'qualificacao' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
              border: `1px solid ${activeTab === 'qualificacao' ? 'rgba(14, 165, 233, 0.4)' : 'transparent'}`,
              color: activeTab === 'qualificacao' ? 'var(--brand-cyan)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <Scale size={16} /> Qualificação Técnica & Atestados ({analysis.qualificacoesTecnicas?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('habilitacao')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: activeTab === 'habilitacao' ? 'rgba(242, 100, 25, 0.15)' : 'transparent',
              border: `1px solid ${activeTab === 'habilitacao' ? 'rgba(242, 100, 25, 0.4)' : 'transparent'}`,
              color: activeTab === 'habilitacao' ? 'var(--brand-orange)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <Building2 size={16} /> Habilitação Geral ({analysis.requisitosHabilitacao?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: activeTab === 'checklist' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              border: `1px solid ${activeTab === 'checklist' ? 'rgba(16, 185, 129, 0.4)' : 'transparent'}`,
              color: activeTab === 'checklist' ? '#34D399' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <CheckSquare size={16} /> Checklist de Envio ({checklistCheckedCount}/{checklistTotalCount})
          </button>

          <button
            onClick={() => setActiveTab('indices')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: activeTab === 'indices' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              border: `1px solid ${activeTab === 'indices' ? 'rgba(255, 255, 255, 0.25)' : 'transparent'}`,
              color: activeTab === 'indices' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <TrendingUp size={16} /> Índices Contábeis ({analysis.indicesFinanceiros?.length || 0})
          </button>
        </div>

        {/* Tab Content 1: Pegadinhas */}
        {activeTab === 'pegadinhas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {(!analysis.pegadinhas || analysis.pegadinhas.length === 0) ? (
              <div className="saas-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhuma pegadinha ou risco crítico detectado no edital.
              </div>
            ) : (
              analysis.pegadinhas.map((item) => (
                <div
                  key={item.id}
                  className="saas-card"
                  style={{
                    padding: '1.5rem',
                    borderLeft: `4px solid ${item.severidade === 'CRITICA' ? '#EF4444' : item.severidade === 'ATENCAO' ? '#F59E0B' : '#10B981'}`,
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {getSeverityBadge(item.severidade)}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {item.clausula}
                      </span>
                    </div>
                  </div>

                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.titulo}
                  </h3>

                  <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.55 }}>
                    {item.descricao}
                  </p>

                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.86rem',
                    }}
                  >
                    <strong style={{ color: 'var(--brand-cyan)' }}>Recomendação Tática: </strong>
                    <span style={{ color: 'var(--text-primary)' }}>{item.recomendacao}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Content 2: Qualificação Técnica */}
        {activeTab === 'qualificacao' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {(!analysis.qualificacoesTecnicas || analysis.qualificacoesTecnicas.length === 0) ? (
              <div className="saas-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhuma exigência técnica de parcela mínima declarada explicitamente.
              </div>
            ) : (
              analysis.qualificacoesTecnicas.map((item) => (
                <div key={item.id} className="saas-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-cyan)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Item de Maior Relevância Técnica
                      </span>
                      <h3 style={{ margin: '4px 0 0 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.itemServico}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {item.exigeVisitaTecnica && (
                        <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', fontSize: '11px', fontWeight: 700 }}>
                          Vistoria Obrigatória
                        </span>
                      )}
                      {item.aceitaDeclaracao && (
                        <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34D399', fontSize: '11px', fontWeight: 600 }}>
                          Aceita Declaração
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '12px' }}>
                    <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Quantidade Total do Edital</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {item.quantidadeExigida > 0 ? `${item.quantidadeExigida.toLocaleString('pt-BR')} ${item.unidade}` : 'Conforme Planilha'}
                      </span>
                    </div>

                    <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--brand-cyan)', display: 'block' }}>Parcela Mínima Exigida no Atestado</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.parcelaMinima || 'Mínimo de 50%'}
                      </span>
                    </div>
                  </div>

                  {item.observacao && (
                    <p style={{ margin: '12px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                      <strong>Observações do Atestado:</strong> {item.observacao}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Content 3: Habilitação */}
        {activeTab === 'habilitacao' && (
          <div className="saas-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {analysis.requisitosHabilitacao?.map((req) => (
                <div
                  key={req.id}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {req.categoria}
                    </span>
                    {req.obrigatorio && (
                      <span style={{ fontSize: '11px', color: '#F87171', fontWeight: 700 }}>Obrigatório</span>
                    )}
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{req.documento}</h4>
                  {req.detalhes && (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{req.detalhes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content 4: Checklist Interativo */}
        {activeTab === 'checklist' && (
          <div className="saas-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  Checklist de Documentos da Proposta
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Marque cada documento conforme preparado para garantir que nenhuma certidão falte no envio.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#10B981' }}>
                  {checklistCheckedCount} / {checklistTotalCount}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>concluídos</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {analysis.checklistDocumentos?.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleCheck(item.id, item.marcado)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: item.marcado ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0, 0, 0, 0.25)',
                    border: `1px solid ${item.marcado ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: `2px solid ${item.marcado ? '#10B981' : 'rgba(255, 255, 255, 0.3)'}`,
                        backgroundColor: item.marcado ? '#10B981' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#060B13',
                        flexShrink: 0,
                      }}
                    >
                      {item.marcado && <Check size={14} strokeWidth={3} />}
                    </div>

                    <span
                      style={{
                        fontSize: '0.92rem',
                        color: item.marcado ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: item.marcado ? 'line-through' : 'none',
                        fontWeight: item.marcado ? 400 : 500,
                      }}
                    >
                      {item.numero}. {item.descricao}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {item.fase}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content 5: Índices Contábeis */}
        {activeTab === 'indices' && (
          <div className="saas-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {analysis.indicesFinanceiros?.map((ind) => (
                <div
                  key={ind.id}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: 'var(--brand-cyan)',
                      }}
                    >
                      {ind.sigla}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#10B981',
                      }}
                    >
                      {ind.valorMinimo}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{ind.nome}</h4>
                  {ind.formula && (
                    <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Fórmula: {ind.formula}
                    </span>
                  )}
                  {ind.observacao && (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{ind.observacao}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
