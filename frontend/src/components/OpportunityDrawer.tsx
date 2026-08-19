'use client';

import React, { useEffect } from 'react';
import { LicitacaoOportunidade } from '@/lib/types';
import { formatCurrency, formatDateTime, formatCNPJ } from '@/lib/formatters';
import { BadgeClassification } from './BadgeClassification';
import { UrgencyBadge } from './UrgencyBadge';
import {
  X,
  ExternalLink,
  Building2,
  MapPin,
  Calendar,
  Sparkles,
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
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (opportunity) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = 'unset';
    };
  }, [opportunity, onClose]);

  if (!opportunity) return null;

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
          maxWidth: '680px',
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
                fontSize: '18px',
                fontWeight: 800,
                color: '#FFFFFF',
                lineHeight: 1.45,
                letterSpacing: '-0.02em',
              }}
            >
              {opportunity.objectRaw}
            </h2>
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

        {/* Drawer Action Footer */}
        <div
          style={{
            padding: '18px 24px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            display: 'flex',
            gap: '12px',
          }}
        >
          <a
            href={opportunity.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            <ExternalLink size={15} />
            <span>Processo no PNCP</span>
          </a>

          <a
            href="/orcamentos"
            className="btn-primary"
            style={{ flex: 1.5 }}
          >
            <Sparkles size={15} />
            <span>Orçar com IA SEOBRA</span>
          </a>
        </div>
      </div>
    </div>
  );
};
