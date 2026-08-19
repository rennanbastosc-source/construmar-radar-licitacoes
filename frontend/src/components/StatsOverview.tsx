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
      <div className="grid-matrix" style={{ marginBottom: '32px' }}>
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} style={{ height: '140px' }} className="wishlabs-card shimmer-box" />
        ))}
      </div>
    );
  }

  const currentStats = stats || {
    totalOpportunities: 0,
    totalEstimatedValue: 0,
    totalInScope: 0,
    totalReview: 0,
    totalUrgent: 0,
  };

  return (
    <div className="grid-matrix" style={{ marginBottom: '32px' }}>
      {/* Grid Card 1: Volume Total em Aberto */}
      <div
        onClick={() => onSelectCategory && onSelectCategory('ALL')}
        className="wishlabs-card wishlabs-card-interactive"
        style={{
          padding: '22px 24px',
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
            top: '-30px',
            right: '-30px',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            backgroundColor: 'rgba(192, 255, 115, 0.06)',
            filter: 'blur(28px)',
            pointerEvents: 'none',
          }}
        />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Volume Total em Aberto
            </span>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--brand-primary-bg)',
                color: 'var(--brand-primary)',
                letterSpacing: '0.03em',
              }}
            >
              PIPELINE CE
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '24px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCurrency(currentStats.totalEstimatedValue)}
          </div>
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)',
            marginTop: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{currentStats.totalOpportunities} ativas</span>
          <span style={{ color: 'var(--brand-primary)', fontWeight: 700, fontSize: '11px' }}>≥ R$ 900k</span>
        </div>
      </div>

      {/* Grid Card 2: Escopo Construmar */}
      <div
        onClick={() => onSelectCategory && onSelectCategory('IN_SCOPE')}
        className="wishlabs-card wishlabs-card-interactive"
        style={{
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Escopo Construmar
            </span>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                backgroundColor: 'var(--brand-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-primary)',
              }}
            >
              <Check size={14} />
            </div>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '32px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.04em',
            }}
          >
            {currentStats.totalInScope}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--brand-primary)', fontWeight: 600, paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          Alta aderência técnica
        </div>
      </div>

      {/* Grid Card 3: Revisão Técnica */}
      <div
        onClick={() => onSelectCategory && onSelectCategory('REVIEW')}
        className="wishlabs-card wishlabs-card-interactive"
        style={{
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Revisão Técnica
            </span>
            <AlertTriangle size={15} color="var(--status-review)" />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '32px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.04em',
            }}
          >
            {currentStats.totalReview}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--status-review)', fontWeight: 600, paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          Análise necessária
        </div>
      </div>

      {/* Grid Card 4: Críticos <= 72h */}
      <div
        onClick={() => onSelectCategory && onSelectCategory('URGENT')}
        className="wishlabs-card wishlabs-card-interactive"
        style={{
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Críticos ≤ 72h
            </span>
            <Clock size={15} color="var(--status-urgent)" />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '32px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.04em',
            }}
          >
            {currentStats.totalUrgent}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--status-urgent)', fontWeight: 600, paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          Encerramento próximo
        </div>
      </div>
    </div>
  );
};
