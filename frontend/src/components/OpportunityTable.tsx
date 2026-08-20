'use client';

import React from 'react';
import { LicitacaoOportunidade } from '@/lib/types';
import { formatCurrency, formatDateTime, formatCNPJ } from '@/lib/formatters';
import { BadgeClassification } from './BadgeClassification';
import { UrgencyBadge } from './UrgencyBadge';
import { FileText, Building2, MapPin, ChevronRight } from 'lucide-react';
import { SourceBadge } from './SourceBadge';

interface Props {
  opportunities: LicitacaoOportunidade[];
  loading?: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (newPage: number) => void;
  onTermClick?: (term: string) => void;
  onSelectOpportunity?: (opp: LicitacaoOportunidade) => void;
  viewMode?: 'table' | 'cards';
}

export const OpportunityTable: React.FC<Props> = ({
  opportunities,
  loading = false,
  page,
  totalPages,
  total,
  onPageChange,
  onTermClick,
  onSelectOpportunity,
  viewMode = 'table',
}) => {
  if (loading) {
    return (
      <div
        className="wishlabs-card"
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: '2px solid var(--border-subtle)',
              borderTopColor: 'var(--brand-primary)',
            }}
            className="animate-spin"
          />
          <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Varrendo e classificando oportunidades no Ceará...
          </span>
        </div>

        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            style={{
              padding: '18px',
              backgroundColor: '#101012',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ height: '20px', width: `${60 + (idx % 3) * 15}%` }} className="shimmer-box" />
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ height: '14px', width: '180px' }} className="shimmer-box" />
              <div style={{ height: '14px', width: '140px' }} className="shimmer-box" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div
        className="wishlabs-card"
        style={{
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--brand-primary-bg)',
            border: '1px solid var(--brand-primary-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--brand-primary)',
          }}
        >
          <FileText size={24} />
        </div>
        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '20px',
            fontWeight: 800,
            color: '#FFFFFF',
            marginBottom: '8px',
          }}
        >
          Nenhuma oportunidade encontrada no radar
        </h3>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            maxWidth: '460px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          Não foram encontradas licitações abertas com os filtros aplicados. Tente ajustar o valor mínimo estimado ou
          remover filtros de município.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {viewMode === 'cards' ? (
        /* Bento Cards Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
          {opportunities.map((opp) => {
            const isInScope = opp.classification === 'IN_SCOPE';
            return (
              <div
                key={opp.id}
                onClick={() => onSelectOpportunity && onSelectOpportunity(opp)}
                className="wishlabs-card wishlabs-card-interactive"
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                {/* Top Row: Price & Classification */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Valor Estimado
                    </span>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '22px',
                        fontWeight: 900,
                        color: '#FFFFFF',
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {opp.valueStatus === 'KNOWN'
                        ? formatCurrency(opp.estimatedTotalValue)
                        : opp.valueStatus === 'VALUE_CONFIDENTIAL'
                        ? 'Orçamento Sigiloso'
                        : 'Não divulgado'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <SourceBadge source={opp.source} />
                    <BadgeClassification classification={opp.classification} score={opp.classificationScore} />
                    <UrgencyBadge deadlineIso={opp.proposalEndAt} />
                  </div>
                </div>

                {/* Middle: Title & Metadata */}
                <div>
                  <h4
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      marginBottom: '10px',
                    }}
                  >
                    {opp.objectRaw}
                  </h4>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand-cyan)' }}>
                      <Building2 size={13} />
                      {opp.organizationName}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} color="var(--brand-primary)" />
                      {opp.municipalityName} - {opp.uf}
                    </span>
                  </div>
                </div>

                {/* Bottom Terms & Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '14px',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '70%' }}>
                    {opp.classificationTerms?.slice(0, 3).map((term) => (
                      <span
                        key={term}
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: '#A1A1AA',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {term}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectOpportunity) onSelectOpportunity(opp);
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    <span>Inspecionar</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Spacious High-Contrast Table View */
        <div className="wishlabs-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13.5px',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <th style={{ padding: '16px 24px', width: '38%' }}>Objeto / Órgão Licitante</th>
                  <th style={{ padding: '16px 20px', width: '16%' }}>Município & Modalidade</th>
                  <th style={{ padding: '16px 20px', width: '16%', textAlign: 'right' }}>Valor Estimado</th>
                  <th style={{ padding: '16px 20px', width: '14%' }}>Classificação</th>
                  <th style={{ padding: '16px 24px', width: '16%', textAlign: 'right' }}>Prazo & Ação</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr
                    key={opp.id}
                    onClick={() => onSelectOpportunity && onSelectOpportunity(opp)}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background-color 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Objeto & Organ */}
                    <td style={{ padding: '20px 24px', verticalAlign: 'middle' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '14px',
                          color: '#FFFFFF',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          marginBottom: '6px',
                        }}
                      >
                        {opp.objectRaw}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <SourceBadge source={opp.source} />
                        <span style={{ fontWeight: 600, color: 'var(--brand-cyan)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={13} />
                          {opp.organizationName}
                        </span>
                        <span>•</span>
                        <span>CNPJ: {formatCNPJ(opp.organizationCnpj)}</span>
                      </div>
                    </td>

                    {/* Local & Modalidade */}
                    <td style={{ padding: '20px 20px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 700, color: '#FFFFFF', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} color="var(--brand-primary)" />
                        {opp.municipalityName} - {opp.uf}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {opp.modalityName || 'Não informada'}
                      </div>
                    </td>

                    {/* Valor Estimado */}
                    <td style={{ padding: '20px 20px', verticalAlign: 'middle', textAlign: 'right' }}>
                      {opp.valueStatus === 'KNOWN' ? (
                        <div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '15px',
                              fontWeight: 900,
                              color: '#FFFFFF',
                              letterSpacing: '-0.02em',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatCurrency(opp.estimatedTotalValue)}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Valor Estimado
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Sigiloso / Não divulgado
                        </span>
                      )}
                    </td>

                    {/* Classificação */}
                    <td style={{ padding: '20px 20px', verticalAlign: 'middle' }}>
                      <BadgeClassification
                        classification={opp.classification}
                        score={opp.classificationScore}
                        terms={opp.classificationTerms}
                        showTerms={true}
                        onTermClick={onTermClick}
                      />
                    </td>

                    {/* Prazo & Ação */}
                    <td style={{ padding: '20px 24px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <UrgencyBadge deadlineIso={opp.proposalEndAt} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectOpportunity) onSelectOpportunity(opp);
                          }}
                          className="btn-secondary"
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                        >
                          <span>Inspecionar</span>
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      <div
        className="wishlabs-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        <div>
          Mostrando <strong style={{ color: '#FFFFFF' }}>{opportunities.length}</strong> de{' '}
          <strong style={{ color: '#FFFFFF' }}>{total}</strong> oportunidades
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: '12px', opacity: page <= 1 ? 0.4 : 1 }}
          >
            Anterior
          </button>
          <span>
            Página <strong style={{ color: 'var(--brand-primary)' }}>{page}</strong> de{' '}
            <strong style={{ color: '#FFFFFF' }}>{Math.max(1, totalPages)}</strong>
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: '12px', opacity: page >= totalPages ? 0.4 : 1 }}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
};
