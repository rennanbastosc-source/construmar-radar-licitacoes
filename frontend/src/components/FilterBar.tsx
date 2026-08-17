'use client';

import React from 'react';
import { OpportunityFilterParams } from '@/lib/types';
import { Search, Filter, RotateCcw, MapPin } from 'lucide-react';

interface Props {
  filters: OpportunityFilterParams;
  onChange: (updated: Partial<OpportunityFilterParams>) => void;
  onReset: () => void;
}

export const FilterBar: React.FC<Props> = ({ filters, onChange, onReset }) => {
  const valuePresets = [
    { label: 'R$ 900 mil+', val: 900000 },
    { label: 'R$ 2 mi+', val: 2000000 },
    { label: 'R$ 5 mi+', val: 5000000 },
    { label: 'R$ 10 mi+', val: 10000000 },
    { label: 'Todos os valores', val: 0 },
  ];

  const classificationOptions = [
    { label: 'Radar Ativo (Escopo + Revisão)', val: 'IN_SCOPE_AND_REVIEW' },
    { label: 'Obras & Engenharia (Escopo)', val: 'IN_SCOPE' },
    { label: 'Em Revisão', val: 'REVIEW' },
    { label: 'Todas as Licitações', val: 'ALL' },
  ];

  const currentMinValue = filters.minValue ?? 900000;
  const currentClassification = filters.classification ?? 'IN_SCOPE';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        border: '1px solid var(--border-subtle)',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Top row: Search & Municipality */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Search */}
        <div style={{ flex: '1 1 320px', position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Buscar por objeto, órgão, número PNCP..."
            value={filters.search || ''}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Municipality */}
        <div style={{ flex: '0 1 240px', position: 'relative' }}>
          <MapPin
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Município (ex: Fortaleza)"
            value={filters.municipality || ''}
            onChange={(e) => onChange({ municipality: e.target.value, page: 1 })}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Reset Button */}
        <button
          onClick={onReset}
          title="Restaurar filtros padrão"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          <RotateCcw size={14} />
          Limpar
        </button>
      </div>

      {/* Bottom row: Classification Tabs & Value Presets */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {/* Classification Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {classificationOptions.map((opt) => {
            const isActive = currentClassification === opt.val;
            return (
              <button
                key={opt.val}
                onClick={() => onChange({ classification: opt.val, page: 1 })}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${isActive ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                  backgroundColor: isActive ? 'var(--brand-primary-subtle)' : 'var(--bg-surface-elevated)',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Value Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Valor mín:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {valuePresets.map((vp) => {
              const isSelected = currentMinValue === vp.val;
              return (
                <button
                  key={vp.val}
                  onClick={() => onChange({ minValue: vp.val, page: 1 })}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    border: `1px solid ${isSelected ? '#3b82f6' : 'var(--border-subtle)'}`,
                    backgroundColor: isSelected ? 'var(--accent-blue-subtle)' : 'transparent',
                    color: isSelected ? '#93c5fd' : 'var(--text-muted)',
                  }}
                >
                  {vp.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
