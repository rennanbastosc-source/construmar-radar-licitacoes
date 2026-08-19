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
} from 'lucide-react';
import {
  fetchEditalAnalysisDetail,
  toggleEditalChecklist,
} from '@/lib/api';
import { EditalAnalysis, SeveridadeRiscoType } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

const FALLBACK_ANALYSIS: EditalAnalysis = {
  id: 'edital-sample-1',
  titulo: 'Concorrência Eletrônica nº 2026/014 - Pavimentação e Drenagem Urbana',
  orgao: 'Secretaria da Infraestrutura do Estado do Ceará - SEINFRA',
  numeroEdital: 'CE-2026/014',
  numeroProcesso: 'PROC-2026-991',
  modalidade: 'Concorrência Eletrônica',
  modoDisputa: 'Aberto',
  objetoCompleto: 'Contratação de empresa de engenharia para pavimentação asfáltica em CBUQ, microdrenagem, sarjetas e sinalização viária no Polo Industrial de Maracanaú.',
  localidade: 'Maracanaú - CE',
  dataAbertura: new Date(Date.now() + 12 * 86400000).toISOString(),
  valorEstimado: 14580000.0,
  prazoExecucao: '12 meses',
  regimeExecucao: 'Empreitada por Preço Unitário',
  status: 'CONCLUIDO',
  originalFileName: 'edital_seinfra_014_2026.pdf',
  fileType: 'pdf',
  totalPaginas: 42,
  resumoExecutivo: 'Edital com boa aderência aos serviços da CONSTRUMAR. Ponto de atenção máxima na exigência de visita técnica em até 3 dias úteis anteriores à sessão e apresentação de atestado de usinagem asfáltica própria.',
  parecerTecnico: 'Aprovado para disputa com ressalvas operacionais e agendamento imediato da vistoria obrigatória.',
  scoreAderencia: 9.2,
  createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  pegadinhas: [
    {
      id: 'p1',
      analysisId: 'edital-sample-1',
      clausula: 'Item 8.4 do Edital',
      titulo: 'Visita Técnica Obrigatória com Agendamento Prévio',
      descricao: 'O edital exige que a vistoria seja realizada até 3 dias úteis antes da abertura das propostas, mediante agendamento com o engenheiro fiscal da SEINFRA.',
      severidade: 'CRITICA',
      recomendacao: 'Protocolar o pedido de vistoria imediatamente para evitar desclassificação sumária da proposta.',
      impacto: 'DESCLASSIFICACAO',
    },
    {
      id: 'p2',
      analysisId: 'edital-sample-1',
      clausula: 'Item 12.1.3',
      titulo: 'Comprovação de Usina de Asfalto (Raio de 50km)',
      descricao: 'Exigência de apresentação de licença de operação de usina de CBUQ localizada em raio máximo de 50km do local da obra.',
      severidade: 'ATENCAO',
      recomendacao: 'Anexar declaração de compromisso de fornecimento com usina parceira licenciada na RMF.',
      impacto: 'OPERACIONAL',
    },
  ],
  qualificacoesTecnicas: [
    {
      id: 'qt1',
      analysisId: 'edital-sample-1',
      itemServico: 'Execução de Pavimentação Asfáltica em CBUQ (espessura 5cm)',
      unidade: 'M2',
      quantidadeExigida: 45000,
      parcelaMinima: '50% (22.500 m²)',
      exigeVisitaTecnica: true,
      aceitaDeclaracao: false,
      observacao: 'Atestado emitido por pessoa jurídica de direito público ou privado acompanhado de CAT/ART.',
    },
    {
      id: 'qt2',
      analysisId: 'edital-sample-1',
      itemServico: 'Assentamento de Tubos de Concreto para Microdrenagem D=600mm',
      unidade: 'M',
      quantidadeExigida: 3200,
      parcelaMinima: '50% (1.600 m)',
      exigeVisitaTecnica: false,
      aceitaDeclaracao: false,
      observacao: 'Atestado de responsabilidade técnica do responsável pelo lote.',
    },
  ],
  requisitosHabilitacao: [
    {
      id: 'rh1',
      analysisId: 'edital-sample-1',
      categoria: 'JURIDICA',
      documento: 'Contrato Social Consolidado e Registro na Junta Comercial (JUCEC)',
      obrigatorio: true,
    },
    {
      id: 'rh2',
      analysisId: 'edital-sample-1',
      categoria: 'TECNICA',
      documento: 'Certidão de Registro e Quitação no CREA-CE da Empresa e Responsável Técnico',
      obrigatorio: true,
    },
    {
      id: 'rh3',
      analysisId: 'edital-sample-1',
      categoria: 'ECONOMICA',
      documento: 'Balanço Patrimonial com Índices de Liquidez Geral (LG) >= 1.0 e Solvência Geral (SG) >= 1.0',
      obrigatorio: true,
    },
  ],
  checklistDocumentos: [
    {
      id: 'chk1',
      analysisId: 'edital-sample-1',
      numero: 1,
      descricao: 'Atestado de Visita Técnica assinado pelo Engenheiro Fiscal da SEINFRA',
      fase: 'HABILITACAO',
      marcado: true,
    },
    {
      id: 'chk2',
      analysisId: 'edital-sample-1',
      numero: 2,
      descricao: 'Planilha Orçamentária Detalhada com composição de BDI preenchida',
      fase: 'PROPOSTA',
      marcado: true,
    },
    {
      id: 'chk3',
      analysisId: 'edital-sample-1',
      numero: 3,
      descricao: 'Certidões Negativas Federal, Estadual (SEFAZ-CE) e Municipal (Fortaleza/Maracanaú)',
      fase: 'HABILITACAO',
      marcado: false,
    },
  ],
  indicesFinanceiros: [
    {
      id: 'if1',
      analysisId: 'edital-sample-1',
      sigla: 'LG',
      nome: 'Liquidez Geral',
      valorMinimo: '>= 1,00',
      formula: '(Ativo Circulante + RLP) / (Passivo Circulante + PNC)',
    },
    {
      id: 'if2',
      analysisId: 'edital-sample-1',
      sigla: 'LC',
      nome: 'Liquidez Corrente',
      valorMinimo: '>= 1,00',
      formula: 'Ativo Circulante / Passivo Circulante',
    },
    {
      id: 'if3',
      analysisId: 'edital-sample-1',
      sigla: 'SG',
      nome: 'Solvência Geral',
      valorMinimo: '>= 1,00',
      formula: 'Ativo Total / (Passivo Circulante + PNC)',
    },
  ],
};

