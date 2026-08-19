import React from 'react';
import { ClassificationType } from '@/lib/types';
import { Check, AlertTriangle, X } from 'lucide-react';

interface Props {
  classification: ClassificationType;
  score?: number;
  terms?: string[];
  showTerms?: boolean;
  onTermClick?: (term: string) => void;
}

export const BadgeClassification: React.FC<Props> = ({
  classification,
  score,
  terms = [],
  showTerms = false,
  onTermClick,
}) => {
  const isScope = classification === 'IN_SCOPE';
  const isReview = classification === 'REVIEW';

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: '11.5px',
    fontWeight: 800,
    letterSpacing: '0.02em',
    backgroundColor: isScope
      ? 'var(--status-inscope-bg)'
      : isReview
      ? 'var(--status-review-bg)'
      : 'rgba(255, 255, 255, 0.05)',
    color: isScope
      ? 'var(--status-inscope)'
      : isReview
      ? 'var(--status-review)'
      : 'var(--text-muted)',
    border: `1px solid ${
      isScope
        ? 'var(--status-inscope-border)'
        : isReview
        ? 'var(--status-review-border)'
        : 'var(--border-subtle)'
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
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: isScope ? 'var(--status-inscope)' : isReview ? 'var(--status-review)' : '#64748B',
          }}
        />
        <span>{label}</span>
        {score !== undefined && (
          <span style={{ opacity: 0.8, fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
            {score.toFixed(1)}
          </span>
        )}
      </span>

      {showTerms && terms.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '3px' }}>
          {terms.map((term, i) => {
            const isNegative = term.startsWith('!');
            return (
              <span
                key={i}
                role={onTermClick ? 'button' : undefined}
                tabIndex={onTermClick ? 0 : undefined}
                onClick={onTermClick ? () => onTermClick(term) : undefined}
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  backgroundColor: isNegative ? 'rgba(255, 129, 178, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  color: isNegative ? '#FF81B2' : '#A1A1AA',
                  border: `1px solid ${isNegative ? 'rgba(255, 129, 178, 0.25)' : 'var(--border-subtle)'}`,
                  cursor: onTermClick ? 'pointer' : 'default',
                }}
              >
                {term}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
