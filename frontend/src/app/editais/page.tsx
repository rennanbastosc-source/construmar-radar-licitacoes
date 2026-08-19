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

const SAMPLE_EDITAIS: EditalAnalysis[] = [
  {
    id: 'edital-sample-1',
    titulo: 'Concorrência Eletrônica nº 2026/014 - Pavimentação e Drenagem Urbana',
    orgao: 'Secretaria da Infraestrutura do Estado do Ceará - SEINFRA',
    numeroEdital: 'CE-2026/014',
    numeroProcesso: 'PROC-2026-991',
    modalidade: 'Concorrência Eletrônica',
    modoDisputa: 'Aberto',
    objetoCompleto: 'Pavimentação asfáltica e drenagem pluvial no Polo Industrial.',
    localidade: 'Maracanaú - CE',
    dataAbertura: new Date(Date.now() + 12 * 86400000).toISOString(),
    valorEstimado: 14580000.0,
    prazoExecucao: '12 meses',
    regimeExecucao: 'Empreitada por Preço Unitário',
    status: 'CONCLUIDO',
    originalFileName: 'edital_seinfra_014_2026.pdf',
    fileType: 'pdf',
    totalPaginas: 42,
    resumoExecutivo: 'Edital exige visita técnica obrigatória com prazo exíguo de 3 dias úteis e comprovação de usinagem asfáltica própria em raio de até 50km.',
    parecerTecnico: 'Risco moderado em virtude da visita técnica mandatória.',
    scoreAderencia: 9.2,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    pegadinhas: [
      {
        id: 'p1',
        analysisId: 'edital-sample-1',
        clausula: 'Item 8.4',
        titulo: 'Visita Técnica Obrigatória com prazo de 3 dias',
        descricao: 'Exige agendamento prévio com engenheiro fiscal.',
        severidade: 'CRITICA',
        recomendacao: 'Protocolar pedido de visita imediatamente.',
        impacto: 'DESCLASSIFICACAO',
      },
    ],
  },
  {
    id: 'edital-sample-2',
    titulo: 'Pregão Eletrônico nº 089/2026 - Locação de Máquinas e Equipamentos Pesados',
    orgao: 'Prefeitura Municipal de Fortaleza - SMSP',
    numeroEdital: 'PE-089/2026',
    numeroProcesso: 'PROC-2026-332',
    modalidade: 'Pregão Eletrônico',
    modoDisputa: 'Aberto',
    objetoCompleto: 'Locação de andaimes tubulares e máquinas pesadas.',
    localidade: 'Fortaleza - CE',
    dataAbertura: new Date(Date.now() + 4 * 86400000).toISOString(),
    valorEstimado: 3890000.0,
    prazoExecucao: '6 meses',
    regimeExecucao: 'Registro de Preços',
    status: 'CONCLUIDO',
    originalFileName: 'termo_referencia_locacao.pdf',
    fileType: 'pdf',
    totalPaginas: 18,
    resumoExecutivo: 'Exigência de frotas com ano de fabricação máximo de 3 anos e operador incluso em regime 24/7.',
    parecerTecnico: 'Edital favorável sem cláusulas restritivas ilegais.',
    scoreAderencia: 8.8,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export default function EditaisHubPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyses, setAnalyses] = useState<EditalAnalysis[]>(SAMPLE_EDITAIS);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const loadData = async () => {
    setIsLoadingList(true);
    setErrorMessage(null);
    try {
      const res = await fetchEditalAnalyses(50, 0);
      if (res && res.items && res.items.length > 0) {
        setAnalyses(res.items);
      } else {
        setAnalyses(SAMPLE_EDITAIS);
      }
    } catch {
      setAnalyses(SAMPLE_EDITAIS);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilesSelected = async (incomingFiles: FileList | File[]) => {
    const list = Array.from(incomingFiles);
    if (list.length === 0) return;

    setSelectedFiles(list);
    setIsUploading(true);
    setErrorMessage(null);

    const fileCount = list.length;
    setUploadStep(
      fileCount > 1
        ? `Consolidando ${fileCount} arquivos em linha contínua de raciocínio...`
        : 'Extraindo conteúdo e estruturando páginas do edital...'
    );

    try {
      const timer1 = setTimeout(() => {
        setUploadStep(
          fileCount > 1
            ? `Cruzando cláusulas do Edital, Termo de Ref. e Anexos (${fileCount} docs)...`
            : 'IA Jurídica & Engenharia auditando exigências e habilitação...'
        );
      }, 1400);

      const timer2 = setTimeout(() => {
        setUploadStep('Mapeando pegadinhas, atestados mínimos e gerando checklist unificado...');
      }, 3000);

      const newAnalysis = await uploadEditalForAnalysis(list);

      clearTimeout(timer1);
      clearTimeout(timer2);
      setUploadStep('Auditoria concluída com sucesso! Redirecionando...');

      setTimeout(() => {
        router.push(`/editais/${newAnalysis.id}`);
      }, 600);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao processar arquivos do edital.');
      setIsUploading(false);
      setSelectedFiles([]);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main className="container" style={{ flex: 1, paddingTop: '36px', paddingBottom: '80px', maxWidth: '1400px' }}>
        {/* Hub Header */}
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
            <span>Analista IA de Editais • Lei 14.133/2021</span>
          </div>

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
            Auditoria de Editais, Habilitação &{' '}
            <span style={{ fontStyle: 'italic', fontWeight: 600, color: 'var(--brand-primary)' }}>
              Pegadinhas Jurídicas
            </span>
          </h1>
          <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '720px' }}>
            Envie o PDF do Edital ou Termo de Referência. A IA analisa cláusulas críticas, parcelas mínimas de atestados (CAT/ART) e gera o checklist obrigatório.
          </p>
        </div>

        {/* 2-Column Bento Hub */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Dropzone Bento Card */}
          <div
            className="wishlabs-card"
            style={{
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
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
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                      Auditando Documentos
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                      {uploadStep}
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
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
                      Clique ou arraste 1 ou múltiplos arquivos
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Selecione Edital + Termo de Ref. + Anexos (PDF ou imagens)
                    </p>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
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
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Feature Pills Footer */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                <ShieldAlert size={14} color="#FF81B2" />
                <span><strong style={{ color: '#FFFFFF' }}>Detector de Pegadinhas:</strong> identifica prazos curtos de vistoria e causas de inabilitação.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                <Scale size={14} color="var(--brand-primary)" />
                <span><strong style={{ color: '#FFFFFF' }}>Qualificação Técnica:</strong> quantitativos mínimos de atestados (CAT/ART).</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                <CheckSquare size={14} color="var(--brand-cyan)" />
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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

            {analyses.length === 0 ? (
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

                        <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1.3 }}>
                          {item.titulo}
                        </h3>

                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                          {item.orgao}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
