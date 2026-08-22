'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RefreshCw, Radio, Sparkles, History, Layers } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { fetchPncpHealth, fetchSyncHistory as getSyncHistory, fetchSyncStatus as getSyncStatus } from '@/lib/api';
import type { LicitacaoSyncRun, PncpHealth } from '@/lib/types';

type SyncPhase = 'idle' | 'starting' | 'processing' | 'completed' | 'failed';
type SyncFeedback = { type: 'success' | 'info' | 'error'; message: string };

interface HeaderProps {
  lastSyncAt?: string | null;
  syncStatus?: string;
  isSyncing?: boolean;
  onTriggerSync?: () => void | Promise<void>;
  syncFeedback?: SyncFeedback | null;
}

function formatLastSync(value?: string | null): string {
  if (!value) return 'não registrada';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateTime(value);

  const elapsedMs = Date.now() - date.getTime();
  if (elapsedMs >= 0 && elapsedMs < 60_000) return 'agora';
  if (elapsedMs >= 0 && elapsedMs < 60 * 60_000) {
    return `há ${Math.max(1, Math.floor(elapsedMs / 60_000))} min`;
  }
  if (elapsedMs >= 0 && elapsedMs < 24 * 60 * 60_000) {
    return `há ${Math.floor(elapsedMs / (60 * 60_000))} h`;
  }

  return formatDateTime(value);
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
      className="app-header-health"
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        fontSize: '12px',
        fontWeight: 700,
        color: isUp ? 'var(--brand-primary)' : '#F59E0B',
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
          flexShrink: 0,
        }}
        className={isUp ? 'live-pulse' : ''}
      />
      <span className="app-header-health-label">{label}</span>
    </div>
  );
}

export const Header: React.FC<HeaderProps> = ({
  lastSyncAt,
  syncStatus = 'UNKNOWN',
  isSyncing = false,
  onTriggerSync,
  syncFeedback,
}) => {
  const pathname = usePathname();
  const [latestSyncRun, setLatestSyncRun] = useState<LicitacaoSyncRun | null>(null);
  const [lastSyncLabel, setLastSyncLabel] = useState('Última: não registrada');
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
  const syncPhaseRef = useRef<SyncPhase>('idle');
  const syncStartedAtRef = useRef<number | null>(null);

  const setPhase = useCallback((phase: SyncPhase) => {
    syncPhaseRef.current = phase;
    setSyncPhase(phase);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSyncInfo = async () => {
      try {
        const [status, history] = await Promise.all([getSyncStatus(), getSyncHistory(1)]);
        if (cancelled) return;

        const latest = history?.[0] ?? status.latestRun ?? null;
        setLatestSyncRun(latest);

        const isRunning = status.isRunning || status.currentRun?.status === 'RUNNING';
        if (isRunning) {
          setPhase('processing');
          return;
        }

        const phase = syncPhaseRef.current;
        if (phase !== 'starting' && phase !== 'processing') return;

        const latestStartedAt = latest ? new Date(latest.startedAt).getTime() : Number.NaN;
        const requestedAt = syncStartedAtRef.current;
        const belongsToCurrentRequest =
          requestedAt === null ||
          (Number.isFinite(latestStartedAt) && latestStartedAt >= requestedAt - 5000);

        if (belongsToCurrentRequest && latest && latest.status !== 'RUNNING') {
          setPhase(latest.status === 'FAILED' ? 'failed' : 'completed');
        }
      } catch {
        // O histórico continua visível com o último dado recebido pelos props.
      }
    };

    loadSyncInfo();
    const isActive = isSyncing || syncPhase === 'starting' || syncPhase === 'processing' || syncStatus === 'RUNNING';
    const interval = window.setInterval(loadSyncInfo, isActive ? 3000 : 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isSyncing, setPhase, syncPhase, syncStatus]);

  useEffect(() => {
    const timestamp =
      (latestSyncRun?.status === 'RUNNING' ? null : latestSyncRun?.finishedAt || latestSyncRun?.startedAt) || lastSyncAt;
    const updateLabel = () => {
      setLastSyncLabel(`Última: ${formatLastSync(timestamp)}`);
    };

    updateLabel();
    const interval = window.setInterval(updateLabel, 60_000);
    return () => window.clearInterval(interval);
  }, [lastSyncAt, latestSyncRun]);

  useEffect(() => {
    if (isSyncing && syncPhaseRef.current === 'idle') {
      setPhase('processing');
    }
  }, [isSyncing, setPhase]);

  useEffect(() => {
    if (syncFeedback?.type === 'error') {
      setPhase('failed');
    } else if (syncFeedback?.type === 'success') {
      setPhase('completed');
    } else if (syncFeedback?.type === 'info' && isSyncing) {
      setPhase('processing');
    }
  }, [isSyncing, setPhase, syncFeedback]);

  const handleSyncClick = async () => {
    syncStartedAtRef.current = Date.now();
    setPhase('starting');

    try {
      await onTriggerSync?.();
    } catch {
      setPhase('failed');
    }
  };

  const syncIsActive =
    isSyncing || syncStatus === 'RUNNING' || syncPhase === 'starting' || syncPhase === 'processing';
  const syncMessage = syncIsActive
    ? syncPhase === 'starting'
      ? 'Sincronização iniciada.'
      : 'Sincronizando PNCP…'
    : syncPhase === 'completed'
    ? latestSyncRun?.status === 'PARTIAL'
      ? 'Sincronização concluída parcialmente.'
      : 'Sincronização concluída.'
    : syncPhase === 'failed'
    ? 'Falha na sincronização; tente novamente.'
    : null;

  const navItems = [
    { href: '/', label: 'Radar de Oportunidades', icon: Radio },
    { href: '/orcamentos', label: 'Orçamentos IA', icon: Sparkles },
    { href: '/editais', label: 'Analista de Editais', icon: Layers, badge: 'PRO' },
    { href: '/sync', label: 'Sincronização', icon: History },
  ];

  return (
    <header
      className="app-header"
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
      <div className="container app-header-inner">
        <Link
          href="/"
          className="app-header-logo"
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
              className="app-header-subtitle"
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
        <nav className="app-header-nav" aria-label="Navegação principal">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="app-header-nav-link"
                  title={item.label}
                  style={{
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
                  <span className="app-header-nav-label">{item.label}</span>
                  {item.badge && (
                    <span
                      className="app-header-nav-badge"
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

        {/* Right Status & Action Section */}
        <div className="app-header-actions">
          <PncpHealthBadge />

          <div className="app-header-status" role="status" aria-live="polite">
            {syncMessage && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{syncMessage}</span>}
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lastSyncLabel}</span>
          </div>

          {/* Primary Sync Button */}
          {onTriggerSync && (
            <button
              onClick={handleSyncClick}
              disabled={syncIsActive}
              aria-busy={syncIsActive}
              aria-label={syncIsActive ? 'Sincronizando PNCP' : 'Sincronizar PNCP'}
              className="btn-primary app-header-sync"
              title={
                syncIsActive
                  ? 'Sincronização do PNCP em andamento'
                  : 'Executar varredura no Portal Nacional de Contratações Públicas'
              }
            >
              <RefreshCw size={13} className={syncIsActive ? 'animate-spin' : ''} />
              <span className="app-header-sync-text" aria-hidden="true">
                {syncIsActive ? 'Sincronizando…' : 'Sincronizar PNCP'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
