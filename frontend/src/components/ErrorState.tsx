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
      className="wishlabs-card"
      style={{
        padding: '36px 24px',
        margin: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 129, 178, 0.15)',
          border: '1px solid rgba(255, 129, 178, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FF81B2',
          marginBottom: '16px',
        }}
      >
        <AlertTriangle size={22} />
      </div>

      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
        Instabilidade na Consulta do Radar
      </h3>

      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '500px', marginBottom: '20px' }}>
        {message}
      </p>

      {lastValidSyncAt && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
            backgroundColor: '#101012',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Clock size={13} color="var(--brand-primary)" />
          <span>
            Última sincronização válida preservada:{' '}
            <strong style={{ color: '#FFFFFF' }}>
              {formatDateTime(lastValidSyncAt)}
            </strong>
          </span>
        </div>
      )}

      <button onClick={onRetry} className="btn-primary">
        <RotateCcw size={14} />
        <span>Tentar Novamente</span>
      </button>
    </div>
  );
};
