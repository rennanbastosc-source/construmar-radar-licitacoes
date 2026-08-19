'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  Zap,
  Download,
  Lock,
  Check,
  Clock,
} from 'lucide-react';
import {
  fetchOrcamentoDetail,
  updateOrcamentoItens,
  despacharParaSeobra,
  downloadOrcamentoSeobraXlsx,
} from '@/lib/api';
import { Orcamento, OrcamentoItem } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

const SAMPLE_ITEMS: OrcamentoItem[] = [
  {
    id: 'item-1',
    orcamentoId: 'orcamento-sample-1',
    itemNumero: '1.1',
    codigoReferencia: '92775',
    fonte: 'SINAPI',
    categoria: 'SERVICO',
    descricao: 'ARMAÇÃO DE PILAR OU VIGA DE UMA ESTRUTURA CONVENCIONAL DE CONCRETO ARMADO UTILIZANDO AÇO CA-50 DE 10,0 MM',
    unidade: 'KG',
    quantidade: 4850,
    precoUnitario: 14.82,
    precoTotal: 71877.0,
    confianca: 0.96,
    flagRevisao: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item-2',
    orcamentoId: 'orcamento-sample-1',
    itemNumero: '1.2',
    codigoReferencia: '94970',
    fonte: 'SINAPI',
    categoria: 'SERVICO',
    descricao: 'CONCRETO FCK = 30MPA, TRAÇO 1:2:3 (EM MASSA SECA DE CIMENTO/ AREIA MÉDIA/ BRITA 1) - PREPARO MECÂNICO COM BETONEIRA',
    unidade: 'M3',
    quantidade: 320,
    precoUnitario: 485.60,
    precoTotal: 155392.0,
    confianca: 0.94,
    flagRevisao: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item-3',
    orcamentoId: 'orcamento-sample-1',
    itemNumero: '1.3',
    codigoReferencia: 'C3146',
    fonte: 'SEINFRA',
    categoria: 'SERVICO',
    descricao: 'PAVIMENTAÇÃO EM PARALELEPÍPEDO SOBRE COLCHÃO DE AREIA REJUNTADO COM ARGAMASSA DE CIMENTO E AREIA 1:3',
    unidade: 'M2',
    quantidade: 8400,
    precoUnitario: 92.40,
    precoTotal: 776160.0,
    confianca: 0.91,
    flagRevisao: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item-4',
    orcamentoId: 'orcamento-sample-1',
    itemNumero: '1.4',
    codigoReferencia: '88316',
    fonte: 'SINAPI',
    categoria: 'MAO_DE_OBRA',
    descricao: 'SERVENTE COM ENCARGOS COMPLEMENTARES (MÃO DE OBRA DEDICADA)',
    unidade: 'H',
    quantidade: 1200,
    precoUnitario: 24.50,
    precoTotal: 29400.0,
    confianca: 0.98,
    flagRevisao: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const FALLBACK_ORCAMENTO: Orcamento = {
  id: 'orcamento-sample-1',
  titulo: 'Orçamento Executivo - Pavimentação e Drenagem Urbana Polo Industrial',
  orgao: 'Secretaria da Infraestrutura do Estado do Ceará - SEINFRA',
  objeto: 'Execução de obras de urbanização, terraplenagem, drenagem e pavimentação asfáltica.',
  localidade: 'Maracanaú - CE',
  dataPrecoBase: 'SINAPI (01/2026) / SEINFRA 028',
  status: 'CONCLUIDO',
  totalItens: 4,
  valorTotalEstimado: 1032829.0,
  valorTotalComBdi: 1291036.25,
  confiancaMedia: 0.94,
  bdi: 25.0,
  descontoGeral: 0,
  descontoMaoDeObra: 0,
  descontoMaterial: 0,
  seobraBudgetId: 'SEOBRA-2026-9921',
  seobraBudgetUrl: 'https://www.seobra.com.br',
  originalFileName: 'planilha_orcamentaria_seinfra_ce.xlsx',
  fileType: 'xlsx',
  createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  updatedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  itens: SAMPLE_ITEMS,
};

export default function OrcamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [orcamento, setOrcamento] = useState<Orcamento | null>(FALLBACK_ORCAMENTO);
  const [items, setItems] = useState<OrcamentoItem[]>(SAMPLE_ITEMS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(100);
  const [dispatchMessage, setDispatchMessage] = useState('');
  const [filterReviewOnly, setFilterReviewOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'itens' | 'descontos'>('itens');
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadBudget = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchOrcamentoDetail(id);
      if (data) {
        setOrcamento(data);
        if (!silent) {
          setItems(data.itens && data.itens.length > 0 ? data.itens : SAMPLE_ITEMS);
        }
        if (data.progressPercent !== undefined && data.progressPercent > 0) {
          setDispatchProgress(data.progressPercent);
        }
        if (data.progressMessage) {
          setDispatchMessage(data.progressMessage);
        }
        if (data.status === 'CONCLUIDO') {
          setIsDispatching(false);
          setDispatchProgress(100);
        }
      }
    } catch {
      setOrcamento(FALLBACK_ORCAMENTO);
      setItems(SAMPLE_ITEMS);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBudget();
  }, [id]);

  useEffect(() => {
    if (isDispatching || orcamento?.status === 'DESPACHANDO_SEOBRA') {
      pollingRef.current = setInterval(() => {
        loadBudget(true);
      }, 900);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isDispatching, orcamento?.status]);

  const handleItemChange = (idx: number, field: keyof OrcamentoItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;

    if (field === 'quantidade' || field === 'precoUnitario') {
      const qty = parseFloat(updated[idx].quantidade as any) || 0;
      const unit = parseFloat(updated[idx].precoUnitario as any) || 0;
      updated[idx].precoTotal = qty * unit;
    }

    setItems(updated);
  };

  const handleAddItem = () => {
    const newItem: OrcamentoItem = {
      id: `temp-${Date.now()}`,
      orcamentoId: id,
      itemNumero: `${items.length + 1}.0`,
      codigoReferencia: '',
      fonte: 'SINAPI',
      descricao: 'Novo serviço ou composição...',
      unidade: 'UN',
      quantidade: 1,
      precoUnitario: 0,
      precoTotal: 0,
      confianca: 1.0,
      flagRevisao: false,
      categoria: 'SERVICO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (item: OrcamentoItem, fallbackIdx: number) => {
    const realIdx = items.findIndex((i) => i.id === item.id);
    const idx = realIdx >= 0 ? realIdx : fallbackIdx;
    setItems(items.filter((_, i) => i !== idx));
  };

  const descontoGeral = orcamento?.descontoGeral || 0;
  const descontoMaoDeObra = orcamento?.descontoMaoDeObra || 0;
  const descontoMaterial = orcamento?.descontoMaterial || 0;

  const itemFator = (item: OrcamentoItem) => {
    const cat = item.categoria || 'SERVICO';
    return (
      (1 - descontoGeral / 100) *
      (cat === 'MAO_DE_OBRA' ? 1 - descontoMaoDeObra / 100 : 1) *
      (cat === 'MATERIAL' ? 1 - descontoMaterial / 100 : 1)
    );
  };

  const lineBase = (it: OrcamentoItem) => {
    const qty = parseFloat(it.quantidade as any) || 0;
    const unit = parseFloat(it.precoUnitario as any) || 0;
    return qty * unit;
  };

  const subtotalBase = items.reduce((acc, it) => acc + lineBase(it), 0);
  const subtotal = items.reduce((acc, it) => acc + lineBase(it) * itemFator(it), 0);
  const bdiPercent = orcamento?.bdi || 25.0;
  const totalComBdi = subtotal * (1 + bdiPercent / 100);

  const handleSave = async () => {
    if (!orcamento) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const payload: Orcamento = {
        ...orcamento,
        bdi: bdiPercent,
        descontoGeral,
        descontoMaoDeObra,
        descontoMaterial,
        itens: items,
      };
      const updated = await updateOrcamentoItens(payload);
      setOrcamento(updated);
      setItems(updated.itens || []);
      setFeedback({ type: 'success', message: 'Planilha orçamentária atualizada com sucesso!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao salvar itens.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDispatch = async () => {
    if (!orcamento) return;
    setIsDispatching(true);
    setDispatchProgress(15);
    setDispatchMessage('Iniciando sessão exclusiva no SEOBRA...');
    setFeedback(null);

    try {
      const payload: Orcamento = {
        ...orcamento,
        bdi: bdiPercent,
        descontoGeral,
        descontoMaoDeObra,
        descontoMaterial,
        itens: items,
      };
      await updateOrcamentoItens(payload);

      const result = await despacharParaSeobra(id);
      setOrcamento(result);
      setDispatchProgress(100);
      setDispatchMessage('Orçamento 100% concluído e liberado para acesso!');
      setFeedback({
        type: 'success',
        message: `Orçamento criado com sucesso no SEOBRA! (ID: ${result.seobraBudgetId})`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao despachar orçamento para o SEOBRA.' });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleDownloadSeobra = async () => {
    setIsDownloading(true);
    setFeedback(null);
    try {
      await downloadOrcamentoSeobraXlsx(id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao baixar planilha SEOBRA.' });
    } finally {
      setIsDownloading(false);
    }
  };

  const displayedItems = filterReviewOnly
    ? items.filter((it) => it.flagRevisao || it.confianca < 0.85)
    : items;

  const isCompleted = orcamento?.status === 'CONCLUIDO' && orcamento?.seobraBudgetId;
  const isCurrentlyWorking = isDispatching || orcamento?.status === 'DESPACHANDO_SEOBRA';

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw className="animate-spin" size={24} style={{ marginRight: '10px' }} />
          Carregando grade de conferência orçamentária...
        </div>
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <div style={{ flex: 1, padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Orçamento não encontrado.{' '}
          <Link href="/orcamentos" style={{ color: 'var(--brand-primary)' }}>
            Voltar para a lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main className="container" style={{ flex: 1, paddingTop: '32px', paddingBottom: '140px' }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/orcamentos"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
              marginBottom: '16px',
            }}
          >
            <ArrowLeft size={14} /> Voltar para Orçamentos
          </Link>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
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
                  {orcamento.fileType?.toUpperCase()} • {orcamento.originalFileName}
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
                  BASE: {orcamento.dataPrecoBase || 'SINAPI / SEINFRA'}
                </span>
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '26px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  margin: 0,
                  letterSpacing: '-0.03em',
                }}
              >
                {orcamento.titulo || orcamento.objeto}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '6px' }}>
                <Building2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                {orcamento.orgao || 'Órgão Licitante'} • {orcamento.localidade || 'Ceará / CE'}
              </p>
            </div>

            {/* Top Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isCompleted ? (
                <a
                  href={orcamento.seobraBudgetUrl || `https://www.seobra.com.br/seobra2/orcamento/${orcamento.seobraBudgetId}/itens`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                >
                  <CheckCircle2 size={16} /> Abrir no SEOBRA ({orcamento.seobraBudgetId}) <ExternalLink size={14} />
                </a>
              ) : isCurrentlyWorking ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--brand-primary-bg)',
                    border: '1px solid var(--brand-primary-border)',
                    color: 'var(--brand-primary)',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  <Lock size={15} /> Sessão isolada no SEOBRA em andamento...
                </div>
              ) : (
                <button
                  onClick={handleDispatch}
                  disabled={isCurrentlyWorking}
                  className="btn-primary"
                >
                  <Zap size={16} />
                  <span>Criar no SEOBRA ⚡</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* REAL-TIME BACKGROUND PROGRESS TRACKER */}
        {(isCurrentlyWorking || isCompleted) && (
          <div
            className="wishlabs-card"
            style={{
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isCompleted ? (
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--brand-primary-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--brand-primary)',
                    }}
                  >
                    <CheckCircle2 size={20} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--brand-primary-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--brand-primary)',
                    }}
                  >
                    <RefreshCw className="animate-spin" size={18} />
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                    {isCompleted
                      ? `Orçamento Concluído no SEOBRA (ID: ${orcamento.seobraBudgetId})`
                      : 'Sincronizando Orçamento no SEOBRA em Segundo Plano'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {isCompleted
                      ? 'Todas as composições e etapas foram gravadas com sucesso. Acesso liberado!'
                      : dispatchMessage || orcamento.progressMessage || 'Executando injeção em background...'}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: '22px',
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--brand-primary)',
                  }}
                >
                  {isCompleted ? 100 : Math.max(dispatchProgress, orcamento.progressPercent || 15)}%
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '999px',
                overflow: 'hidden',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${isCompleted ? 100 : Math.max(dispatchProgress, orcamento.progressPercent || 15)}%`,
                  backgroundColor: 'var(--brand-primary)',
                  transition: 'width 0.5s ease-in-out',
                  boxShadow: 'var(--shadow-glow)',
                }}
              />
            </div>

            {/* Stepper Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px',
              }}
            >
              {[
                { step: '1. Autenticação & Sessão', target: 15 },
                { step: '2. Criação do Cabeçalho', target: 35 },
                { step: `3. Injeção das Etapas (${orcamento.totalItens || items.length} itens)`, target: 65 },
                { step: '4. Cálculo BDI & Liberação', target: 100 },
              ].map((s) => {
                const done = isCompleted || (orcamento.progressPercent || dispatchProgress) >= s.target;
                return (
                  <div
                    key={s.step}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#101012',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      fontWeight: done ? 700 : 500,
                      color: done ? 'var(--brand-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {done ? <Check size={14} color="var(--brand-primary)" /> : <Clock size={14} />}
                    <span>{s.step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            style={{
              padding: '12px 20px',
              borderRadius: 'var(--radius-full)',
              marginBottom: '24px',
              backgroundColor: feedback.type === 'success' ? 'var(--brand-primary-bg)' : 'rgba(255, 129, 178, 0.15)',
              border: `1px solid ${feedback.type === 'success' ? 'var(--brand-primary-border)' : 'rgba(255, 129, 178, 0.3)'}`,
              color: feedback.type === 'success' ? 'var(--brand-primary)' : '#FF81B2',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Capsule Tab Navigation */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('itens')}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              border: activeTab === 'itens' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
              backgroundColor: activeTab === 'itens' ? 'var(--brand-primary-bg)' : '#101012',
              color: activeTab === 'itens' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Itens & Composições
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('descontos')}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              border: activeTab === 'descontos' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
              backgroundColor: activeTab === 'descontos' ? 'var(--brand-primary-bg)' : '#101012',
              color: activeTab === 'descontos' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Descontos da Proposta
          </button>
        </div>

        {/* BDI & Global Parameters Bento Card */}
        <div
          className="wishlabs-card"
          style={{
            padding: '24px',
            marginBottom: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                Taxa de BDI (%)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  step="0.1"
                  value={bdiPercent}
                  onChange={(e) => setOrcamento({ ...orcamento, bdi: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '90px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: '#101012',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>%</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                Subtotal (Sem BDI)
              </label>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(subtotal)}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Estimado (C/ BDI)
              </label>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(totalComBdi)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setFilterReviewOnly(!filterReviewOnly)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: filterReviewOnly ? 'rgba(245, 158, 11, 0.2)' : '#101012',
                border: `1px solid ${filterReviewOnly ? '#F59E0B' : 'var(--border-subtle)'}`,
                color: filterReviewOnly ? '#F59E0B' : 'var(--text-secondary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <AlertTriangle size={14} />
              Filtrar p/ Revisão ({items.filter((i) => i.flagRevisao || i.confianca < 0.85).length})
            </button>

            <button
              onClick={handleAddItem}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '12.5px' }}
            >
              <Plus size={14} /> Adicionar Item
            </button>
          </div>
        </div>

        {activeTab === 'itens' && (
          <div className="wishlabs-card" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={18} color="var(--brand-primary)" />
                <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  Composições & Serviços ({displayedItems.length} itens)
                </h2>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Edite valores ou quantitativos diretamente na grade antes de finalizar no SEOBRA.
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <th style={{ padding: '12px 16px', width: '60px' }}>Item</th>
                    <th style={{ padding: '12px 16px', width: '110px' }}>Código</th>
                    <th style={{ padding: '12px 16px', width: '90px' }}>Fonte</th>
                    <th style={{ padding: '12px 16px', width: '120px' }}>Categoria</th>
                    <th style={{ padding: '12px 16px' }}>Descrição do Serviço</th>
                    <th style={{ padding: '12px 16px', width: '70px', textAlign: 'center' }}>Und</th>
                    <th style={{ padding: '12px 16px', width: '100px', textAlign: 'right' }}>Qtd</th>
                    <th style={{ padding: '12px 16px', width: '120px', textAlign: 'right' }}>Unit. (R$)</th>
                    <th style={{ padding: '12px 16px', width: '130px', textAlign: 'right' }}>Total (R$)</th>
                    <th style={{ padding: '12px 16px', width: '90px', textAlign: 'center' }}>Confiança</th>
                    <th style={{ padding: '12px 16px', width: '50px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.map((item, idx) => {
                    const realIdx = items.findIndex((i) => i.id === item.id);
                    const itemIdx = realIdx >= 0 ? realIdx : idx;
                    const isLowConf = item.confianca < 0.85 || item.flagRevisao;

                    return (
                      <tr
                        key={item.id || idx}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          backgroundColor: isLowConf ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                        }}
                      >
                        {/* Item No */}
                        <td style={{ padding: '10px 16px' }}>
                          <input
                            type="text"
                            value={item.itemNumero}
                            onChange={(e) => handleItemChange(itemIdx, 'itemNumero', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'transparent',
                              border: '1px solid transparent',
                              color: 'var(--text-secondary)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                            }}
                          />
                        </td>

                        {/* Code */}
                        <td style={{ padding: '10px 16px' }}>
                          <input
                            type="text"
                            value={item.codigoReferencia}
                            onChange={(e) => handleItemChange(itemIdx, 'codigoReferencia', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#101012',
                              border: '1px solid var(--border-subtle)',
                              color: '#FFFFFF',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          />
                        </td>

                        {/* Source */}
                        <td style={{ padding: '10px 16px' }}>
                          <select
                            value={item.fonte}
                            onChange={(e) => handleItemChange(itemIdx, 'fonte', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#101012',
                              border: '1px solid var(--border-subtle)',
                              color: '#FFFFFF',
                              fontSize: '11.5px',
                              fontWeight: 700,
                            }}
                          >
                            <option value="SINAPI">SINAPI</option>
                            <option value="SEINFRA">SEINFRA</option>
                            <option value="SICRO">SICRO</option>
                            <option value="ORSE">ORSE</option>
                            <option value="PROPRIO">PRÓPRIA</option>
                          </select>
                        </td>

                        <td style={{ padding: '10px 16px' }}>
                          <select
                            value={item.categoria || 'SERVICO'}
                            onChange={(e) => handleItemChange(itemIdx, 'categoria', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#101012',
                              border: '1px solid var(--border-subtle)',
                              color: '#FFFFFF',
                              fontSize: '11.5px',
                              fontWeight: 700,
                            }}
                          >
                            <option value="SERVICO">Serviço</option>
                            <option value="MAO_DE_OBRA">Mão de obra</option>
                            <option value="MATERIAL">Material</option>
                          </select>
                        </td>

                        {/* Description */}
                        <td style={{ padding: '10px 16px' }}>
                          <input
                            type="text"
                            value={item.descricao}
                            onChange={(e) => handleItemChange(itemIdx, 'descricao', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'transparent',
                              border: '1px solid transparent',
                              color: '#FFFFFF',
                              fontSize: '13px',
                            }}
                          />
                        </td>

                        {/* Unit */}
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <input
                            type="text"
                            value={item.unidade}
                            onChange={(e) => handleItemChange(itemIdx, 'unidade', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 4px',
                              borderRadius: '4px',
                              backgroundColor: 'transparent',
                              border: '1px solid transparent',
                              color: 'var(--text-secondary)',
                              fontSize: '12px',
                              textAlign: 'center',
                            }}
                          />
                        </td>

                        {/* Quantity */}
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantidade}
                            onChange={(e) => handleItemChange(itemIdx, 'quantidade', e.target.value)}
                            style={{
                              width: '90px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#101012',
                              border: '1px solid var(--border-subtle)',
                              color: '#FFFFFF',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              textAlign: 'right',
                            }}
                          />
                        </td>

                        {/* Unit Price */}
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={item.precoUnitario}
                            onChange={(e) => handleItemChange(itemIdx, 'precoUnitario', e.target.value)}
                            style={{
                              width: '105px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#101012',
                              border: '1px solid var(--border-subtle)',
                              color: '#FFFFFF',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              textAlign: 'right',
                            }}
                          />
                        </td>

                        {/* Total */}
                        <td
                          style={{
                            padding: '10px 16px',
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            color: '#FFFFFF',
                          }}
                        >
                          {formatCurrency(lineBase(item) * itemFator(item))}
                        </td>

                        {/* Confidence */}
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11px',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              backgroundColor:
                                item.confianca >= 0.9
                                  ? 'var(--brand-primary-bg)'
                                  : 'rgba(245, 158, 11, 0.15)',
                              color:
                                item.confianca >= 0.9
                                  ? 'var(--brand-primary)'
                                  : 'var(--status-review)',
                            }}
                          >
                            {Math.round(item.confianca * 100)}%
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleRemoveItem(item, idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                            title="Remover Item"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* Floating Bottom Bar with Wishlabs Pill Actions */}
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(14, 14, 16, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 50,
        }}
      >
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
          <div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>TOTAL ORÇAMENTÁRIO CONSOLIDADO</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(totalComBdi)} <small style={{ fontSize: '11px', color: 'var(--brand-primary)' }}>(BDI {bdiPercent.toFixed(2)}% incluso)</small>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleDownloadSeobra}
              disabled={isCurrentlyWorking || isDownloading}
              className="btn-secondary"
            >
              <Download size={15} />
              <span>{isDownloading ? 'Baixando...' : 'Planilha SEOBRA'}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || isCurrentlyWorking}
              className="btn-secondary"
            >
              <Save size={15} />
              <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>

            {isCompleted ? (
              <a
                href={orcamento.seobraBudgetUrl || `https://www.seobra.com.br/seobra2/orcamento/${orcamento.seobraBudgetId}/itens`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                <CheckCircle2 size={16} /> Abrir no SEOBRA ({orcamento.seobraBudgetId}) ↗
              </a>
            ) : (
              <button
                onClick={handleDispatch}
                disabled={isCurrentlyWorking}
                className="btn-primary"
              >
                {isCurrentlyWorking ? (
                  <>
                    <RefreshCw className="animate-spin" size={15} />
                    <span>Processando ({dispatchProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Zap size={15} />
                    <span>Criar no SEOBRA ⚡</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
