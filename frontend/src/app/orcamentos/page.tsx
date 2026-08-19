'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Zap,
  Server,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  uploadEditalOrcamento,
  fetchOrcamentos,
  fetchSeobraStatus,
} from '@/lib/api';
import { Orcamento, SeobraStatusResponse } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';

export default function OrcamentosPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [seobraStatus, setSeobraStatus] = useState<SeobraStatusResponse | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoadingList(true);
    setErrorMessage(null);
    try {
      const [listRes, seobraRes] = await Promise.allSettled([
        fetchOrcamentos(50, 0),
        fetchSeobraStatus(),
      ]);

      if (listRes.status === 'fulfilled') {
        setOrcamentos(listRes.value.items || []);
      }
      if (seobraRes.status === 'fulfilled') {
        setSeobraStatus(seobraRes.value);
      }
    } catch (err: any) {
      console.warn('Backend cold-start em orçamentos:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setErrorMessage(null);
    setUploadStep('Enviando documento para o motor de IA...');

    try {
      const timer1 = setTimeout(() => {
        setUploadStep('IA Vision processando páginas e tabelas do edital...');
      }, 1000);

      const timer2 = setTimeout(() => {
        setUploadStep('Mapeando composições SINAPI/SICRO e calculando BDI...');
      }, 2500);

      const newOrcamento = await uploadEditalOrcamento(file);

      clearTimeout(timer1);
      clearTimeout(timer2);
      setUploadStep('Extração concluída! Redirecionando...');

      setTimeout(() => {
        router.push(`/orcamentos/${newOrcamento.id}`);
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao processar o arquivo anexado.');
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
      <Header />

      <main className="container" style={{ flex: 1, padding: '2.5rem 1.5rem', maxWidth: '1300px' }}>
        {/* Top Header Banner */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '2.2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(242, 100, 25, 0.1)',
                  border: '1px solid rgba(242, 100, 25, 0.25)',
                  color: 'var(--brand-orange)',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                <Zap size={13} /> Módulo IA Vision
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  backgroundColor: seobraStatus?.status === 'ONLINE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${seobraStatus?.status === 'ONLINE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  color: seobraStatus?.status === 'ONLINE' ? '#10b981' : '#f59e0b',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                <Server size={13} />
                SEOBRA: {seobraStatus?.status === 'ONLINE' ? 'Conectado' : 'Simulador Ativo'}
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.03em', margin: 0 }}>
              Orçamentação por IA & Integração SEOBRA
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '4px' }}>
              Faça upload de editais em PDF (digital ou escaneado), imagens ou planilhas Excel (.xlsx) para estruturação automática de preços e despacho direto.
            </p>
          </div>

          <button
            onClick={loadData}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12.5px' }}
          >
            <RefreshCw size={13} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Upload Hub Box */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--brand-primary)' : isUploading ? 'var(--color-brand-cyan)' : 'var(--border-strong)'}`,
            borderRadius: '16px',
            backgroundColor: dragActive ? 'rgba(242, 100, 25, 0.04)' : 'var(--bg-surface)',
            padding: '3rem 2rem',
            textAlign: 'center',
            cursor: isUploading ? 'default' : 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: '3rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  border: '3px solid rgba(14, 165, 233, 0.2)',
                  borderTopColor: '#0ea5e9',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Processando Edital com Inteligência Artificial
                </h3>
                <p style={{ color: '#0ea5e9', fontSize: '14px', marginTop: '6px', fontWeight: 600 }}>
                  {uploadStep}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(242, 100, 25, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f26419',
                }}
              >
                <UploadCloud size={32} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Arraste e solte o Edital ou Planilha aqui
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
                  Suporte nativo para <strong style={{ color: '#ffffff' }}>PDF Escaneado (OCR)</strong>, <strong style={{ color: '#ffffff' }}>PDF Digital</strong>, <strong style={{ color: '#ffffff' }}>Planilhas Excel (.xlsx)</strong> e <strong style={{ color: '#ffffff' }}>Imagens</strong>.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Limite de 32MB por arquivo
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    color: '#38bdf8',
                    fontWeight: 600,
                  }}
                >
                  ⚡ Despacho Instantâneo para o SEOBRA
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section: Orçamentos Processados */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={20} color="#f26419" /> Orçamentos no Sistema ({orcamentos.length})
            </h3>
          </div>

          {isLoadingList ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Carregando histórico de orçamentos...
            </div>
          ) : orcamentos.length === 0 ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <FileText size={40} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
              <h4 style={{ color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Nenhum orçamento extraído ainda</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                Faça o upload do primeiro documento acima para ver o poder da orçamentação automática com SEOBRA.
              </p>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>TÍTULO / DOCUMENTO</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>ÓRGÃO & BASE</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>ITENS</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>VALOR TOTAL (C/ BDI)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>CONFIANÇA IA</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATUS</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orcamentos.map((orc) => (
                      <tr
                        key={orc.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <Link
                            href={`/orcamentos/${orc.id}`}
                            style={{
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              textDecoration: 'none',
                              display: 'block',
                              fontSize: '14px',
                            }}
                          >
                            {orc.titulo || orc.originalFileName}
                          </Link>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Arquivo: {orc.originalFileName} • {formatDateTime(orc.createdAt)}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{orc.orgao || 'Não informado'}</div>
                          <span style={{ fontSize: '11px', color: '#0ea5e9' }}>{orc.dataPrecoBase || 'SINAPI'} • BDI {orc.bdi}%</span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {orc.totalItens} serviços
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#f26419' }}>
                            {formatCurrency(orc.valorTotalComBdi || orc.valorTotalEstimado)}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Sem BDI: {formatCurrency(orc.valorTotalEstimado)}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor:
                                orc.confiancaMedia >= 0.90
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : orc.confiancaMedia >= 0.75
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                              color:
                                orc.confiancaMedia >= 0.90
                                  ? '#10b981'
                                  : orc.confiancaMedia >= 0.75
                                  ? '#f59e0b'
                                  : '#ef4444',
                            }}
                          >
                            <Sparkles size={12} /> {Math.round((orc.confiancaMedia || 0.95) * 100)}%
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {orc.status === 'CONCLUIDO' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              <CheckCircle2 size={13} /> NO SEOBRA
                            </span>
                          ) : orc.status === 'DESPACHANDO_SEOBRA' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                                color: '#0ea5e9',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              <RefreshCw size={13} className="animate-spin" /> ENVIANDO...
                            </span>
                          ) : orc.status === 'ERRO' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                color: '#ef4444',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              <AlertCircle size={13} /> ERRO
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                color: '#f59e0b',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              <Clock size={13} /> AGUARDANDO REVISÃO
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            {orc.seobraBudgetUrl && (
                              <a
                                href={orc.seobraBudgetUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                }}
                              >
                                SEOBRA <ExternalLink size={12} />
                              </a>
                            )}
                            <Link
                              href={`/orcamentos/${orc.id}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--brand-primary)',
                                color: '#ffffff',
                                fontSize: '12px',
                                fontWeight: 700,
                                textDecoration: 'none',
                              }}
                            >
                              Revisar & Despachar <ArrowRight size={13} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
