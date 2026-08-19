'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Search,
  Scale,
  Building2,
  FileSpreadsheet,
  CheckSquare,
  Sparkles,
  Zap,
  TrendingUp,
} from 'lucide-react';
import {
  uploadEditalForAnalysis,
  fetchEditalAnalyses,
} from '@/lib/api';
import { EditalAnalysis } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';

export default function EditaisHubPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyses, setAnalyses] = useState<EditalAnalysis[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoadingList(true);
    setErrorMessage(null);
    try {
      const res = await fetchEditalAnalyses(50, 0);
      setAnalyses(res.items || []);
    } catch (err: any) {
      console.warn('Backend offline ou cold-start:', err);
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
    setUploadStep('Extraindo conteúdo e estruturando páginas do edital...');

    try {
      const timer1 = setTimeout(() => {
        setUploadStep('IA Jurídica & Engenharia auditando exigências e habilitação...');
      }, 1200);

      const timer2 = setTimeout(() => {
        setUploadStep('Mapeando pegadinhas, atestados mínimos e gerando checklist...');
      }, 2800);

      const newAnalysis = await uploadEditalForAnalysis(file);

      clearTimeout(timer1);
      clearTimeout(timer2);
      setUploadStep('Auditoria concluída com sucesso! Redirecionando...');

      setTimeout(() => {
        router.push(`/editais/${newAnalysis.id}`);
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao auditar o edital anexado.');
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
                  backgroundColor: 'rgba(14, 165, 233, 0.12)',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                  color: 'var(--brand-cyan)',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                <Scale size={13} /> Analista IA de Editais (Lei 14.133/2021)
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: 'var(--color-confidence-high)',
                  fontWeight: 700,
                  fontSize: '11px',
                }}
              >
                <CheckCircle2 size={12} /> Motor Multimodal Ativo
              </span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.85rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Auditoria de Editais, Habilitação & Radar de Pegadinhas
            </h1>
            <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Envie o PDF do Edital ou Termo de Referência. A IA analisa cláusulas críticas, parcelas mínimas de atestados, índices contábeis e gera o checklist obrigatório.
            </p>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            style={{
              marginBottom: '1.8rem',
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#F87171',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#F87171',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Dispensar
            </button>
          </div>
        )}

        {/* Main Grid: Upload Dropzone & Audit History */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Left Column: Upload Dropzone */}
          <div className="saas-card" style={{ padding: '1.75rem' }}>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <UploadCloud size={20} color="var(--brand-cyan)" /> Enviar Edital / Termo de Ref.
            </h2>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? 'var(--brand-cyan)' : 'rgba(255, 255, 255, 0.15)'}`,
                borderRadius: '12px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                backgroundColor: dragActive ? 'rgba(14, 165, 233, 0.06)' : 'rgba(0, 0, 0, 0.25)',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              {isUploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      border: '3px solid rgba(14, 165, 233, 0.2)',
                      borderTopColor: 'var(--brand-cyan)',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                      Análise IA em Andamento
                    </p>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--brand-cyan)', fontSize: '0.85rem', fontWeight: 500 }}>
                      {uploadStep}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(14, 165, 233, 0.12)',
                      border: '1px solid rgba(14, 165, 233, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--brand-cyan)',
                    }}
                  >
                    <FileText size={28} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
                      Clique ou arraste o Edital aqui
                    </p>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      Suporta PDF digital, PDF escaneado e imagens (até 32MB)
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>.PDF</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>.PNG</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>.JPG</span>
                  </div>
                </div>
              )}
            </div>

            {/* Feature Highlights */}
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <ShieldAlert size={16} color="#F87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Detector de Pegadinhas:</strong> identifica prazos de vistoria, retenções e cláusulas de desclassificação.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <Scale size={16} color="var(--brand-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Qualificação Técnica:</strong> quantitativos mínimos de atestados (CAT/ART) e visita técnica.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <CheckSquare size={16} color="var(--color-confidence-high)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Checklist de Documentos:</strong> lista interativa dos anexos obrigatórios para envio da proposta.</span>
              </div>
            </div>
          </div>

          {/* Right Column: History of Analyzed Editais */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Clock size={18} color="var(--text-secondary)" /> Editais Auditados Recentemente
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {analyses.length} análise(s)
              </span>
            </div>

            {isLoadingList ? (
              <div className="saas-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      borderTopColor: 'var(--brand-cyan)',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <span>Carregando histórico de auditorias...</span>
                </div>
              </div>
            ) : analyses.length === 0 ? (
              <div className="saas-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                    color: 'var(--text-muted)',
                  }}
                >
                  <FileText size={28} />
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  Nenhum edital auditado ainda
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', marginInline: 'auto' }}>
                  Envie o edital em PDF ou imagem no painel ao lado para processar a auditoria automática com IA.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {analyses.map((item) => (
                  <Link
                    key={item.id}
                    href={`/editais/${item.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      className="saas-card hover-glow"
                      style={{
                        padding: '1.25rem 1.5rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        borderLeft: '4px solid var(--brand-cyan)',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <div style={{ flex: '1 1 300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(14, 165, 233, 0.15)',
                              color: 'var(--brand-cyan)',
                            }}
                          >
                            {item.numeroEdital || 'Edital'}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {item.orgao} • {item.localidade}
                          </span>
                        </div>
                        <h3
                          style={{
                            margin: '0 0 6px 0',
                            fontSize: '1.02rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            lineHeight: 1.35,
                          }}
                        >
                          {item.titulo || item.objetoCompleto?.slice(0, 100)}
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.84rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {item.resumoExecutivo}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Valor Estimado</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.1rem', color: '#10B981' }}>
                            {item.valorEstimado > 0 ? formatCurrency(item.valorEstimado) : 'Sigiloso'}
                          </span>
                        </div>

                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(242, 100, 25, 0.1)',
                            border: '1px solid rgba(242, 100, 25, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--brand-orange)',
                          }}
                        >
                          <ArrowRight size={20} />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
