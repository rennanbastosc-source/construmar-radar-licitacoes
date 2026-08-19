'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import {
  ArrowLeft,
  Download,
  Send,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Calculator,
  Percent,
  RefreshCw,
} from 'lucide-react';
import {
  fetchOrcamentoDetail,
  despacharParaSeobra,
  downloadOrcamentoSeobraXlsx,
} from '@/lib/api';
import { Orcamento } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { ErrorState } from '@/components/ErrorState';

export default function OrcamentoDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDespachando, setIsDespachando] = useState(false);
  const [despachoStep, setDespachoStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadDetail = async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchOrcamentoDetail(id);
      if (data) {
        setOrcamento(data);
      } else {
        setErrorMessage('Orçamento não encontrado no sistema.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar orçamento.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const handleExportXLSX = async () => {
    if (!orcamento) return;
    setIsExporting(true);
    setErrorMessage(null);
    try {
      await downloadOrcamentoSeobraXlsx(orcamento.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar planilha XLSX.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDespachar = async () => {
    if (!orcamento) return;
    setIsDespachando(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setDespachoStep('Iniciando sessão autenticada no SEOBRA Ceará...');

    try {
      const t1 = setTimeout(() => {
        setDespachoStep('Criando pasta da obra e importando itens da planilha...');
      }, 1500);

      const t2 = setTimeout(() => {
        setDespachoStep('Aplicando composições e recalculando BDI padrão...');
      }, 3000);

      const res = await despacharParaSeobra(orcamento.id);

      clearTimeout(t1);
      clearTimeout(t2);
      setDespachoStep('Despacho concluído com sucesso!');
      setSuccessMessage('Orçamento despachado e vinculado com sucesso ao SEOBRA!');

      setOrcamento(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao despachar orçamento para o SEOBRA.');
    } finally {
      setIsDespachando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main className="container" style={{ flex: 1, paddingTop: '32px', paddingBottom: '80px', maxWidth: '1400px' }}>
        {/* Navigation Breadcrumb */}
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
            }}
          >
            <ArrowLeft size={16} /> Voltar para Orçamentos
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>Carregando grade orçamentária...</p>
          </div>
        ) : !orcamento ? (
          <ErrorState message="Orçamento não encontrado." onRetry={loadDetail} />
        ) : (
          <>
            {/* Top Bento Header Card */}
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
                      backgroundColor: 'var(--brand-primary-bg)',
                      color: 'var(--brand-primary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      border: '1px solid var(--brand-primary-border)',
                    }}
                  >
                    BASE: {orcamento.dataPrecoBase || 'SEOBRA / SINAPI'}
                  </span>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    BDI: {orcamento.bdi || 25}%
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={handleExportXLSX}
                    disabled={isExporting}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    <Download size={14} className={isExporting ? 'animate-spin' : ''} />
                    <span>{isExporting ? 'Gerando...' : 'Exportar Planilha'}</span>
                  </button>

                  <button
                    onClick={handleDespachar}
                    disabled={isDespachando}
                    className="btn-primary"
                    style={{ padding: '8px 18px', fontSize: '13px' }}
                  >
                    <Send size={14} className={isDespachando ? 'animate-spin' : ''} />
                    <span>{isDespachando ? 'Despachando...' : 'Despachar para SEOBRA'}</span>
                  </button>
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
                {orcamento.titulo || orcamento.objeto}
              </h1>

              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                <Building2 size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {orcamento.orgao || 'Órgão Licitante'} • {orcamento.localidade || 'Ceará / CE'}
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
                    Custo Direto (Sem BDI)
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(orcamento.valorTotalEstimado || 0)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Valor Total com BDI ({orcamento.bdi || 25}%)
                  </span>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(orcamento.valorTotalComBdi || orcamento.valorTotalEstimado || 0)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total de Itens
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {(orcamento.itens || []).length} composições
                  </div>
                </div>
              </div>
            </div>

            {/* Stepper Feedback Bento Box */}
            {isDespachando && (
              <div className="wishlabs-card" style={{ padding: '24px 32px', marginBottom: '24px', backgroundColor: 'var(--brand-primary-bg)', border: '1px solid var(--brand-primary-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <RefreshCw className="animate-spin" size={20} color="var(--brand-primary)" />
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 2px' }}>
                      Executando Automação SEOBRA
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--brand-primary)', margin: 0, fontWeight: 600 }}>
                      {despachoStep}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="wishlabs-card" style={{ padding: '20px 24px', marginBottom: '24px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} color="#10B981" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#10B981' }}>
                    {successMessage}
                  </span>
                </div>
              </div>
            )}

            {/* Items Spreadsheet Table Card */}
            <div className="wishlabs-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  Planilha de Itens & Composições Extraídas
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {(orcamento.itens || []).length} itens
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '14px 20px', width: '70px' }}>Item</th>
                      <th style={{ padding: '14px 16px', width: '110px' }}>Código</th>
                      <th style={{ padding: '14px 20px' }}>Descrição dos Serviços</th>
                      <th style={{ padding: '14px 16px', width: '70px', textAlign: 'center' }}>Und</th>
                      <th style={{ padding: '14px 16px', width: '100px', textAlign: 'right' }}>Qtd</th>
                      <th style={{ padding: '14px 16px', width: '130px', textAlign: 'right' }}>Unitário (R$)</th>
                      <th style={{ padding: '14px 20px', width: '150px', textAlign: 'right' }}>Total (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orcamento.itens || []).map((it) => (
                      <tr key={it.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {it.itemNumero}
                        </td>
                        <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-cyan)' }}>
                          {it.codigoReferencia || '—'}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#FFFFFF', fontWeight: 600 }}>
                          {it.descricao}
                        </td>
                        <td style={{ padding: '16px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {it.unidade}
                        </td>
                        <td style={{ padding: '16px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFFFFF' }}>
                          {it.quantidade.toLocaleString('pt-BR')}
                        </td>
                        <td style={{ padding: '16px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {formatCurrency(it.precoUnitario)}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--brand-primary)' }}>
                          {formatCurrency(it.precoTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
