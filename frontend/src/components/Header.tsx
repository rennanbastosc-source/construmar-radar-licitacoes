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
  const label = health ? (isUp ? 'PNCP Online' : 'PNCP Offline') : errored ? 'PNCP Offline' : 'Verificando...';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11.5px',
        color: 'var(--text-secondary)',
        padding: '5px 10px',
        borderRadius: '6px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: isUp ? '#10B981' : '#F59E0B',
          boxShadow: isUp ? '0 0 8px #10B981' : '0 0 8px #F59E0B',
        }}
        className="live-pulse"
      />
      <span style={{ fontWeight: 600 }}>{label}</span>
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
    { href: '/orcamentos', label: 'Orçamentos com IA', icon: Sparkles },
    { href: '/editais', label: 'Analista de Editais', icon: Layers, badge: 'PRO' },
    { href: '/sync', label: 'Histórico PNCP', icon: History },
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(6, 11, 19, 0.85)',
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
          height: '68px',
          gap: '1.5rem',
        }}
      >
        {/* Brand Logo */}
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
            {/* CONSTRUMAR Vector Icon */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #0A2540 0%, #144272 100%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 32V14L16 6V32H6Z" fill="#0EA5E9" />
                <path d="M18 32V10L28 18V32H18Z" fill="#F26419" />
                <path d="M30 32V22L36 26.5V32H30Z" fill="#38BDF8" opacity="0.8" />
                <rect x="4" y="32" width="34" height="3" rx="1.5" fill="#F8FAFC" />
              </svg>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '17px',
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                    color: '#F8FAFC',
                  }}
                >
                  CONSTRU<span style={{ color: '#F26419' }}>MAR</span>
                </span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(242, 100, 25, 0.12)',
                    color: '#F26419',
                    border: '1px solid rgba(242, 100, 25, 0.3)',
                    letterSpacing: '0.06em',
                  }}
                >
                  RADAR SAAS
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                }}
              >
                Inteligência de Editais & Obras
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              padding: '3px',
              borderRadius: '8px',
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
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.09)' : 'transparent',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={14} color={isActive ? 'var(--brand-orange)' : 'currentColor'} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 800,
                        backgroundColor: 'var(--brand-orange)',
                        color: '#FFFFFF',
                        padding: '1px 4px',
                        borderRadius: '3px',
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
            }}
          >
            <span>Sincronização:</span>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {lastSyncAt ? formatDateTime(lastSyncAt) : 'Automática'}
            </strong>
          </div>

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
