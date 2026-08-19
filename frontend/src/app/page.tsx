'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { StatsOverview } from '@/components/StatsOverview';
import { FilterBar } from '@/components/FilterBar';
import { OpportunityTable } from '@/components/OpportunityTable';
import { OpportunityDrawer } from '@/components/OpportunityDrawer';
import { ErrorState } from '@/components/ErrorState';
import { useRadar } from '@/context/RadarContext';
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function RadarDashboardPage() {
  const {
    opportunities,
    stats,
    loading,
    statsLoading,
    error,
    viewMode,
    selectedOpp,
    page,
    totalPages,
    totalRecords,
    filters,
    isSyncing,
    syncFeedback,
    lastSuccessfulSyncAt,
    syncStatus,
    setViewMode,
    setSelectedOpp,
    setSyncFeedback,
    handleFilterChange,
    handleResetFilters,
    handlePageChange,
    handleTriggerSync,
    handleSelectCategory,
    reload,
  } = useRadar();

  return (
    <div>
      <Header
        lastSyncAt={lastSuccessfulSyncAt}
        syncStatus={syncStatus}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerSync}
      />

      <main className="container" style={{ paddingTop: '36px', paddingBottom: '80px' }}>
        {/* Sync Toast Feedback */}
        {syncFeedback && (
          <div
            style={{
              padding: '14px 20px',
              borderRadius: 'var(--radius-full)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor:
                syncFeedback.type === 'success'
                  ? 'var(--brand-primary-bg)'
                  : syncFeedback.type === 'error'
                  ? 'rgba(255, 129, 178, 0.15)'
                  : 'rgba(56, 189, 248, 0.15)',
              border: `1px solid ${
                syncFeedback.type === 'success'
                  ? 'var(--brand-primary-border)'
                  : syncFeedback.type === 'error'
                  ? 'rgba(255, 129, 178, 0.3)'
                  : 'rgba(56, 189, 248, 0.3)'
              }`,
              color:
                syncFeedback.type === 'success'
                  ? 'var(--brand-primary)'
                  : syncFeedback.type === 'error'
                  ? '#FF81B2'
                  : '#38BDF8',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {syncFeedback.type === 'success' && <CheckCircle2 size={16} />}
              {syncFeedback.type === 'error' && <AlertCircle size={16} />}
              {syncFeedback.type === 'info' && <RefreshCw size={16} className="animate-spin" />}
              <span>{syncFeedback.message}</span>
            </div>
            <button
              onClick={() => setSyncFeedback(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '14px',
                opacity: 0.8,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Partial Data Banner — last completed sync ended PARTIAL */}
        {syncStatus === 'PARTIAL' && !isSyncing && (
          <div
            style={{
              padding: '14px 20px',
              borderRadius: 'var(--radius-full)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38BDF8',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>
                Dados parciais — a última sincronização não concluiu todas as páginas do PNCP. Os
                resultados podem estar incompletos.
              </span>
            </div>
            <button
              onClick={handleTriggerSync}
              className="btn-primary"
              style={{ fontSize: '12px', padding: '8px 16px' }}
            >
              <RefreshCw size={14} />
              <span>Sincronizar novamente</span>
            </button>
          </div>
        )}

        {/* Hero Title Banner */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--brand-primary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)' }} />
            <span>Radar PNCP Ceará • Oportunidades em Aberto</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px' }}>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '34px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.15,
                  maxWidth: '820px',
                }}
              >
                Inteligência de Licitações & Orçamentação{' '}
                <span style={{ fontStyle: 'italic', fontWeight: 600, color: 'var(--brand-primary)' }}>
                  SEOBRA
                </span>
              </h1>
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '640px' }}>
                Monitoramento determinístico no Portal Nacional de Contratações Públicas com classificação técnica automática.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <a href="/orcamentos" className="btn-primary">
                <Sparkles size={15} />
                <span>Orçar com IA</span>
              </a>
            </div>
          </div>
        </div>

        {/* Aggregate Bento KPI Stats */}
        <StatsOverview
          stats={stats}
          loading={statsLoading}
          onSelectCategory={handleSelectCategory}
        />

        {/* Filter Controls with Capsule Design */}
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Table/Cards View or Error State */}
        {error && opportunities.length === 0 ? (
          <ErrorState
            message={error}
            lastValidSyncAt={lastSuccessfulSyncAt}
            onRetry={reload}
          />
        ) : (
          <OpportunityTable
            opportunities={opportunities}
            loading={loading}
            page={page}
            totalPages={totalPages}
            total={totalRecords}
            onPageChange={handlePageChange}
            onTermClick={(term) => handleFilterChange({ term, page: 1 })}
            onSelectOpportunity={(opp) => setSelectedOpp(opp)}
            viewMode={viewMode}
          />
        )}
      </main>

      {/* Slide-over Inspection Drawer */}
      <OpportunityDrawer
        opportunity={selectedOpp}
        onClose={() => setSelectedOpp(null)}
        onTermClick={(term) => {
          setSelectedOpp(null);
          handleFilterChange({ term, page: 1 });
        }}
      />
    </div>
  );
}
