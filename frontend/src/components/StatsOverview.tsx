import React from 'react';
import { StatsOverviewData } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { Layers, CheckCircle2, AlertCircle, DollarSign, Clock } from 'lucide-react';

interface Props {
  stats?: StatsOverviewData | null;
  loading?: boolean;
}

export const StatsOverview: React.FC<Props> = ({ stats, loading = false }) => {
  const cards = [
    {
      title: 'Oportunidades no Radar',
      value: stats?.totalOpportunities ?? 0,
      subtext: '>= R$ 900k no Ceará',
      icon: <Layers size={18} color="#60a5fa" />,
      border: 'var(--border-subtle)',
    },
    {
      title: 'Em Escopo Principal',
      value: stats?.totalInScope ?? 0,
      subtext: 'Obras & Engenharia',
      icon: <CheckCircle2 size={18} color="#34d399" />,
      border: 'rgba(16, 185, 129, 0.3)',
      highlight: '#34d399',
    },
    {
      title: 'Em Revisão Técnica',
      value: stats?.totalReview ?? 0,
      subtext: 'Sinais complementares',
      icon: <AlertCircle size={18} color="#fbbf24" />,
      border: 'rgba(245, 158, 11, 0.3)',
      highlight: '#fbbf24',
    },
    {
      title: 'Volume Estimado Total',
      value: formatCurrency(stats?.totalEstimatedValue ?? 0),
      subtext: 'Soma dos valores conhecidos',
      icon: <DollarSign size={18} color="#f59e0b" />,
      border: 'var(--border-subtle)',
      isCurrency: true,
    },
    {
      title: 'Vencimento Próximo',
      value: stats?.totalUrgent ?? 0,
      subtext: 'Encerra em até 3 dias',
      icon: <Clock size={18} color="#f87171" />,
      border: 'rgba(239, 68, 68, 0.3)',
      highlight: '#f87171',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        margin: '1.5rem 0',
      }}
    >
      {cards.map((c, i) => (
        <div
          key={i}
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            border: `1px solid ${c.border}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {c.title}
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {c.icon}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: c.isCurrency ? '1.35rem' : '1.75rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: c.highlight || 'var(--text-primary)',
                lineHeight: 1.2,
              }}
            >
              {loading ? (
                <div style={{ height: '30px', width: '80px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '4px' }} className="animate-pulse" />
              ) : (
                c.value
              )}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {c.subtext}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
