'use client';

import React from 'react';
import Link from 'next/link';
import { LicitacaoOportunidade } from '@/lib/types';
import { formatCurrency, formatDateTime, formatCNPJ } from '@/lib/formatters';
import { BadgeClassification } from './BadgeClassification';
import { UrgencyBadge } from './UrgencyBadge';
import { ExternalLink, ChevronRight, Eye, AlertCircle, FileText } from 'lucide-react';

interface Props {
  opportunities: LicitacaoOportunidade[];
  loading?: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (newPage: number) => void;
}

export const OpportunityTable: React.FC<Props> = ({
  opportunities,
  loading = false,
  page,
  totalPages,
  total,
  onPageChange,
}) => {
  if (loading) {
    return (
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '3rem',
          textAlign: 'center',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--brand-primary)',
              borderRadius: '50%',
            }}
            className="animate-spin"
          />
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Carregando oportunidades no radar...
          </p>
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '3.5rem 1.5rem',
          textAlign: 'center',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            color: 'var(--text-muted)',
          }}
        >
          <FileText size={24} />
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Nenhuma oportunidade encontrada
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto' }}>
          Não foram encontradas licitações abertas com os filtros atuais. Tente ajustar o valor mínimo,
          limpar os termos de busca ou mudar a classificação para &quot;Radar Ativo&quot;.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      {/* Table Container */}
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
                backgroundColor: 'var(--bg-surface-elevated)',
                borderBottom: '1px solid var(--border-strong)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <th style={{ padding: '12px 16px', width: '35%' }}>Objeto / Órgão</th>
              <th style={{ padding: '12px 16px', width: '15%' }}>Local / Modalidade</th>
              <th style={{ padding: '12px 16px', width: '15%' }}>Valor Estimado</th>
              <th style={{ padding: '12px 16px', width: '15%' }}>Prazo de Propostas</th>
              <th style={{ padding: '12px 16px', width: '12%' }}>Classificação</th>
              <th style={{ padding: '12px 16px', width: '8%', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((opp) => (
              <tr
                key={opp.id}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {/* Objeto & Organ */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <Link
                    href={`/licitacoes/${opp.id}`}
                    style={{
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      marginBottom: '6px',
                    }}
                  >
                    {opp.objectRaw}
                  </Link>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: 600, color: '#93c5fd' }}>
                      {opp.organizationName}
                    </span>
                    <span>•</span>
                    <span>CNPJ: {formatCNPJ(opp.organizationCnpj)}</span>
                    <span>•</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{opp.sourceExternalId}</span>
                  </div>
                </td>

                {/* Local & Modalidade */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {opp.municipalityName} - {opp.uf}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {opp.modalityName || 'Não informada'}
                  </div>
                  {opp.disputeModeName && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Modo: {opp.disputeModeName}
                    </div>
                  )}
                </td>

                {/* Valor Estimado */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  {opp.valueStatus === 'KNOWN' ? (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#34d399' }}>
                        {formatCurrency(opp.estimatedTotalValue)}
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Valor Total Estimado
                      </span>
                    </div>
                  ) : opp.valueStatus === 'VALUE_CONFIDENTIAL' ? (
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 6px',
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
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <UrgencyBadge deadlineIso={opp.proposalEndAt} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Término: {formatDateTime(opp.proposalEndAt)}
                  </div>
                  {opp.proposalStartAt && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Início: {formatDateTime(opp.proposalStartAt)}
                    </div>
                  )}
                </td>

                {/* Classificação */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                  <BadgeClassification
                    classification={opp.classification}
                    score={opp.classificationScore}
                    terms={opp.classificationTerms}
                    showTerms={true}
                  />
                </td>

                {/* Ações */}
                <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                    <Link
                      href={`/licitacoes/${opp.id}`}
                      title="Ver detalhes completos"
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        color: 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <Eye size={15} />
                    </Link>
                    <a
                      href={opp.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir processo original no PNCP"
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--brand-primary-subtle)',
                        color: 'var(--brand-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                      }}
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-elevated)',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        <div>
          Mostrando{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {opportunities.length}
          </strong>{' '}
          de <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> oportunidades
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            Anterior
          </button>
          <span>
            Página <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> de{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{Math.max(1, totalPages)}</strong>
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
};
