'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { BadgeClassification } from '@/components/BadgeClassification';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { ErrorState } from '@/components/ErrorState';
import { fetchOpportunityDetail, fetchOpportunityOrigin } from '@/lib/api';
import {
  LicitacaoOportunidade,
  LicitacaoPayloadSnapshot,
  OpportunityOriginDetail,
  isTceSource,
  sourcePortalLabel,
} from '@/lib/types';
import { SourceBadge } from '@/components/SourceBadge';
import {
  formatCurrency,
  formatDateTime,
  formatCNPJ,
} from '@/lib/formatters';
import {
  ArrowLeft,
  ExternalLink,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  FileCode,
  FileText,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Download,
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function OpportunityDetailPage({ params }: Props) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [opportunity, setOpportunity] = useState<LicitacaoOportunidade | null>(null);
  const [snapshots, setSnapshots] = useState<LicitacaoPayloadSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [originDetail, setOriginDetail] = useState<OpportunityOriginDetail | null>(null);
  const [isLoadingOrigin, setIsLoadingOrigin] = useState<boolean>(false);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchOpportunityDetail(id);
      if (resp && resp.data) {
        setOpportunity(resp.data);
        setSnapshots(resp.snapshots || []);
      } else {
        setError('Oportunidade de licitação não encontrada.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar os detalhes da licitação.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  useEffect(() => {
    if (!opportunity?.id) {
      setOriginDetail(null);
      setIsLoadingOrigin(false);
      return;
    }

    let cancelled = false;
    setOriginDetail(null);
    setIsLoadingOrigin(true);
    fetchOpportunityOrigin(opportunity.id)
      .then((data) => {
        if (!cancelled) setOriginDetail(data);
      })
      .catch((err) => {
        console.warn('Erro ao carregar plataforma de origem:', err);
        if (!cancelled) setOriginDetail(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOrigin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [opportunity?.id]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <Header />

      <main className="container" style={{ paddingTop: '32px', paddingBottom: '80px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
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
            <ArrowLeft size={16} /> Voltar para o Radar de Licitações
          </Link>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={loadDetail} />
        ) : loading ? (
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>Carregando dados da licitação...</p>
          </div>
        ) : !opportunity ? (
          <ErrorState message="Oportunidade não encontrada." onRetry={loadDetail} />
        ) : (
          <>
            {/* Top Header Bento Card */}
            <div
              className="wishlabs-card"
              style={{
                padding: '32px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                  <BadgeClassification
                    classification={opportunity.classification}
                    score={opportunity.classificationScore}
                    terms={opportunity.classificationTerms}
                  />
                  <UrgencyBadge deadlineIso={opportunity.proposalEndAt} />
                  <SourceBadge source={opportunity.source} />
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {opportunity.statusSource}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <Link href="/orcamentos" className="btn-primary">
                    <Sparkles size={14} />
                    <span>Orçar com IA SEOBRA</span>
                  </Link>

                  <a
                    href={opportunity.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    <span>{sourcePortalLabel(opportunity.source).replace('Ver no', 'Abrir no')}</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '24px',
                  fontWeight: 900,
                  lineHeight: 1.35,
                  color: '#FFFFFF',
                  marginBottom: '16px',
                  letterSpacing: '-0.03em',
                }}
              >
                {opportunity.objectRaw}
              </h1>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '16px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={15} color="var(--brand-cyan)" />
                  <span style={{ fontWeight: 700, color: '#FFFFFF' }}>
                    {opportunity.organizationName}
                  </span>
                </div>
                <span>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={15} color="var(--brand-primary)" />
                  <span>
                    {opportunity.municipalityName} - {opportunity.uf}
                  </span>
                </div>
                <span>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>CNPJ:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatCNPJ(opportunity.organizationCnpj)}
                  </span>
                </div>
                <span>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {isTceSource(opportunity.source) ? 'TCE-CE:' : 'PNCP:'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {opportunity.sourceExternalId}
                  </span>
                  <button
                    onClick={() => copyToClipboard(opportunity.sourceExternalId)}
                    title="Copiar número de controle"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copied ? 'var(--brand-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* 2-Column Bento Info Layout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '20px',
                marginBottom: '24px',
              }}
            >
              {/* Card 1: Valores & Detalhes */}
              <div className="wishlabs-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <DollarSign size={18} color="var(--brand-primary)" />
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                    Valores & Detalhes da Contratação
                  </h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div
                    style={{
                      backgroundColor: '#101012',
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Valor Total Estimado
                    </span>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '26px',
                        fontWeight: 900,
                        color: '#FFFFFF',
                        marginTop: '4px',
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {opportunity.valueStatus === 'KNOWN'
                        ? formatCurrency(opportunity.estimatedTotalValue)
                        : opportunity.valueStatus === 'VALUE_CONFIDENTIAL'
                        ? 'Orçamento Sigiloso'
                        : 'Não divulgado'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Status de valor: <strong>{opportunity.valueStatus}</strong> (Fonte: {isTceSource(opportunity.source) ? 'TCE-CE' : 'PNCP'})
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                        Modalidade
                      </span>
                      <strong style={{ color: '#FFFFFF' }}>
                        {opportunity.modalityName || '—'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                        Modo de Disputa
                      </span>
                      <strong style={{ color: '#FFFFFF' }}>
                        {opportunity.disputeModeName || '—'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                        Número da Compra
                      </span>
                      <strong style={{ color: '#FFFFFF' }}>
                        {opportunity.purchaseNumber || '—'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                        Ano da Compra
                      </span>
                      <strong style={{ color: '#FFFFFF' }}>
                        {opportunity.purchaseYear || '—'}
                      </strong>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                      Unidade Compradora
                    </span>
                    <strong style={{ color: '#FFFFFF' }}>
                      {opportunity.unitName || opportunity.organizationName}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Cronograma */}
              <div className="wishlabs-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <Calendar size={18} color="var(--status-review)" />
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                    Cronograma de Propostas
                  </h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
                  <div
                    style={{
                      backgroundColor: 'var(--status-urgent-bg)',
                      border: '1px solid var(--status-urgent-border)',
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <span style={{ fontSize: '11.5px', color: 'var(--status-urgent)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Encerramento do Recebimento de Propostas
                    </span>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '20px',
                        fontWeight: 900,
                        color: '#FFFFFF',
                        marginTop: '4px',
                      }}
                    >
                      {formatDateTime(opportunity.proposalEndAt)}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <UrgencyBadge deadlineIso={opportunity.proposalEndAt} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                        Início do Recebimento
                      </span>
                      <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                        {formatDateTime(opportunity.proposalStartAt)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                        {isTceSource(opportunity.source) ? 'Publicação no TCE-CE' : 'Publicação no PNCP'}
                      </span>
                      <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                        {formatDateTime(opportunity.publishedAt)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                        {isTceSource(opportunity.source) ? 'Última Atualização TCE-CE' : 'Última Atualização PNCP'}
                      </span>
                      <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                        {formatDateTime(opportunity.sourceUpdatedAt)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                        Última Captura pelo Radar
                      </span>
                      <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                        {formatDateTime(opportunity.lastSeenAt)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Origem & Documentos do Edital */}
            <div className="wishlabs-card" style={{ padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={18} color="var(--brand-primary)" />
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                    {isTceSource(opportunity.source) ? 'Documentos de origem (TCE-CE)' : 'Plataforma de Origem & Contratação Pai'}
                  </h2>
                </div>
                {isLoadingOrigin && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--brand-primary)' }}>
                    <RefreshCw className="animate-spin" size={12} />
                    <span>Descobrindo origens...</span>
                  </div>
                )}
              </div>

              {isTceSource(opportunity.source) && (
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  O portal TCE-CE pede captcha no download. Abra o processo no navegador, baixe o edital e envie depois no Analista de Editais.
                </p>
              )}

              {originDetail && (
                <div style={{ marginBottom: originDetail.documents?.length ? '16px' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Sistema Emissor:
                    </span>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        backgroundColor: `${originDetail.primaryPlatform.badgeColor}20`,
                        color: originDetail.primaryPlatform.badgeColor,
                        border: `1px solid ${originDetail.primaryPlatform.badgeColor}40`,
                      }}
                    >
                      {originDetail.primaryPlatform.platformName}
                    </span>
                    {originDetail.processo && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Proc: {originDetail.processo}
                      </span>
                    )}
                  </div>

                  {originDetail.availablePlatforms.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {originDetail.availablePlatforms.map((plat) => (
                        <a
                          key={plat.platformCode}
                          href={plat.directSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            textDecoration: 'none',
                          }}
                        >
                          <ExternalLink size={12} color={plat.badgeColor} />
                          <span>{plat.platformName} (CE)</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {originDetail && originDetail.documents && originDetail.documents.length > 0 && (
                <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                    Documentos Oficiais Anexados ({originDetail.documents.length}):
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {originDetail.documents.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <FileText size={14} color="var(--brand-primary)" />
                          <span style={{ color: '#FFFFFF', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.title}
                          </span>
                          {doc.docType && (
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                              {doc.docType}
                            </span>
                          )}
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={isTceSource(opportunity.source) ? 'Abrir no portal' : 'Baixar Documento'}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            textDecoration: 'none',
                          }}
                        >
                          {isTceSource(opportunity.source) ? <ExternalLink size={12} /> : <Download size={12} />}
                          <span>{isTceSource(opportunity.source) ? 'Abrir' : 'Baixar'}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Card 3: Auditoria do Classificador */}
            <div className="wishlabs-card" style={{ padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="var(--brand-primary)" />
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                    Trilha de Auditoria do Classificador
                  </h2>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Versão: <strong>{opportunity.classifierVersion}</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                    Classificação Determinística:
                  </span>
                  <BadgeClassification
                    classification={opportunity.classification}
                    score={opportunity.classificationScore}
                    terms={opportunity.classificationTerms}
                    showTerms={true}
                  />
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                    Texto Normalizado Inspecionado:
                  </span>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      backgroundColor: '#101012',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      maxHeight: '100px',
                      overflowY: 'auto',
                    }}
                  >
                    {opportunity.objectNormalized}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Payload Bruto & Evidências */}
            <div className="wishlabs-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={18} color="var(--brand-cyan)" />
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                    Snapshot do Payload Bruto (Evidência ADR-004)
                  </h2>
                </div>
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  {showRawJson ? 'Ocultar JSON' : 'Inspecionar JSON'}
                </button>
              </div>

              {showRawJson && (
                <div style={{ marginTop: '16px' }}>
                  {snapshots.length > 0 ? (
                    snapshots.map((s) => (
                      <div key={s.id} style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          Tipo: {s.resourceType} • Hash SHA256:{' '}
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{s.payloadHash}</span> • Captura:{' '}
                          {formatDateTime(s.createdAt)}
                        </div>
                        <pre
                          style={{
                            backgroundColor: '#101012',
                            padding: '16px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '11.5px',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--brand-cyan)',
                            border: '1px solid var(--border-subtle)',
                            overflowX: 'auto',
                            maxHeight: '320px',
                          }}
                        >
                          {JSON.stringify(JSON.parse(s.rawJson), null, 2)}
                        </pre>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      Nenhum snapshot bruto persistido para esta oportunidade.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
