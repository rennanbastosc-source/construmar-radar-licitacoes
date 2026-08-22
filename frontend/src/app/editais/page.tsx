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
  Scale,
  CheckSquare,
  Sparkles,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  uploadEditalForAnalysis,
  fetchEditalAnalyses,
} from '@/lib/api';
import { EditalAnalysis } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { ErrorState } from '@/components/ErrorState';

export default function EditaisHubPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyses, setAnalyses] = useState<EditalAnalysis[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadElapsedSeconds, setUploadElapsedSeconds] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const loadData = async () => {
    setIsLoadingList(true);
    setErrorMessage(null);
    try {
      const res = await fetchEditalAnalyses(50, 0);
      setAnalyses(res.items || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar histórico de editais.');
      setAnalyses([]);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isUploading) {
      setUploadElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const updateElapsedTime = () => {
      setUploadElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };

    updateElapsedTime();
    const timer = window.setInterval(updateElapsedTime, 1000);
    return () => window.clearInterval(timer);
  }, [isUploading]);

  const handleFilesSelected = async (incomingFiles: FileList | File[]) => {
    const list = Array.from(incomingFiles);
    if (list.length === 0 || isUploading) return;

    setSelectedFiles(list);
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const newAnalysis = await uploadEditalForAnalysis(list);
      setSelectedFiles([]);
      router.push(`/editais/${newAnalysis.id}`);
    } catch (err: any) {
      setErrorMessage(
        err.name === 'TimeoutError'
          ? 'Tempo limite excedido ao auditar. O documento pode ser grande — tente novamente.'
          : err.message || 'Falha ao processar arquivos do edital.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%' }}>
      <Header />

      <main className="container" style={{ flex: 1, paddingTop: '36px', paddingBottom: '80px' }}>
        {/* Hub Header */}
        <div style={{ marginBottom: '32px', minWidth: 0 }}>
          <div className="page-eyebrow">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', flexShrink: 0 }} />
            <span>Analista IA de Editais • Lei 14.133/2021</span>
          </div>

          <h1 className="page-display-title">
            Auditoria de Editais, Habilitação &{' '}
            <span style={{ fontStyle: 'italic', fontWeight: 600, color: 'var(--brand-primary)' }}>
              Pegadinhas Jurídicas
            </span>
          </h1>
          <p className="page-display-lead" style={{ maxWidth: '720px' }}>
            Envie o PDF do Edital ou Termo de Referência. A IA analisa cláusulas críticas, parcelas mínimas de atestados (CAT/ART) e gera o checklist obrigatório.
          </p>
        </div>

        {/* 2-Column Bento Hub */}
        <div className="editais-hub-grid">
          {/* Dropzone Bento Card */}
          <div
            className="wishlabs-card"
            style={{
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <UploadCloud size={18} color="var(--brand-primary)" />
                <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  Enviar Edital / Termo de Ref.
                </h2>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="editais-dropzone"
                style={{
                  border: `2px dashed ${dragActive ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '48px 24px',
                  textAlign: 'center',
                  backgroundColor: dragActive ? 'var(--brand-primary-bg)' : '#101012',
                  cursor: isUploading ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesSelected(e.target.files);
                    }
                  }}
                />

                {isUploading ? (
                  <div>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--brand-primary-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        color: 'var(--brand-primary)',
                      }}
                    >
                      <RefreshCw className="animate-spin" size={20} />
                    </div>
                    <p
                      role="status"
                      aria-live="polite"
                      style={{ fontSize: '13px', color: 'var(--brand-primary)', fontWeight: 600 }}
                    >
                      Auditando documentos… {uploadElapsedSeconds}s
                    </p>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        color: 'var(--brand-primary)',
                      }}
                    >
                      <FileText size={22} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px', overflowWrap: 'break-word' }}>
                      Clique ou arraste 1 ou múltiplos arquivos
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', overflowWrap: 'break-word' }}>
                      Selecione Edital + Termo de Ref. + Anexos (PDF ou imagens)
                    </p>
                    <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--brand-primary-bg)', color: 'var(--brand-primary)' }}>
                        MULTI-UPLOAD
                      </span>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
                        .PDF
                      </span>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
                        .PNG
                      </span>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
                        .JPG
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(255, 129, 178, 0.15)',
                    border: '1px solid rgba(255, 129, 178, 0.3)',
                    color: '#FF81B2',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: 0,
                  }}
                >
                  <AlertCircle size={16} />
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{errorMessage}</span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleFilesSelected(selectedFiles)}
                    disabled={isUploading || selectedFiles.length === 0}
                    style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    <RefreshCw size={13} /> Tentar novamente
                  </button>
                </div>
              )}
            </div>

            {/* Feature Pills Footer */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="editais-feature-row">
                <ShieldAlert size={14} color="#FF81B2" style={{ flexShrink: 0, marginTop: 2 }} />
                <span><strong style={{ color: '#FFFFFF' }}>Detector de Pegadinhas:</strong> identifica prazos curtos de vistoria e causas de inabilitação.</span>
              </div>
              <div className="editais-feature-row">
                <Scale size={14} color="var(--brand-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span><strong style={{ color: '#FFFFFF' }}>Qualificação Técnica:</strong> quantitativos mínimos de atestados (CAT/ART).</span>
              </div>
              <div className="editais-feature-row">
                <CheckSquare size={14} color="var(--brand-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span><strong style={{ color: '#FFFFFF' }}>Checklist de Documentos:</strong> lista interativa dos anexos para envio da proposta.</span>
              </div>
            </div>
          </div>

          {/* Analyses History Bento Card */}
          <div
            className="wishlabs-card"
            style={{
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--brand-primary)" />
                <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  Editais Auditados Recentemente
                </h2>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {analyses.length} análise(s)
              </span>
            </div>

            {isLoadingList ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
                <RefreshCw className="animate-spin" size={24} color="var(--brand-primary)" style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Carregando auditorias...</p>
              </div>
            ) : analyses.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', backgroundColor: '#101012', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <FileText size={32} color="var(--text-secondary)" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  Nenhum edital auditado ainda
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '280px' }}>
                  Envie o PDF do edital no quadro ao lado para iniciar a análise jurídica e técnica.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analyses.map((item) => {
                  const pegadinhasCount = item.pegadinhas ? item.pegadinhas.length : 0;
                  const pegadinhasCriticas = item.pegadinhas ? item.pegadinhas.filter(p => p.severidade === 'CRITICA').length : 0;
                  return (
                    <Link
                      key={item.id}
                      href={`/editais/${item.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div
                        style={{
                          padding: '16px 20px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: '#101012',
                          border: '1px solid var(--border-subtle)',
                          transition: 'all 0.15s ease',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase' }}>
                            {item.numeroEdital || 'EDITAL'} • {item.modalidade || 'Licitação'}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            {formatDateTime(item.createdAt)}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1.3, overflowWrap: 'break-word' }}>
                          {item.titulo}
                        </h3>

                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                          {item.orgao}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '11px',
                                fontWeight: 800,
                                backgroundColor: pegadinhasCriticas > 0 ? 'rgba(255, 129, 178, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: pegadinhasCriticas > 0 ? '#FF81B2' : 'var(--status-review)',
                              }}
                            >
                              {pegadinhasCount} Pegadinha(s)
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                              {formatCurrency(item.valorEstimado || 0)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand-primary)', fontSize: '12px', fontWeight: 700 }}>
                            <span>Ver Parecer</span>
                            <ChevronRight size={14} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
