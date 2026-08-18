'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RefreshCw, Radio, Layers, History, ShieldCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';

interface HeaderProps {
  lastSyncAt?: string | null;
  syncStatus?: string;
  isSyncing?: boolean;
  onTriggerSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lastSyncAt,
  syncStatus = 'UNKNOWN',
  isSyncing = false,
  onTriggerSync,
}) => {
  const pathname = usePathname();

  return (
    <header
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '70px',
          gap: '1rem',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-navy)',
                border: '1px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
              }}
            >
              <Radio size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                  }}
                >
                  CONSTRUMAR
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--brand-primary-subtle)',
                    color: 'var(--brand-primary)',
                    fontWeight: 700,
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  RADAR
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1 }}>
                Oportunidades PNCP • Ceará
              </p>
            </div>
          </Link>

          {/* Nav */}
          <nav style={{ display: 'none', gap: '0.5rem' }} className="md-nav">
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                color: pathname === '/' ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: pathname === '/' ? 'var(--bg-surface-elevated)' : 'transparent',
                border: `1px solid ${pathname === '/' ? 'var(--border-strong)' : 'transparent'}`,
              }}
            >
              <Layers size={15} />
              Oportunidades
            </Link>
            <Link
              href="/orcamentos"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                color: pathname.startsWith('/orcamentos') ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: pathname.startsWith('/orcamentos') ? 'var(--bg-surface-elevated)' : 'transparent',
                border: `1px solid ${pathname.startsWith('/orcamentos') ? 'rgba(242, 100, 25, 0.4)' : 'transparent'}`,
              }}
            >
              <span style={{ color: '#f26419', fontWeight: 800 }}>⚡</span>
              Orçamentos SEOBRA
            </Link>
            <Link
              href="/sync"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                color: pathname === '/sync' ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: pathname === '/sync' ? 'var(--bg-surface-elevated)' : 'transparent',
                border: `1px solid ${pathname === '/sync' ? 'var(--border-strong)' : 'transparent'}`,
              }}
            >
              <History size={15} />
              Histórico PNCP
            </Link>
          </nav>
        </div>

        {/* Actions & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Sync Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor:
                  syncStatus === 'SUCCESS'
                    ? '#10b981'
                    : syncStatus === 'RUNNING'
                    ? '#f59e0b'
                    : syncStatus === 'PARTIAL'
                    ? '#eab308'
                    : '#64748b',
              }}
            />
            <span>
              Última atualização:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {lastSyncAt ? formatDateTime(lastSyncAt) : 'Pendente'}
              </strong>
            </span>
          </div>

          {/* Sync Action Button */}
          {onTriggerSync && (
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--brand-primary)',
                color: '#090e17',
                border: 'none',
                fontWeight: 700,
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                opacity: isSyncing ? 0.7 : 1,
              }}
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar PNCP'}</span>
            </button>
          )}
        </div>
      </div>
      <style jsx>{`
        @media (min-width: 768px) {
          .md-nav {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
};
