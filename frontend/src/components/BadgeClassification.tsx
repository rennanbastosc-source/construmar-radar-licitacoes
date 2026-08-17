import React from 'react';
import { ClassificationType } from '@/lib/types';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface Props {
  classification: ClassificationType;
  score?: number;
  terms?: string[];
  showTerms?: boolean;
}

export const BadgeClassification: React.FC<Props> = ({
  classification,
  score,
  terms = [],
  showTerms = false,
}) => {
  const isScope = classification === 'IN_SCOPE';
  const isReview = classification === 'REVIEW';

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    backgroundColor: isScope
      ? 'var(--status-inscope-bg)'
      : isReview
      ? 'var(--status-review-bg)'
      : 'rgba(100, 116, 139, 0.15)',
    color: isScope
      ? 'var(--status-inscope-text)'
      : isReview
      ? 'var(--status-review-text)'
      : 'var(--text-muted)',
    border: `1px solid ${
      isScope
        ? 'var(--status-inscope-border)'
        : isReview
        ? 'var(--status-review-border)'
        : 'rgba(100, 116, 139, 0.3)'
    }`,
  };

  const label = isScope
    ? 'EM ESCOPO'
    : isReview
    ? 'EM REVISÃO'
    : 'FORA DE ESCOPO';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      <span style={badgeStyle} title={`Score: ${score?.toFixed(1) || '0'} | Termos: ${terms.join(', ')}`}>
        {isScope && <CheckCircle2 size={13} />}
        {isReview && <AlertCircle size={13} />}
        {!isScope && !isReview && <XCircle size={13} />}
        {label}
        {score !== undefined && (
          <span style={{ opacity: 0.75, fontSize: '11px', marginLeft: '2px' }}>
            ({score.toFixed(1)})
          </span>
        )}
      </span>

      {showTerms && terms.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
          {terms.map((term, i) => (
            <span
              key={i}
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: term.startsWith('!')
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(59, 130, 246, 0.15)',
                color: term.startsWith('!') ? '#f87171' : '#93c5fd',
                border: `1px solid ${
                  term.startsWith('!') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'
                }`,
              }}
            >
              {term}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
