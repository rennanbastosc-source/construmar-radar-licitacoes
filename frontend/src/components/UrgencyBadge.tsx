import React from 'react';
import { getDeadlineUrgency } from '@/lib/formatters';
import { Clock, AlertTriangle, Check, X } from 'lucide-react';

interface Props {
  deadlineIso?: string | null;
}

export const UrgencyBadge: React.FC<Props> = ({ deadlineIso }) => {
  const urgency = getDeadlineUrgency(deadlineIso);

  const getStyle = (): React.CSSProperties => {
    switch (urgency.level) {
      case 'critical':
        return {
          backgroundColor: 'var(--status-urgent-bg)',
          color: 'var(--status-urgent)',
          border: '1px solid var(--status-urgent-border)',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--status-review-bg)',
          color: 'var(--status-review)',
          border: '1px solid var(--status-review-border)',
        };
      case 'normal':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          color: '#A1A1AA',
          border: '1px solid var(--border-subtle)',
        };
      case 'expired':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border-subtle)',
        };
      default:
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
        };
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: '11.5px',
        fontWeight: 700,
        ...getStyle(),
      }}
    >
      {urgency.level === 'critical' && <AlertTriangle size={12} />}
      {urgency.level === 'warning' && <Clock size={12} />}
      {urgency.level === 'normal' && <Check size={12} />}
      {urgency.level === 'expired' && <X size={12} />}
      <span>{urgency.label}</span>
    </span>
  );
};
