import React from 'react';
import { getDeadlineUrgency } from '@/lib/formatters';
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

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
          color: 'var(--status-urgent-text)',
          border: '1px solid var(--status-urgent-border)',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--status-review-bg)',
          color: 'var(--status-review-text)',
          border: '1px solid var(--status-review-border)',
        };
      case 'normal':
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          color: '#93c5fd',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        };
      case 'expired':
        return {
          backgroundColor: 'rgba(100, 116, 139, 0.15)',
          color: 'var(--text-muted)',
          border: '1px solid rgba(100, 116, 139, 0.3)',
        };
      default:
        return {
          backgroundColor: 'rgba(100, 116, 139, 0.1)',
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
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
        ...getStyle(),
      }}
    >
      {urgency.level === 'critical' && <AlertTriangle size={12} />}
      {urgency.level === 'warning' && <Clock size={12} />}
      {urgency.level === 'normal' && <CheckCircle size={12} />}
      {urgency.level === 'expired' && <XCircle size={12} />}
      {urgency.label}
    </span>
  );
};
