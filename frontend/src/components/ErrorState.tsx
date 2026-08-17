import React from 'react';
import { AlertTriangle, RotateCcw, Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';

interface Props {
  message?: string;
  lastValidSyncAt?: string | null;
  onRetry: () => void;
}

export const ErrorState: React.FC<Props> = ({
  message = 'Não foi possível carregar os dados do radar de licitações.',
  lastValidSyncAt,
  onRetry,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '2rem 1.5rem',
        margin: '1.5rem 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f87171',
          marginBottom: '1rem',
        }}
      >
        <AlertTriangle size={22} />
      </div>

      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f87171', marginBottom: '6px' }}>
        Instabilidade na Consulta do Radar
      </h3>

      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '500px', marginBottom: '1.25rem' }}>
        {message}
      </p>

      {lastValidSyncAt && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '1.25rem',
            backgroundColor: 'var(--bg-surface)',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Clock size={13} />
          <span>
            Última sincronização válida preservada:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatDateTime(lastValidSyncAt)}
            </strong>
          </span>
        </div>
      )}

      <button
        onClick={onRetry}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 18px',
          backgroundColor: 'var(--brand-primary)',
          color: '#090e17',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <RotateCcw size={15} />
        Tentar Novamente
      </button>
    </div>
  );
};
