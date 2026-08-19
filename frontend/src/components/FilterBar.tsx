'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OpportunityFilterParams } from '@/lib/types';
import { MUNICIPIOS_CE } from '@/lib/municipios-ce';
import { Search, RotateCcw, MapPin, Check, LayoutGrid, List, SlidersHorizontal, Filter, ArrowRight } from 'lucide-react';

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
    { label: '🔥 Radar Ativo', val: 'IN_SCOPE_AND_REVIEW' },
    { label: '🏗️ Obras & Engenharia', val: 'IN_SCOPE' },
    { label: '🔍 Em Revisão', val: 'REVIEW' },
    { label: '📋 Todas as Licitações', val: 'ALL' },
  ];

  const currentClassification = filters.classification ?? 'IN_SCOPE';
  const selectedCity = filters.municipality || '';

  // Local city combobox state
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const cityWrapRef = useRef<HTMLDivElement>(null);

  // Local price inputs state (buffered until submit to prevent reload per keystroke)
  const [localMinStr, setLocalMinStr] = useState<string>(() => formatBrlInput(filters.minValue));
  const [localMaxStr, setLocalMaxStr] = useState<string>(() => formatBrlInput(filters.maxValue));

  // Sync local inputs when filters prop updates externally (e.g. on Reset)
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCityOpen(false);
        setCityQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [cityOpen]);

  const pickCity = (name: string) => {
    onChange({ municipality: name, page: 1 });
    setCityOpen(false);
    setCityQuery('');
  };

  const clearCity = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ municipality: '', page: 1 });
    setCityQuery('');
    setCityOpen(false);
  };

  const handleApplyPriceFilter = () => {
    const minDigits = localMinStr.replace(/\D/g, '');
    const maxDigits = localMaxStr.replace(/\D/g, '');
    const nextMin = minDigits ? Number(minDigits) : undefined;
    const nextMax = maxDigits ? Number(maxDigits) : undefined;

    onChange({
      minValue: nextMin,
      maxValue: nextMax,
      page: 1,
    });
  };

  const selectClass: React.CSSProperties = {
    padding: '7px 11px',
    backgroundColor: 'rgba(21, 34, 56, 0.75)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '12.5px',
    fontWeight: 500,
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        marginBottom: '1.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Top Search & Controls Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {/* Search Input with Shortcut Badge */}
        <div style={{ flex: '1 1 380px', position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '13px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--brand-cyan)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Buscar por objeto, prefeitura, órgão ou processo PNCP..."
            value={filters.search || ''}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            style={{
              width: '100%',
              padding: '9px 40px 9px 38px',
              backgroundColor: 'rgba(21, 34, 56, 0.65)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: '13px',
            }}
          />
          <kbd
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'none',
            }}
          >
            /
          </kbd>
        </div>

        {/* Municipality Combobox */}
        <div ref={cityWrapRef} style={{ position: 'relative', minWidth: '220px', flex: '0 1 240px' }}>
          <div
            onClick={() => setCityOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: 'rgba(21, 34, 56, 0.75)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: selectedCity ? 'var(--brand-orange)' : 'var(--text-secondary)',
              fontSize: '12.5px',
              fontWeight: selectedCity ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <MapPin size={14} color="var(--brand-orange)" />
              <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {selectedCity ? selectedCity : 'Municípios do Ceará'}
              </span>
            </div>
            {selectedCity ? (
              <span
                onClick={clearCity}
                title="Limpar município"
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                ✕
              </span>
            ) : (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▼</span>
            )}
          </div>

          {/* City Dropdown Menu */}
          {cityOpen && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '280px',
                zIndex: 60,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '6px',
                maxHeight: '320px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '4px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Filtrar cidade..."
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                <button
                  type="button"
                  onClick={() => pickCity('')}
                  onMouseEnter={() => setHoveredCity('__all__')}
                  style={optionStyle(!selectedCity, hoveredCity === '__all__')}
                >
                  <span>Todos os Municípios (CE)</span>
                  {!selectedCity && <Check size={13} color="var(--brand-orange)" />}
                </button>

                {filteredCities.map((city) => {
                  const active = selectedCity.toLowerCase() === city.toLowerCase();
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => pickCity(city)}
                      onMouseEnter={() => setHoveredCity(city)}
                      style={optionStyle(active, hoveredCity === city)}
                    >
                      <span>{city}</span>
                      {active && <Check size={13} color="var(--brand-orange)" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* View Mode Toggle (Table vs Cards) */}
        {onViewModeChange && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(21, 34, 56, 0.75)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              title="Visualização em Tabela Técnica"
              style={{
                padding: '6px 10px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: viewMode === 'table' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: viewMode === 'table' ? '#FFFFFF' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              title="Visualização em Cards Cockpit"
              style={{
                padding: '6px 10px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: viewMode === 'cards' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: viewMode === 'cards' ? '#FFFFFF' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        )}

        {/* Reset Filter Button */}
        <button
          type="button"
          onClick={onReset}
          className="btn-secondary"
          style={{ padding: '7px 12px', fontSize: '12px' }}
          title="Restaurar filtros padrões"
        >
          <RotateCcw size={13} />
          <span>Limpar</span>
        </button>
      </div>

      {/* Bottom Filter Controls: Scope Pills & Value Inputs with Apply */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '0.85rem',
        }}
      >
        {/* Scope Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {classificationOptions.map((opt) => {
            const isActive = currentClassification === opt.val;
            return (
              <button
                key={opt.val}
                type="button"
                onClick={() => onChange({ classification: opt.val, page: 1 })}
                style={{
                  padding: '5px 11px',
                  borderRadius: '16px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: `1px solid ${isActive ? 'var(--brand-orange)' : 'var(--border-subtle)'}`,
                  backgroundColor: isActive ? 'rgba(242, 100, 25, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? 'var(--brand-orange)' : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 0 10px rgba(242, 100, 25, 0.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Secondary Modality / Status / Price Range Inputs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
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
            value={filters.deadlinePreset ?? 'any'}
            onChange={(e) => onChange({ deadlinePreset: e.target.value === 'any' ? undefined : e.target.value, page: 1 })}
            style={selectClass}
          >
            <option value="any">⏳ Prazo: qualquer</option>
            <option value="7">Encerra em 7 dias</option>
            <option value="15">Encerra em 15 dias</option>
            <option value="30">Encerra em 30 dias</option>
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
            <option value="Tomada de Preços">Tomada de Preços</option>
            <option value="Credenciamento">Credenciamento</option>
          </select>

          {/* Price Range Controls with Local Buffer and Submit Button */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(21, 34, 56, 0.85)',
              padding: '3px 4px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Min Value Input */}
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
              title="Valor Mínimo Estimado (pressione Enter ou clique em Filtrar)"
              style={{
                width: '105px',
                padding: '4px 6px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 600,
                textAlign: 'right',
                outline: 'none',
              }}
            />

            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>até</span>

            {/* Max Value Input (Teto) */}
            <input
              type="text"
              inputMode="numeric"
              placeholder="Teto máx. (R$)"
              value={localMaxStr}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setLocalMaxStr(digits ? `R$ ${Number(digits).toLocaleString('pt-BR')}` : '');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyPriceFilter();
              }}
              title="Teto / Valor Máximo Estimado (pressione Enter ou clique em Filtrar)"
              style={{
                width: '110px',
                padding: '4px 6px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 600,
                textAlign: 'right',
                outline: 'none',
              }}
            />

            {/* Apply / Submit Button */}
            <button
              type="button"
              onClick={handleApplyPriceFilter}
              className="btn-primary"
              style={{
                padding: '4px 10px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
              title="Buscar licitações na faixa de valor informada (Enter)"
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

function optionStyle(active: boolean, hovered: boolean): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '8px 12px',
    border: 'none',
    backgroundColor: active
      ? 'rgba(242, 100, 25, 0.15)'
      : hovered
      ? 'rgba(255, 255, 255, 0.06)'
      : 'transparent',
    color: active ? 'var(--brand-orange)' : 'var(--text-primary)',
    fontSize: '12.5px',
    fontWeight: active ? 700 : 500,
    textAlign: 'left',
    cursor: 'pointer',
  };
}
