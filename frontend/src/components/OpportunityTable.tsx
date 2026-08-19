'use client';

import React from 'react';
import Link from 'next/link';
import { LicitacaoOportunidade } from '@/lib/types';
import { formatCurrency, formatDateTime, formatCNPJ } from '@/lib/formatters';
import { BadgeClassification } from './BadgeClassification';
import { UrgencyBadge } from './UrgencyBadge';
import { ExternalLink, Eye, FileText, Building2, MapPin, Sparkles, ChevronRight, Calendar, Layers } from 'lucide-react';

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
        className="glass-panel"
        style={{
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid var(--border-subtle)', borderTopColor: 'var(--brand-orange)' }} className="animate-spin" />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Varrendo e classificando oportunidades no PNCP...
          </span>
        </div>

        {/* Shimmer Skeleton Rows */}
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            style={{
              padding: '16px',
              backgroundColor: 'rgba(21, 34, 56, 0.4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ height: '18px', width: `${65 + (idx % 3) * 15}%` }} className="shimmer-box" />
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ height: '14px', width: '180px' }} className="shimmer-box" />
              <div style={{ height: '14px', width: '120px' }} className="shimmer-box" />
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
        className="glass-panel"
        style={{
          borderRadius: 'var(--radius-lg)',
          padding: '4.5rem 1.5rem',
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(242, 100, 25, 0.1)',
            border: '1px solid rgba(242, 100, 25, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.2rem',
            color: 'var(--brand-orange)',
          }}
        >
          <FileText size={26} />
        </div>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Nenhuma oportunidade encontrada no radar
        </h3>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto', lineHeight: 1.5 }}>
          Não foram encontradas licitações abertas com os filtros aplicados. Tente ajustar o valor mínimo estimado ou mudar para a aba <strong>&quot;Radar Ativo&quot;</strong>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {viewMode === 'cards' ? (
        /* Cards Cockpit View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.2rem' }}>
          {opportunities.map((opp) => {
            const isInScope = opp.classification === 'IN_SCOPE';
            return (
              <div
                key={opp.id}
                onClick={() => onSelectOpportunity && onSelectOpportunity(opp)}
                className="saas-card saas-card-interactive"
                style={{
                  padding: '1.4rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  borderLeft: `4px solid ${isInScope ? '#10B981' : '#F59E0B'}`,
                }}
              >
                {/* Card Top: Badges & Price */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Valor Estimado
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '20px',
                        fontWeight: 800,
                        color: '#10B981',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {opp.valueStatus === 'KNOWN'
                        ? formatCurrency(opp.estimatedTotalValue)
                        : opp.valueStatus === 'VALUE_CONFIDENTIAL'
                        ? 'Orçamento Sigiloso'
                        : 'Valor não divulgado'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <BadgeClassification
                      classification={opp.classification}
                      score={opp.classificationScore}
                    />
                    <UrgencyBadge deadlineIso={opp.proposalEndAt} />
                  </div>
                </div>

                {/* Card Middle: Title */}
                <div>
                  <h4
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '14.5px',
                      fontWeight: 700,
                      color: '#F8FAFC',
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      marginBottom: '8px',
                    }}
                  >
                    {opp.objectRaw}
                  </h4>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand-cyan)' }}>
                      <Building2 size={13} />
                      {opp.organizationName}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} color="var(--brand-orange)" />
                      {opp.municipalityName} - {opp.uf}
                    </span>
                  </div>
                </div>

                {/* Card Terms & Action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '70%' }}>
                    {opp.classificationTerms?.slice(0, 3).map((term) => (
                      <span
                        key={term}
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-muted)',
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
                    style={{ padding: '5px 10px', fontSize: '12px' }}
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
        /* Dense Technical Table View */
        <div
          className="glass-panel"
          style={{
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: 'rgba(21, 34, 56, 0.85)',
                    borderBottom: '1px solid var(--border-strong)',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <th style={{ padding: '14px 18px', width: '38%' }}>Objeto / Órgão Licitante</th>
                  <th style={{ padding: '14px 18px', width: '15%' }}>Local & Modalidade</th>
                  <th style={{ padding: '14px 18px', width: '15%' }}>Valor Estimado</th>
                  <th style={{ padding: '14px 18px', width: '14%' }}>Prazo de Propostas</th>
                  <th style={{ padding: '14px 18px', width: '10%' }}>Classificação</th>
                  <th style={{ padding: '14px 18px', width: '8%', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr
                    key={opp.id}
                    onClick={() => onSelectOpportunity && onSelectOpportunity(opp)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Objeto & Organ */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '13.5px',
                          color: 'var(--text-primary)',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          marginBottom: '8px',
                        }}
                      >
                        {opp.objectRaw}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--brand-cyan)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={13} />
                          {opp.organizationName}
                        </span>
                        <span>•</span>
                        <span>CNPJ: {formatCNPJ(opp.organizationCnpj)}</span>
                        <span>•</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#CBD5E1' }}>{opp.sourceExternalId}</span>
                      </div>
                    </td>

                    {/* Local & Modalidade */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} color="var(--brand-orange)" />
                        {opp.municipalityName} - {opp.uf}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {opp.modalityName || 'Não informada'}
                      </div>
                    </td>

                    {/* Valor Estimado */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                      {opp.valueStatus === 'KNOWN' ? (
                        <div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '15px',
                              fontWeight: 800,
                              color: '#10B981',
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {formatCurrency(opp.estimatedTotalValue)}
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            Valor Estimado
                          </span>
                        </div>
                      ) : opp.valueStatus === 'VALUE_CONFIDENTIAL' ? (
                        <div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                            }}
                          >
                            Orçamento Sigiloso
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Valor não divulgado
                        </span>
                      )}
                    </td>

                    {/* Prazo */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                      <div style={{ marginBottom: '6px' }}>
                        <UrgencyBadge deadlineIso={opp.proposalEndAt} />
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {formatDateTime(opp.proposalEndAt)}
                      </div>
                    </td>

                    {/* Classificação */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                      <BadgeClassification
                        classification={opp.classification}
                        score={opp.classificationScore}
                        terms={opp.classificationTerms}
                        showTerms={true}
                        onTermClick={onTermClick}
                      />
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectOpportunity) onSelectOpportunity(opp);
                          }}
                          className="btn-secondary"
                          style={{ padding: '5px 8px', fontSize: '11.5px' }}
                          title="Inspecionar edital e proposta"
                        >
                          <Eye size={13} color="var(--brand-cyan)" />
                          <span>Ver</span>
                        </button>

                        <a
                          href={opp.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Abrir no PNCP"
                          style={{
                            padding: '6px 7px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            color: 'var(--text-secondary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <ExternalLink size={13} />
                        </a>
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
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        <div>
          Mostrando <strong style={{ color: 'var(--text-primary)' }}>{opportunities.length}</strong> de{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> oportunidades
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="btn-secondary"
            style={{ padding: '5px 12px', fontSize: '12px', opacity: page <= 1 ? 0.4 : 1 }}
          >
            Anterior
          </button>
          <span>
            Página <strong style={{ color: 'var(--brand-orange)' }}>{page}</strong> de{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{Math.max(1, totalPages)}</strong>
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="btn-secondary"
            style={{ padding: '5px 12px', fontSize: '12px', opacity: page >= totalPages ? 0.4 : 1 }}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
};
