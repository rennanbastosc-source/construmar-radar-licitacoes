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
  Server,
  RefreshCw,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import {
  uploadEditalOrcamento,
  fetchOrcamentos,
  fetchSeobraStatus,
} from '@/lib/api';
import { Orcamento, SeobraStatusResponse } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { ErrorState } from '@/components/ErrorState';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function OrcamentosPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [seobraStatus, setSeobraStatus] = useState<SeobraStatusResponse | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isBusy, setIsBusy] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadData = async () => {
    setIsBusy(true);
    setIsLoadingList(true);
    setErrorMessage(null);
    setListError(null);
    try {
      const [listRes, seobraRes] = await Promise.allSettled([
        fetchOrcamentos(50, 0),
        fetchSeobraStatus(),
      ]);

      let loadError: string | null = null;
      if (listRes.status === 'fulfilled') {
        setOrcamentos(listRes.value.items || []);
      } else {
        loadError = getErrorMessage(listRes.reason, 'Erro ao carregar lista de orçamentos.');
        setOrcamentos([]);
      }
      if (seobraRes.status === 'fulfilled') {
        setSeobraStatus(seobraRes.value);
      } else if (!loadError) {
        loadError = getErrorMessage(seobraRes.reason, 'Erro ao verificar o status do SEOBRA.');
      }
      if (loadError) {
        setListError(loadError);
      }
    } catch (err: unknown) {
      setListError(getErrorMessage(err, 'Erro ao carregar lista de orçamentos.'));
      setOrcamentos([]);
    } finally {
      setIsLoadingList(false);
      setIsBusy(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file || isBusy) return;
    setIsBusy(true);
    setIsUploading(true);
    setErrorMessage(null);
    setUploadStep('Enviando documento para o motor de IA...');

    let timer1: ReturnType<typeof setTimeout> | null = null;
    let timer2: ReturnType<typeof setTimeout> | null = null;
    try {
      timer1 = setTimeout(() => {
        setUploadStep('IA Vision processando páginas e tabelas do edital...');
      }, 1000);

      timer2 = setTimeout(() => {
        setUploadStep('Mapeando composições SINAPI/SICRO e calculando BDI...');
      }, 2500);

      const newOrcamento = await uploadEditalOrcamento(file);

      clearTimeout(timer1);
      clearTimeout(timer2);
      setUploadStep('Extração concluída! Redirecionando...');

      setTimeout(() => {
        router.push(`/orcamentos/${newOrcamento.id}`);
      }, 800);
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, 'Falha ao processar o arquivo anexado.'));
    } finally {
      if (timer1 !== null) clearTimeout(timer1);
      if (timer2 !== null) clearTimeout(timer2);
      setIsUploading(false);
      setIsBusy(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBusy) return;
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
    if (isBusy) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main className="container" style={{ flex: 1, paddingTop: '36px', paddingBottom: '80px', maxWidth: '1400px' }}>
        {/* Hub Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--brand-primary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <Sparkles size={12} />
              <span>Módulo IA Vision SEOBRA</span>
            </div>

            {seobraStatus && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                }}
              >
                <Server size={12} color="var(--brand-primary)" />
                <span>SEOBRA: {seobraStatus.status === 'ONLINE' ? 'Sessão Conectada' : 'Offline'}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px' }}>
            <div>
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
                Orçamentação por IA &{' '}
                <span style={{ fontStyle: 'italic', fontWeight: 600, color: 'var(--brand-primary)' }}>
                  Integração SEOBRA
                </span>
              </h1>
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '720px' }}>
                Upload de editais em PDF (digital ou OCR escaneado), imagens ou planilhas Excel (.xlsx) para estruturação automática de preços e despacho direto.
              </p>
            </div>

            <button onClick={loadData} disabled={isBusy} className="btn-secondary">
              <RefreshCw size={13} className={isLoadingList ? 'animate-spin' : ''} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Dropzone Bento Card */}
        <div
          className="wishlabs-card"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            if (!isBusy) fileInputRef.current?.click();
          }}
          style={{
            border: `2px dashed ${dragActive ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
            padding: '54px 24px',
            textAlign: 'center',
            marginBottom: '40px',
            cursor: isBusy ? 'default' : 'pointer',
            backgroundColor: dragActive ? 'var(--brand-primary-bg)' : '#161618',
            transition: 'all 0.2s ease',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg"
            disabled={isBusy}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          {isUploading ? (
            <div>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--brand-primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: 'var(--brand-primary)',
                }}
              >
                <RefreshCw className="animate-spin" size={22} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                Extraindo Dados com IA
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                {uploadStep}
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  backgroundColor: '#101012',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                  color: 'var(--brand-primary)',
                }}
              >
                <UploadCloud size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
                Arraste e solte o Edital ou Planilha aqui
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Suporte para <strong style={{ color: '#FFFFFF' }}>PDF Escaneado (OCR)</strong>, <strong style={{ color: '#FFFFFF' }}>PDF Digital</strong>, <strong style={{ color: '#FFFFFF' }}>Planilhas Excel (.xlsx)</strong> e <strong style={{ color: '#FFFFFF' }}>Imagens</strong>.
              </p>
              <div style={{ display: 'inline-flex', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-full)', backgroundColor: '#101012', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  Limite de 32MB
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--brand-primary-bg)', color: 'var(--brand-primary)' }}>
                  ⚡ Despacho Instantâneo para o SEOBRA
                </span>
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '12px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 129, 178, 0.15)',
              border: '1px solid rgba(255, 129, 178, 0.3)',
              color: '#FF81B2',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '24px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Existing Budgets Section */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSpreadsheet size={18} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Orçamentos no Sistema ({orcamentos.length})
          </h2>
        </div>

        {isLoadingList ? (
          <div className="wishlabs-card" style={{ padding: '48px', textAlign: 'center' }}>
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>Carregando histórico de orçamentos...</p>
          </div>
        ) : listError ? (
          <div
            role="alert"
            className="wishlabs-card"
            style={{ padding: '48px 24px', textAlign: 'center' }}
          >
            <AlertCircle size={32} color="var(--status-urgent)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Não foi possível carregar os orçamentos
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px auto 20px' }}>
              {listError}
            </p>
            <button type="button" onClick={loadData} disabled={isBusy} className="btn-secondary">
              <RefreshCw size={13} />
              <span>Tentar novamente</span>
            </button>
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="wishlabs-card" style={{ padding: '48px', textAlign: 'center' }}>
            <FileSpreadsheet size={32} color="var(--text-secondary)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Nenhum orçamento gerado ainda
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Faça upload de uma planilha ou edital acima para que a IA estruture a primeira composição.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: '20px',
            }}
          >
            {orcamentos.map((orc) => (
              <Link
                key={orc.id}
                href={`/orcamentos/${orc.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="wishlabs-card"
                  style={{
                    padding: '24px',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '210px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: orc.status === 'CONCLUIDO' ? 'var(--brand-primary-bg)' : 'rgba(255, 255, 255, 0.05)',
                          color: orc.status === 'CONCLUIDO' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                          border: `1px solid ${orc.status === 'CONCLUIDO' ? 'var(--brand-primary-border)' : 'var(--border-subtle)'}`,
                        }}
                      >
                        {orc.status === 'CONCLUIDO' ? 'SEOBRA CONCLUÍDO' : 'AGUARDANDO REVISÃO'}
                      </span>

                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        {formatDateTime(orc.createdAt)}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1.3 }}>
                      {orc.titulo || orc.objeto}
                    </h3>

                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                      {orc.orgao || 'Órgão Licitante'} • {orc.localidade || 'Ceará / CE'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>VALOR ESTIMADO (BDI {orc.bdi || 25}%)</span>
                      <span style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                        {formatCurrency(orc.valorTotalComBdi || orc.valorTotalEstimado || 0)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-primary)', fontSize: '13px', fontWeight: 800 }}>
                      <span>Abrir Grade</span>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
