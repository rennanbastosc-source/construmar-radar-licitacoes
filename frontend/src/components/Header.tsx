'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RefreshCw, Radio, Sparkles, History, Layers } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { fetchPncpHealth } from '@/lib/api';
import type { PncpHealth } from '@/lib/types';

interface HeaderProps {
  lastSyncAt?: string | null;
  syncStatus?: string;
  isSyncing?: boolean;
  onTriggerSync?: () => void;
}

function PncpHealthBadge() {
  const [health, setHealth] = useState<PncpHealth | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchPncpHealth();
        if (!cancelled) {
          setHealth(data);
          setErrored(false);
        }
      } catch {
        if (!cancelled) {
          setHealth(null);
          setErrored(true);
        }
      }
    };

    load();
    const id = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const isUp = health?.status === 'UP';
  const label = health ? (isUp ? 'PNCP Ceará Ao Vivo' : 'PNCP Instável') : errored ? 'PNCP Offline' : 'Verificando...';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        fontSize: '12px',
        fontWeight: 700,
        color: isUp ? 'var(--brand-primary)' : '#F59E0B',
        padding: '6px 14px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: isUp ? 'var(--brand-primary-bg)' : 'rgba(245, 158, 11, 0.12)',
        border: `1px solid ${isUp ? 'var(--brand-primary-border)' : 'rgba(245, 158, 11, 0.3)'}`,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isUp ? 'var(--brand-primary)' : '#F59E0B',
          boxShadow: isUp ? '0 0 10px var(--brand-primary)' : 'none',
        }}
        className={isUp ? 'live-pulse' : ''}
      />
      <span>{label}</span>
    </div>
  );
}

export const Header: React.FC<HeaderProps> = ({
  lastSyncAt,
  syncStatus = 'UNKNOWN',
  isSyncing = false,
  onTriggerSync,
}) => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Radar de Oportunidades', icon: Radio },
    { href: '/orcamentos', label: 'Orçamentos IA', icon: Sparkles },
    { href: '/editais', label: 'Analista de Editais', icon: Layers, badge: 'PRO' },
    { href: '/sync', label: 'Histórico PNCP', icon: History },
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(14, 14, 16, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '72px',
          gap: '1.5rem',
        }}
      >
        {/* Brand Logo & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textDecoration: 'none',
            }}
          >
            {/* Wishlabs Volt Brand Icon */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                backgroundColor: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#0E0E10',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: '#C0FF73', fontSize: '11px', fontWeight: 900 }}>C</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '18px',
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                    color: '#FFFFFF',
                  }}
                >
                  CONSTRU<span style={{ color: 'var(--brand-primary)' }}>MAR</span>
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                }}
              >
                Radar & Orçamentação SEOBRA
              </span>
            </div>
          </Link>

          {/* Navigation Capsule */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '4px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                    border: isActive ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={14} color={isActive ? 'var(--brand-primary)' : 'currentColor'} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 900,
                        backgroundColor: 'var(--brand-primary)',
                        color: '#0E0E10',
                        padding: '1px 5px',
                        borderRadius: '9999px',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Status & Action Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <PncpHealthBadge />

          {/* Primary Sync Button */}
          {onTriggerSync && (
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="btn-primary"
              title="Executar varredura no Portal Nacional de Contratações Públicas"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Varrendo...' : 'Sincronizar PNCP'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