export default function EditalDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [analysis, setAnalysis] = useState<EditalAnalysis | null>(FALLBACK_ANALYSIS);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pegadinhas' | 'qualificacao' | 'habilitacao' | 'checklist' | 'indices'>('pegadinhas');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const data = await fetchEditalAnalysisDetail(id);
        if (data) {
          setAnalysis(data);
        } else {
          setAnalysis(FALLBACK_ANALYSIS);
        }
      } catch {
        setAnalysis(FALLBACK_ANALYSIS);
      }
    };
    load();
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

  if (!analysis) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <div style={{ flex: 1, padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Auditoria de edital não encontrada.{' '}
          <Link href="/editais" style={{ color: 'var(--brand-primary)' }}>
            Voltar para o hub de editais
          </Link>
        </div>
      </div>
    );
  }

  const pegadinhas = analysis.pegadinhas || [];
  const qualificacoes = analysis.qualificacoesTecnicas || [];
  const habilitacao = analysis.requisitosHabilitacao || [];
  const checklist = analysis.checklistDocumentos || [];
  const indices = analysis.indicesFinanceiros || [];

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
            { key: 'pegadinhas', label: `Radar de Pegadinhas (${pegadinhas.length})`, icon: ShieldAlert },
            { key: 'qualificacao', label: `Qualificação Técnica (${qualificacoes.length})`, icon: Scale },
            { key: 'habilitacao', label: `Habilitação Jurídica (${habilitacao.length})`, icon: CheckCircle2 },
            { key: 'checklist', label: `Checklist Obrigatório (${checklist.length})`, icon: CheckSquare },
            { key: 'indices', label: `Índices Financeiros (${indices.length})`, icon: TrendingUp },
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
            {pegadinhas.length === 0 ? (
              <div className="wishlabs-card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Nenhuma pegadinha ou risco identificado no edital.
              </div>
            ) : (
              pegadinhas.map((item) => (
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
                  {qualificacoes.map((qt) => (
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
            {habilitacao.map((item) => (
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
              {checklist.map((item) => (
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
            {indices.map((item) => (
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
      </main>
    </div>
  );
}
