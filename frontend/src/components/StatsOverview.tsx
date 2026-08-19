'use client';

import React from 'react';
import { StatsOverviewData } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { Layers, Check, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

interface Props {
  stats: StatsOverviewData | null;
  loading?: boolean;
  onSelectCategory?: (category: 'ALL' | 'IN_SCOPE' | 'REVIEW' | 'URGENT') => void;
}

export const StatsOverview: React.FC<Props> = ({
  stats,
  loading = false,
  onSelectCategory,
}) => {
  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div style={{ gridColumn: 'span 5', height: '140px' }} className="wishlabs-card shimmer-box" />
        <div style={{ gridColumn: 'span 3', height: '140px' }} className="wishlabs-card shimmer-box" />
        <div style={{ gridColumn: 'span 2', height: '140px' }} className="wishlabs-card shimmer-box" />
        <div style={{ gridColumn: 'span 2', height: '140px' }} className="wishlabs-card shimmer-box" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '16px',
        marginBottom: '32px',
      }}
    >
      {/* Bento Card 1: Pipeline BRL Featured (Col 1-5) */}
      <div
        onClick={() => onSelectCategory && onSelectCategory('ALL')}
        className="wishlabs-card wishlabs-card-interactive"
        style={{
          gridColumn: 'span 5',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            backgroundColor: 'rgba(192, 255, 115, 0.08)',
            filter: 'blur(32px)',
            pointerEvents: 'none',
          }}
        />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Volume Total em Aberto
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--brand-primary-bg)',
                color: 'var(--brand-primary)',
              }}
            >
              PIPELINE CE
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '28px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCurrency(stats.totalEstimatedValue)}
          </div>
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
            marginTop: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{stats.totalOpportunities} oportunidades ativas</span>
          <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>≥ R$ 900k</span>
        </div>
      </div>

      {/* Bento Card 2: Escopo Direto (Col 6-8) */}
      <div
        onClick={() => onSelectCategory && onSelectCategory('IN_SCOPE')}
        className="wishlabs-card wishlabs-card-interactive"
        style={{
          gridColumn: 'span 3',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Escopo Construmar
            </span>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: 'var(--brand-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-primary)',
              }}
            >
              <Check size={16} />
            </div>
          </div>
          <div
            style={{
              fontSize: '34px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.04em',
            }}
          >
            {stats.totalInScope}
          </div>
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--brand-primary)', fontWeight: 600 }}>
          Alta aderência técnica
        </div>
      </div>

      {/* Bento Card 3: Revisão Técnica (Col 9-10) */}
      <div
        onClick={() => onSelectCategory && onSelectCategory('REVIEW')}
        className="wishlabs-card wishlabs-card-interactive"
        style={{
          gridColumn: 'span 2',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Revisão</span>
            <AlertTriangle size={16} color="var(--status-review)" />
          </div>
          <div
            style={{
              fontSize: '34px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.04em',
            }}
          >
            {stats.totalReview}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--status-review)', fontWeight: 600 }}>
          Análise necessária
        </div>
      </div>

      {/* Bento Card 4: Urgentes (Col 11-12) */}
      <div
        onClick={() => onSelectCategory && onSelectCategory('URGENT')}
        className="wishlabs-card wishlabs-card-interactive"
        style={{
          gridColumn: 'span 2',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Críticos</span>
            <Clock size={16} color="var(--status-urgent)" />
          </div>
          <div
            style={{
              fontSize: '34px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.04em',
            }}
          >
            {stats.totalUrgent}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--status-urgent)', fontWeight: 600 }}>
          Encerram em ≤ 72h
        </div>
      </div>
    </div>
  );
};
