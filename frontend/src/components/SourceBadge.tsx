import React from 'react';
import { resolveOpportunitySource } from '@/lib/types';

export const SourceBadge: React.FC<{ source?: string | null }> = ({ source }) => {
  const resolved = resolveOpportunitySource(source);
  const isTce = resolved === 'TCE-CE';

  return (
    <span
      title={
        isTce
          ? 'Portal TCE-CE — licitações de municípios do Ceará'
          : 'Portal Nacional de Contratações Públicas'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: '10px',
        fontWeight: 800,
        letterSpacing: '0.04em',
        fontFamily: 'var(--font-mono)',
        backgroundColor: isTce ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.05)',
        color: isTce ? 'var(--brand-cyan)' : 'var(--text-secondary)',
        border: `1px solid ${isTce ? 'rgba(56, 189, 248, 0.3)' : 'var(--border-subtle)'}`,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {resolved}
    </span>
  );
};
