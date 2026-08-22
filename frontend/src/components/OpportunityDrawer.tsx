'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LicitacaoOportunidade,
  OpportunityOriginDetail,
  isTceSource,
  sourcePortalLabel,
} from '@/lib/types';
import { SourceBadge } from './SourceBadge';
import { formatCurrency, formatDateTime, formatCNPJ } from '@/lib/formatters';
import { fetchOpportunityOrigin, triggerDirectEditalAnalysis } from '@/lib/api';
import { BadgeClassification } from './BadgeClassification';
import { UrgencyBadge } from './UrgencyBadge';
import {
  X,
  ExternalLink,
  Building2,
  MapPin,
  Calendar,
  Sparkles,
  FileSearch,
  Download,
  FileText,
  RefreshCw,
  Globe,
  AlertCircle,
} from 'lucide-react';

interface Props {
  opportunity: LicitacaoOportunidade | null;
  onClose: () => void;
  onTermClick?: (term: string) => void;
}

export const OpportunityDrawer: React.FC<Props> = ({
  opportunity,
  onClose,
  onTermClick,
}) => {
  const router = useRouter();

  const [originDetail, setOriginDetail] = useState<OpportunityOriginDetail | null>(null);
  const [isLoadingOrigin, setIsLoadingOrigin] = useState<boolean>(false);
  const [originError, setOriginError] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const loadOrigin = useCallback(async (opportunityId: string) => {
    setIsLoadingOrigin(true);
    setOriginError(null);
    try {
      const data = await fetchOpportunityOrigin(opportunityId);
      setOriginDetail(data);
    } catch (err: unknown) {
      console.warn('Erro ao carregar plataforma de origem:', err);
      setOriginDetail(null);
      setOriginError(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível descobrir a plataforma de origem da licitação.'
      );
    } finally {
      setIsLoadingOrigin(false);
    }
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (opportunity) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';

      setAuditError(null);
      setOriginDetail(null);
      void loadOrigin(opportunity.id);
    } else {
      setOriginDetail(null);
      setIsAuditing(false);
      setOriginError(null);
      setAuditError(null);
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = 'unset';
    };
  }, [opportunity, onClose, loadOrigin]);

  if (!opportunity) return null;

  const handleDirectAudit = async (customDocUrl?: string) => {
    if (isTceSource(opportunity.source)) return;
    try {
      setIsAuditing(true);
      setAuditError(null);

      const targetDocUrl = customDocUrl || originDetail?.suggestedDocumentUrl;

      if (!targetDocUrl && (!originDetail?.documents || originDetail.documents.length === 0)) {
        router.push(`/editais?oportunidadeId=${opportunity.id}`);
        return;
      }

      const analysis = await triggerDirectEditalAnalysis(opportunity.id, targetDocUrl);
      onClose();
      router.push(`/editais/${analysis.id}`);
    } catch (err: any) {
      setAuditError(err.message || 'Falha ao baixar e analisar edital.');
    } finally {
      setIsAuditing(false);
    }
  };

  const fromTce = isTceSource(opportunity.source);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Slide-over Content */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '720px',
          height: '100vh',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-16px 0 50px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 101,
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SourceBadge source={opportunity.source} />
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {opportunity.sourceExternalId}
            </span>
            <UrgencyBadge deadlineIso={opportunity.proposalEndAt} />
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '50%',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Estimated Value Card */}
          <div
            className="wishlabs-card"
            style={{
              padding: '20px',
              backgroundColor: '#101012',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Valor Total Estimado da Licitação
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
                  : 'Valor não divulgado'}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <BadgeClassification
                classification={opportunity.classification}
                score={opportunity.classificationScore}
              />
            </div>
          </div>

          {/* Full Object Title */}
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '17px',
                fontWeight: 800,
                color: '#FFFFFF',
                lineHeight: 1.45,
                letterSpacing: '-0.02em',
              }}
            >
              {opportunity.objectRaw}
            </h2>
          </div>

          {/* Platform of Origin & Parent Contracting (API Reversa) */}
          <div
            style={{
              backgroundColor: '#101012',
              padding: '18px 20px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={16} color="var(--brand-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
                  {fromTce ? 'Documentos de origem (TCE-CE)' : 'Plataforma de Origem & Contratação Pai'}
                </span>
              </div>

              {isLoadingOrigin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--brand-primary)' }}>
                  <RefreshCw className="animate-spin" size={12} />
                  <span>Descobrindo origens...</span>
                </div>
              )}
            </div>

            {fromTce && (
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                O portal TCE-CE pede captcha no download. Abra o processo no navegador, baixe o edital e envie depois no Analista de Editais.
              </p>
            )}

            {originError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 129, 178, 0.15)',
                  border: '1px solid rgba(255, 129, 178, 0.3)',
                  color: '#FF81B2',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={14} />
                <span style={{ flex: 1 }}>{originError}</span>
                <button
                  type="button"
                  onClick={() => void loadOrigin(opportunity.id)}
                  disabled={isLoadingOrigin}
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {originDetail && (
              <div>
                {/* Primary Detected System Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
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

                {/* Reverse Links (Licitamais Brasil & BLL Compras) */}
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
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ExternalLink size={12} color={plat.badgeColor} />
                      <span>{plat.platformName} (CE)</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Official Attached Edital Documents from PNCP */}
            {originDetail && originDetail.documents && originDetail.documents.length > 0 && (
              <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
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
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                          {doc.docType}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Baixar Documento"
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
                          <Download size={12} />
                          <span>Baixar</span>
                        </a>

                        {!fromTce && (
                          <button
                            onClick={() => handleDirectAudit(doc.url)}
                            disabled={isAuditing}
                            title="Auditar este documento no Analista de Editais"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--brand-primary-bg)',
                              border: '1px solid var(--brand-primary-border)',
                              color: 'var(--brand-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <FileSearch size={12} />
                            <span>Auditar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Error Message */}
            {auditError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 129, 178, 0.15)',
                  border: '1px solid rgba(255, 129, 178, 0.3)',
                  color: '#FF81B2',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={14} />
                <span>{auditError}</span>
              </div>
            )}
          </div>

          {/* Key Facts Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '14px',
              backgroundColor: '#101012',
              padding: '20px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                Órgão Licitante
              </span>
              <strong style={{ fontSize: '13.5px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Building2 size={14} color="var(--brand-cyan)" />
                {opportunity.organizationName}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                CNPJ do Órgão
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {formatCNPJ(opportunity.organizationCnpj)}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                Localidade
              </span>
              <strong style={{ fontSize: '13.5px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin size={14} color="var(--brand-primary)" />
                {opportunity.municipalityName} - {opportunity.uf}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                Modalidade & Modo
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {opportunity.modalityName || 'Não informada'} ({opportunity.disputeModeName || 'Aberto'})
              </span>
            </div>
          </div>

          {/* AI Scopes & Evidence */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)' }} />
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#FFFFFF' }}>
                Termos Identificados pelo Classificador
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {opportunity.classificationTerms?.map((term) => (
                <button
                  key={term}
                  onClick={() => onTermClick && onTermClick(term)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                  }}
                >
                  #{term}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline & Schedule */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Calendar size={15} color="var(--text-secondary)" />
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#FFFFFF' }}>
                Cronograma da Licitação
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {opportunity.proposalStartAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#101012', borderRadius: '8px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Início de Propostas:</span>
                  <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    {formatDateTime(opportunity.proposalStartAt)}
                  </strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--status-urgent-bg)', border: '1px solid var(--status-urgent-border)', borderRadius: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>Término do Recebimento:</span>
                <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                  {formatDateTime(opportunity.proposalEndAt)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Action Footer with 1-Click Analista de Editais Button */}
        <div
          style={{
            padding: '18px 24px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {!fromTce && (
            <button
              onClick={() => handleDirectAudit()}
              disabled={isAuditing}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--brand-primary)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isAuditing ? 'default' : 'pointer',
                boxShadow: '0 4px 14px rgba(242, 100, 25, 0.3)',
                opacity: isAuditing ? 0.8 : 1,
              }}
            >
              {isAuditing ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>Auditor IA analisando edital e cláusulas...</span>
                </>
              ) : (
                <>
                  <FileSearch size={16} />
                  <span>Auditar no Analista de Editais (1-Clique)</span>
                </>
              )}
            </button>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <a
              href={opportunity.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ flex: 1, textDecoration: 'none', textAlign: 'center', justifyContent: 'center' }}
            >
              <ExternalLink size={14} />
              <span>{sourcePortalLabel(opportunity.source)}</span>
            </a>

            <a
              href={`/orcamentos?oportunidadeId=${opportunity.id}`}
              className="btn-secondary"
              style={{ flex: 1, textDecoration: 'none', textAlign: 'center', justifyContent: 'center' }}
            >
              <Sparkles size={14} color="var(--brand-primary)" />
              <span>Orçar SEOBRA</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
