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
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
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
          borderLeft: '1px solid var(--border-strong)',
          boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 101,
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(21, 34, 56, 0.7)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                color: 'var(--brand-cyan)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
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
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Estimated Value Card */}
          <div
            className="saas-card"
            style={{
              padding: '1.25rem',
              backgroundColor: 'rgba(21, 34, 56, 0.6)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Valor Total Estimado da Licitação
              </span>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '24px',
                  fontWeight: 800,
                  color: '#10B981',
                  marginTop: '2px',
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
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
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
              gap: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              padding: '1.2rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                Órgão Licitante
              </span>
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
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
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin size={14} color="var(--brand-orange)" />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Sparkles size={15} color="var(--brand-orange)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Termos Identificados pelo Classificador IA
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {opportunity.classificationTerms?.map((term) => (
                <button
                  key={term}
                  onClick={() => onTermClick && onTermClick(term)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    border: '1px solid rgba(14, 165, 233, 0.25)',
                    color: 'var(--brand-cyan)',
                    fontSize: '11.5px',
                    fontWeight: 600,
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
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Cronograma de Licitação
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {opportunity.proposalStartAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Início de Propostas:</span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {formatDateTime(opportunity.proposalStartAt)}
                  </strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', fontSize: '12.5px' }}>
                <span style={{ color: '#F87171', fontWeight: 600 }}>Término do Recebimento:</span>
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
            padding: '1.25rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(14, 23, 38, 0.95)',
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
            <span>Orçar & Gerar Timbrado</span>
          </a>
        </div>
      </div>
    </div>
  );
};
