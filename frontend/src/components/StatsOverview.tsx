'use client';

import React from 'react';
import { StatsOverviewData } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { Layers, CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

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
  if (loading || !stats) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.8rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="saas-card" style={{ padding: '1.25rem', height: '110px' }}>
            <div style={{ height: '14px', width: '60%', marginBottom: '12px' }} className="shimmer-box" />
            <div style={{ height: '28px', width: '45%', marginBottom: '8px' }} className="shimmer-box" />
            <div style={{ height: '10px', width: '80%' }} className="shimmer-box" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      id: 'ALL',
      title: 'Total no Radar CE',
      value: stats.totalOpportunities.toString(),
      subtext: '>= R$ 900k no Ceará',
      badge: 'ATIVAS',
      badgeColor: '#0EA5E9',
      badgeBg: 'rgba(14, 165, 233, 0.12)',
      icon: Layers,
      iconColor: '#0EA5E9',
      glowColor: 'rgba(14, 165, 233, 0.15)',
    },
    {
      id: 'IN_SCOPE',
      title: 'Escopo CONSTRUMAR',
      value: stats.totalInScope.toString(),
      subtext: 'Obras, Locação & Infra',
      badge: 'ALTA ADERÊNCIA',
      badgeColor: '#10B981',
      badgeBg: 'rgba(16, 185, 129, 0.12)',
      icon: CheckCircle,
      iconColor: '#10B981',
      glowColor: 'rgba(16, 185, 129, 0.15)',
    },
    {
      id: 'REVIEW',
      title: 'Revisão Técnica',
      value: stats.totalReview.toString(),
      subtext: 'Termos complementares',
      badge: 'ANÁLISE',
      badgeColor: '#F59E0B',
      badgeBg: 'rgba(245, 158, 11, 0.12)',
      icon: AlertTriangle,
      iconColor: '#F59E0B',
      glowColor: 'rgba(245, 158, 11, 0.15)',
    },
    {
      id: 'VALUE',
      title: 'Volume Estimado',
      value: formatCurrency(stats.totalEstimatedValue),
      subtext: 'Soma dos editais abertos',
      badge: 'PIPELINE BRL',
      badgeColor: '#F26419',
      badgeBg: 'rgba(242, 100, 25, 0.12)',
      icon: TrendingUp,
      iconColor: '#F26419',
      glowColor: 'rgba(242, 100, 25, 0.15)',
      isCurrency: true,
    },
    {
      id: 'URGENT',
      title: 'Vencimento Crítico',
      value: stats.totalUrgent.toString(),
      subtext: 'Encerra em até 72h',
      badge: 'PRAZO CURTO',
      badgeColor: '#EF4444',
      badgeBg: 'rgba(239, 68, 68, 0.12)',
      icon: Clock,
      iconColor: '#EF4444',
      glowColor: 'rgba(239, 68, 68, 0.15)',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.8rem',
      }}
    >
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.id}
            onClick={() => onSelectCategory && c.id !== 'VALUE' && onSelectCategory(c.id as any)}
            className="saas-card saas-card-interactive"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              minHeight: '120px',
            }}
          >
            {/* Top Row: Title + Icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.01em',
                }}
              >
                {c.title}
              </span>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: c.iconColor,
                }}
              >
                <Icon size={15} />
              </div>
            </div>

            {/* Value */}
            <div
              style={{
                fontFamily: c.isCurrency ? 'var(--font-mono)' : 'var(--font-heading)',
                fontSize: c.isCurrency ? '20px' : '28px',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.03em',
                marginBottom: '0.5rem',
                lineHeight: 1.2,
              }}
            >
              {c.value}
            </div>

            {/* Bottom Row: Subtext + Tag */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {c.subtext}
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: c.badgeBg,
                  color: c.badgeColor,
                  border: `1px solid ${c.badgeColor}33`,
                  letterSpacing: '0.04em',
                }}
              >
                {c.badge}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
