'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OpportunityFilterParams } from '@/lib/types';
import { MUNICIPIOS_CE } from '@/lib/municipios-ce';
import { Search, RotateCcw, MapPin, Check, LayoutGrid, List, Filter, ChevronDown } from 'lucide-react';

interface Props {
  filters: OpportunityFilterParams;
  onChange: (updated: Partial<OpportunityFilterParams>) => void;
  onReset: () => void;
  viewMode?: 'table' | 'cards';
  onViewModeChange?: (mode: 'table' | 'cards') => void;
}

function fold(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatBrlInput(raw: string | number | undefined): string {
  if (raw === undefined || raw === null || raw === '') return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  return `R$ ${Number(digits).toLocaleString('pt-BR')}`;
}

export const FilterBar: React.FC<Props> = ({
  filters,
  onChange,
  onReset,
  viewMode = 'table',
  onViewModeChange,
}) => {
  const classificationOptions = [
    { label: 'Radar Ativo', val: 'IN_SCOPE_AND_REVIEW' },
    { label: 'Escopo Direto', val: 'IN_SCOPE' },
    { label: 'Revisão Técnica', val: 'REVIEW' },
    { label: 'Todas as Oportunidades', val: 'ALL' },
  ];

  const currentClassification = filters.classification ?? 'IN_SCOPE_AND_REVIEW';
  const selectedCity = filters.municipality || '';

  // Local city combobox state
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const cityWrapRef = useRef<HTMLDivElement>(null);

  // Local price inputs state
  const [localMinStr, setLocalMinStr] = useState<string>(() => formatBrlInput(filters.minValue));
  const [localMaxStr, setLocalMaxStr] = useState<string>(() => formatBrlInput(filters.maxValue));

  useEffect(() => {
    setLocalMinStr(formatBrlInput(filters.minValue));
  }, [filters.minValue]);

  useEffect(() => {
    setLocalMaxStr(formatBrlInput(filters.maxValue));
  }, [filters.maxValue]);

  const filteredCities = useMemo(() => {
    const q = fold(cityQuery.trim());
    if (!q) return MUNICIPIOS_CE;
    return MUNICIPIOS_CE.filter((m) => fold(m).includes(q));
  }, [cityQuery]);

  useEffect(() => {
    if (!cityOpen) return;
    const onDown = (e: MouseEvent) => {
      if (cityWrapRef.current && !cityWrapRef.current.contains(e.target as Node)) {
        setCityOpen(false);
        setCityQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [cityOpen]);

  const pickCity = (name: string) => {
    onChange({ municipality: name, page: 1 });
    setCityOpen(false);
    setCityQuery('');
  };

  const handleApplyPriceFilter = () => {
    const minDigits = localMinStr.replace(/\D/g, '');
    const maxDigits = localMaxStr.replace(/\D/g, '');
    onChange({
      minValue: minDigits ? Number(minDigits) : undefined,
      maxValue: maxDigits ? Number(maxDigits) : undefined,
      page: 1,
    });
  };

  const selectClass: React.CSSProperties = {
    padding: '7px 14px',
    backgroundColor: '#101012',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-full)',
    color: 'var(--text-primary)',
    fontSize: '12.5px',
    fontWeight: 500,
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div
      className="wishlabs-card"
      style={{
        padding: '16px 20px',
        marginBottom: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Top Search & Filter Pill Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Search Input with Capsule Design */}
        <div style={{ flex: '1 1 340px', position: 'relative', minWidth: '260px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Buscar por objeto, prefeitura, órgão ou edital..."
            value={filters.search || ''}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            style={{
              width: '100%',
              height: '42px',
              padding: '0 40px 0 40px',
              backgroundColor: '#101012',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              color: '#FFFFFF',
              outline: 'none',
              fontSize: '13.5px',
              fontFamily: 'var(--font-body)',
            }}
          />
          <kbd
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              fontWeight: 800,
              color: 'var(--text-secondary)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 6px',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'none',
            }}
          >
            /
          </kbd>
        </div>

        {/* Municipality Selector Pill */}
        <div ref={cityWrapRef} style={{ position: 'relative', minWidth: '210px' }}>
          <div
            onClick={() => setCityOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '42px',
              gap: '8px',
              padding: '0 16px',
              backgroundColor: '#101012',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              color: selectedCity ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontSize: '12.5px',
              fontWeight: selectedCity ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <MapPin size={14} color={selectedCity ? 'var(--brand-primary)' : 'currentColor'} />
              <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {selectedCity || 'Municípios (CE)'}
              </span>
            </div>
            <ChevronDown size={13} color="var(--text-secondary)" />
          </div>

          {cityOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '280px',
                zIndex: 60,
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                padding: '8px',
                maxHeight: '300px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '4px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '6px' }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Filtrar cidade..."
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    backgroundColor: '#101012',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                <button
                  type="button"
                  onClick={() => pickCity('')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: !selectedCity ? 'var(--brand-primary-bg)' : 'transparent',
                    color: !selectedCity ? 'var(--brand-primary)' : 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontWeight: !selectedCity ? 700 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Todos os Municípios (CE)</span>
                  {!selectedCity && <Check size={13} />}
                </button>

                {filteredCities.map((city) => {
                  const active = selectedCity.toLowerCase() === city.toLowerCase();
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => pickCity(city)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: active ? 'var(--brand-primary-bg)' : 'transparent',
                        color: active ? 'var(--brand-primary)' : 'var(--text-primary)',
                        fontSize: '12.5px',
                        fontWeight: active ? 700 : 500,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{city}</span>
                      {active && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* View Mode Toggle & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onViewModeChange && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#101012',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                padding: '3px',
              }}
            >
              <button
                type="button"
                onClick={() => onViewModeChange('table')}
                title="Tabela Técnica"
                style={{
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: viewMode === 'table' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: viewMode === 'table' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('cards')}
                title="Cards Cockpit"
                style={{
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: viewMode === 'cards' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: viewMode === 'cards' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onReset}
            className="btn-secondary"
            style={{ padding: '7px 14px', fontSize: '12px' }}
            title="Restaurar filtros padrões"
          >
            <RotateCcw size={13} />
            <span>Limpar</span>
          </button>
        </div>
      </div>

      {/* Bottom Category Filter Pills & Modality Selectors */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '14px',
        }}
      >
        {/* Classification Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {classificationOptions.map((opt) => {
            const isActive = currentClassification === opt.val;
            return (
              <button
                key={opt.val}
                type="button"
                onClick={() => onChange({ classification: opt.val, page: 1 })}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '12px',
                  fontWeight: isActive ? 800 : 500,
                  cursor: 'pointer',
                  border: `1px solid ${isActive ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                  backgroundColor: isActive ? 'var(--brand-primary-bg)' : 'transparent',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Secondary Modality / Status / Price Range Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <select
            value={filters.status || 'OPEN'}
            onChange={(e) => onChange({ status: e.target.value, page: 1 })}
            style={selectClass}
          >
            <option value="OPEN">🟢 Abertas (Recebendo)</option>
            <option value="CLOSED">Encerradas</option>
            <option value="ALL">Todas as Situações</option>
          </select>

          <select
            value={filters.modality || ''}
            onChange={(e) => onChange({ modality: e.target.value, page: 1 })}
            style={selectClass}
          >
            <option value="">Modalidade: todas</option>
            <option value="Pregão">Pregão Eletrônico</option>
            <option value="Concorrência">Concorrência</option>
            <option value="Dispensa">Dispensa</option>
          </select>

          {/* Price Range Controls with Pill Shell */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#101012',
              padding: '3px 6px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="Mín. (R$)"
              value={localMinStr}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setLocalMinStr(digits ? `R$ ${Number(digits).toLocaleString('pt-BR')}` : '');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyPriceFilter();
              }}
              style={{
                width: '100px',
                padding: '4px 6px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                textAlign: 'right',
                outline: 'none',
              }}
            />

            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>até</span>

            <input
              type="text"
              inputMode="numeric"
              placeholder="Teto (R$)"
              value={localMaxStr}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setLocalMaxStr(digits ? `R$ ${Number(digits).toLocaleString('pt-BR')}` : '');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyPriceFilter();
              }}
              style={{
                width: '100px',
                padding: '4px 6px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                textAlign: 'right',
                outline: 'none',
              }}
            />

            <button
              type="button"
              onClick={handleApplyPriceFilter}
              className="btn-primary"
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Filter size={11} />
              <span>Filtrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
