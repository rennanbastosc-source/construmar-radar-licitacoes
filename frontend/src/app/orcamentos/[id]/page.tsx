'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Calculator,
  Building2,
  FileSpreadsheet,
  Zap,
  Download,
  Lock,
  Check,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchOrcamentoDetail,
  updateOrcamentoItens,
  despacharParaSeobra,
} from '@/lib/api';
import { Orcamento, OrcamentoItem } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

export default function OrcamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [items, setItems] = useState<OrcamentoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(0);
  const [dispatchMessage, setDispatchMessage] = useState('');
  const [filterReviewOnly, setFilterReviewOnly] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadBudget = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchOrcamentoDetail(id);
      setOrcamento(data);
      if (!silent) {
        setItems(data.itens || []);
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
    } catch (err: any) {
      if (!silent) {
        setFeedback({ type: 'error', message: err.message || 'Erro ao carregar orçamento.' });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBudget();
  }, [id]);

  // Polling during dispatch
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

  // Recalculate item total when qty or unit price changes
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // Compute live totals
  const subtotal = items.reduce((acc, it) => acc + (it.precoTotal || 0), 0);
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
      // 1. Save latest items first
      const payload: Orcamento = {
        ...orcamento,
        bdi: bdiPercent,
        itens: items,
      };
      await updateOrcamentoItens(payload);

      // 2. Dispatch to SEOBRA via Reverse API
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

  const displayedItems = filterReviewOnly
    ? items.filter((it) => it.flagRevisao || it.confianca < 0.85)
    : items;

  const isCompleted = orcamento?.status === 'CONCLUIDO' && orcamento?.seobraBudgetId;
  const isCurrentlyWorking = isDispatching || orcamento?.status === 'DESPACHANDO_SEOBRA';

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw className="animate-spin" size={24} style={{ marginRight: '10px' }} />
          Carregando grade de conferência orçamentária...
        </div>
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <div style={{ flex: 1, padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Orçamento não encontrado.{' '}
          <Link href="/orcamentos" style={{ color: 'var(--brand-primary)' }}>
            Voltar para a lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
      <Header />

      <main className="container" style={{ flex: 1, padding: '2rem 1rem', maxWidth: '1400px', paddingBottom: '120px' }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/orcamentos"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-muted)',
              fontSize: '13px',
              textDecoration: 'none',
              marginBottom: '1rem',
            }}
          >
            <ArrowLeft size={14} /> Voltar para Orçamentos
          </Link>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(242, 100, 25, 0.15)',
                    color: '#f26419',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {orcamento.fileType?.toUpperCase()} • {orcamento.originalFileName}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(14, 165, 233, 0.15)',
                    color: '#0ea5e9',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  BASE: {orcamento.dataPrecoBase || 'SINAPI / SEINFRA'}
                </span>
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {orcamento.titulo || orcamento.objeto}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                <Building2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                {orcamento.orgao || 'Órgão Licitante'} • {orcamento.localidade || 'Ceará / CE'}
              </p>
            </div>

            {/* Top Action / Locked Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isCompleted ? (
                <a
                  href={orcamento.seobraBudgetUrl || `https://www.seobra.com.br/seobra2/orcamento/${orcamento.seobraBudgetId}/itens`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10b981',
                    color: '#10b981',
                    fontWeight: 800,
                    fontSize: '14px',
                    textDecoration: 'none',
                    boxShadow: '0 0 15px rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <CheckCircle2 size={18} /> Abrir no SEOBRA ({orcamento.seobraBudgetId}) <ExternalLink size={14} />
                </a>
              ) : isCurrentlyWorking ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(242, 100, 25, 0.12)',
                    border: '1px solid rgba(242, 100, 25, 0.3)',
                    color: '#f26419',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  <Lock size={15} /> Acesso bloqueado durante criação (Sessão isolada)
                </div>
              ) : (
                <button
                  onClick={handleDispatch}
                  disabled={isCurrentlyWorking}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--brand-primary)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(242, 100, 25, 0.4)',
                  }}
                >
                  <Zap size={16} fill="#ffffff" />
                  Criar no SEOBRA ⚡
                </button>
              )}
            </div>
          </div>
        </div>

        {/* REAL-TIME BACKGROUND PROGRESS TRACKER */}
        {(isCurrentlyWorking || isCompleted) && (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '12px',
              border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.4)' : 'rgba(14, 165, 233, 0.4)'}`,
              padding: '1.5rem',
              marginBottom: '1.5rem',
              boxShadow: isCompleted
                ? '0 4px 20px rgba(16, 185, 129, 0.1)'
                : '0 4px 20px rgba(14, 165, 233, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isCompleted ? (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                    }}
                  >
                    <CheckCircle2 size={20} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(14, 165, 233, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0ea5e9',
                    }}
                  >
                    <RefreshCw className="animate-spin" size={18} />
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {isCompleted
                      ? `Orçamento Concluído no SEOBRA (ID: ${orcamento.seobraBudgetId})`
                      : 'Sincronizando Orçamento no SEOBRA em Segundo Plano'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {isCompleted
                      ? 'Todas as composições e etapas foram gravadas com sucesso. Acesso liberado!'
                      : dispatchMessage || orcamento.progressMessage || 'Executando injeção em background...'}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono)',
                    color: isCompleted ? '#10b981' : '#0ea5e9',
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
                height: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '999px',
                overflow: 'hidden',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${isCompleted ? 100 : Math.max(dispatchProgress, orcamento.progressPercent || 15)}%`,
                  backgroundColor: isCompleted ? '#10b981' : '#0ea5e9',
                  backgroundImage: isCompleted
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #0ea5e9, #f26419)',
                  transition: 'width 0.5s ease-in-out',
                  boxShadow: isCompleted
                    ? '0 0 12px rgba(16, 185, 129, 0.5)'
                    : '0 0 12px rgba(14, 165, 233, 0.5)',
                }}
              />
            </div>

            {/* Stepper Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {/* Step 1 */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: isCompleted || (orcamento.progressPercent || dispatchProgress) >= 15 ? '#10b981' : 'var(--text-muted)',
                }}
              >
                {isCompleted || (orcamento.progressPercent || dispatchProgress) >= 15 ? (
                  <Check size={16} color="#10b981" />
                ) : (
                  <Clock size={16} />
                )}
                <span>1. Autenticação & Sessão</span>
              </div>

              {/* Step 2 */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: isCompleted || (orcamento.progressPercent || dispatchProgress) >= 35 ? '#10b981' : 'var(--text-muted)',
                }}
              >
                {isCompleted || (orcamento.progressPercent || dispatchProgress) >= 35 ? (
                  <Check size={16} color="#10b981" />
                ) : (
                  <Clock size={16} />
                )}
                <span>2. Criação do Cabeçalho</span>
              </div>

              {/* Step 3 */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: isCompleted || (orcamento.progressPercent || dispatchProgress) >= 65 ? '#10b981' : 'var(--text-muted)',
                }}
              >
                {isCompleted || (orcamento.progressPercent || dispatchProgress) >= 65 ? (
                  <Check size={16} color="#10b981" />
                ) : (
                  <Clock size={16} />
                )}
                <span>3. Injeção das Etapas ({orcamento.totalItens || items.length} itens)</span>
              </div>

              {/* Step 4 */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: isCompleted ? '#10b981' : 'var(--text-muted)',
                }}
              >
                {isCompleted ? (
                  <Check size={16} color="#10b981" />
                ) : (
                  <Clock size={16} />
                )}
                <span>4. Cálculo BDI & Liberação</span>
              </div>
            </div>

            {/* Lock Warning when in progress */}
            {isCurrentlyWorking && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(242, 100, 25, 0.08)',
                  border: '1px solid rgba(242, 100, 25, 0.2)',
                  fontSize: '12px',
                  color: '#f26419',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldCheck size={15} />
                <span>
                  <strong>Sessão Exclusiva:</strong> Não abra o SEOBRA em outra aba durante este processo para garantir que nenhum item seja descartado por colisão de sessão.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
              color: feedback.type === 'success' ? '#10b981' : '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* BDI & Global Parameters Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                TAXA DE BDI (%)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  step="0.1"
                  value={bdiPercent}
                  onChange={(e) => setOrcamento({ ...orcamento, bdi: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '90px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>%</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                SUBTOTAL (SEM BDI)
              </label>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(subtotal)}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                VALOR TOTAL ESTIMADO (C/ BDI)
              </label>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(totalComBdi)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setFilterReviewOnly(!filterReviewOnly)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                backgroundColor: filterReviewOnly ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-surface-elevated)',
                border: `1px solid ${filterReviewOnly ? '#f59e0b' : 'var(--border-strong)'}`,
                color: filterReviewOnly ? '#f59e0b' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <AlertTriangle size={14} />
              Filtrar p/ Revisão ({items.filter((i) => i.flagRevisao || i.confianca < 0.85).length})
            </button>

            <button
              onClick={handleAddItem}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Adicionar Item
            </button>
          </div>
        </div>

        {/* Items Data Grid */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} color="var(--brand-primary)" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Composições & Serviços ({displayedItems.length} itens)
              </h2>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Edite valores ou quantitativos diretamente na grade antes de finalizar no SEOBRA.
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px', width: '60px' }}>ITEM</th>
                  <th style={{ padding: '10px 12px', width: '100px' }}>CÓDIGO</th>
                  <th style={{ padding: '10px 12px', width: '90px' }}>FONTE</th>
                  <th style={{ padding: '10px 12px' }}>DESCRIÇÃO DO SERVIÇO</th>
                  <th style={{ padding: '10px 12px', width: '70px', textAlign: 'center' }}>UND</th>
                  <th style={{ padding: '10px 12px', width: '100px', textAlign: 'right' }}>QTD</th>
                  <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right' }}>UNIT. (R$)</th>
                  <th style={{ padding: '10px 12px', width: '130px', textAlign: 'right' }}>TOTAL (R$)</th>
                  <th style={{ padding: '10px 12px', width: '90px', textAlign: 'center' }}>IA CONF.</th>
                  <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item, idx) => {
                  const isLowConf = item.confianca < 0.85 || item.flagRevisao;

                  return (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isLowConf ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Item No */}
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          value={item.itemNumero}
                          onChange={(e) => handleItemChange(idx, 'itemNumero', e.target.value)}
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
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          value={item.codigoReferencia}
                          onChange={(e) => handleItemChange(idx, 'codigoReferencia', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: '#ffffff',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        />
                      </td>

                      {/* Source */}
                      <td style={{ padding: '8px 12px' }}>
                        <select
                          value={item.fonte}
                          onChange={(e) => handleItemChange(idx, 'fonte', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          <option value="SINAPI">SINAPI</option>
                          <option value="SEINFRA">SEINFRA</option>
                          <option value="SICRO">SICRO</option>
                          <option value="ORSE">ORSE</option>
                          <option value="PROPRIO">PRÓPRIA</option>
                        </select>
                      </td>

                      {/* Description */}
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          value={item.descricao}
                          onChange={(e) => handleItemChange(idx, 'descricao', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            border: '1px solid transparent',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                          }}
                        />
                      </td>

                      {/* Unit */}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <input
                          type="text"
                          value={item.unidade}
                          onChange={(e) => handleItemChange(idx, 'unidade', e.target.value)}
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
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={item.quantidade}
                          onChange={(e) => handleItemChange(idx, 'quantidade', e.target.value)}
                          style={{
                            width: '90px',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: '#ffffff',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            textAlign: 'right',
                          }}
                        />
                      </td>

                      {/* Unit Price */}
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={item.precoUnitario}
                          onChange={(e) => handleItemChange(idx, 'precoUnitario', e.target.value)}
                          style={{
                            width: '105px',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: '#ffffff',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            textAlign: 'right',
                          }}
                        />
                      </td>

                      {/* Total */}
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: '#ffffff',
                        }}
                      >
                        {formatCurrency(item.precoTotal)}
                      </td>

                      {/* Confidence */}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            backgroundColor:
                              item.confianca >= 0.9
                                ? 'rgba(16, 185, 129, 0.15)'
                                : item.confianca >= 0.7
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color:
                              item.confianca >= 0.9
                                ? '#10b981'
                                : item.confianca >= 0.7
                                ? '#f59e0b'
                                : '#ef4444',
                          }}
                        >
                          {Math.round(item.confianca * 100)}%
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleRemoveItem(idx)}
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
      </main>

      {/* Floating Bottom Bar with Exclusive Actions */}
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 50,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>TOTAL ORÇAMENTÁRIO CONSOLIDADO</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(totalComBdi)} <small style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>(BDI {bdiPercent.toFixed(2)}% incluso)</small>
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleSave}
              disabled={isSaving || isCurrentlyWorking}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSaving || isCurrentlyWorking ? 'default' : 'pointer',
              }}
            >
              <Save size={15} />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            {isCompleted ? (
              <a
                href={orcamento.seobraBudgetUrl || `https://www.seobra.com.br/seobra2/orcamento/${orcamento.seobraBudgetId}/itens`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                }}
              >
                <CheckCircle2 size={16} /> Abrir Orçamento no SEOBRA ({orcamento.seobraBudgetId}) ↗
              </a>
            ) : (
              <button
                onClick={handleDispatch}
                disabled={isCurrentlyWorking}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--brand-primary)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: isCurrentlyWorking ? 'default' : 'pointer',
                  boxShadow: '0 4px 14px rgba(242, 100, 25, 0.4)',
                }}
              >
                {isCurrentlyWorking ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    Processando em Background ({dispatchProgress}%)...
                  </>
                ) : (
                  <>
                    <Zap size={16} fill="#ffffff" />
                    Criar Orçamento no SEOBRA ⚡
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
