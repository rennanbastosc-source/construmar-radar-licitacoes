'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OpportunityFilterParams } from '@/lib/types';
import { MUNICIPIOS_CE } from '@/lib/municipios-ce';
import { Search, RotateCcw, MapPin, Check, LayoutGrid, List, Filter, ChevronDown, Layers } from 'lucide-react';

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

interface DropdownOption {
  label: string;
  value: string;
  dotColor?: string;
}

function DropdownPill({
  value,
  options,
  onChange,
  placeholder,
  icon,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          height: '40px',
          padding: '0 16px',
          backgroundColor: '#101012',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-full)',
          color: 'var(--text-primary)',
          fontSize: '12.5px',
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selected?.dotColor && (
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: selected.dotColor,
                boxShadow: selected.dotColor === 'var(--brand-primary)' ? '0 0 6px var(--brand-primary)' : 'none',
                flexShrink: 0,
              }}
            />
          )}
          {icon}
          <span>{selected?.label || placeholder}</span>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 70,
            minWidth: '200px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {options.map((opt) => {
            const isOptActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isOptActive ? 'var(--brand-primary-bg)' : 'transparent',
                  color: isOptActive ? 'var(--brand-primary)' : 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: isOptActive ? 700 : 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background-color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isOptActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isOptActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {opt.dotColor && (
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: opt.dotColor,
                      }}
                    />
                  )}
                  <span>{opt.label}</span>
                </div>
                {isOptActive && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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

  const statusOptions: DropdownOption[] = [
    { label: 'Abertas (Recebendo)', value: 'OPEN', dotColor: '#C0FF73' },
    { label: 'Encerradas', value: 'CLOSED', dotColor: '#636366' },
    { label: 'Todas as Situações', value: 'ALL', dotColor: '#38BDF8' },
  ];

  const modalityOptions: DropdownOption[] = [
    { label: 'Modalidade: todas', value: '' },
    { label: 'Pregão Eletrônico', value: 'Pregão' },
    { label: 'Concorrência', value: 'Concorrência' },
    { label: 'Dispensa', value: 'Dispensa' },
  ];

  const currentClassification = filters.classification ?? 'IN_SCOPE_AND_REVIEW';
  const selectedCity = filters.municipality || '';

  // Local city combobox state
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const cityWrapRef = useRef<HTMLDivElement>(null);

  // Local filter inputs state
  const [localSearch, setLocalSearch] = useState<string>(() => filters.search || '');
  const [localMinStr, setLocalMinStr] = useState<string>(() => formatBrlInput(filters.minValue));
  const [localMaxStr, setLocalMaxStr] = useState<string>(() => formatBrlInput(filters.maxValue));

  useEffect(() => {
    setLocalSearch(filters.search || '');
  }, [filters.search]);

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

  const handleApplySearch = () => {
    onChange({ search: localSearch, page: 1 });
  };

  return (
    <div
      className="wishlabs-card"
      style={{
        padding: '18px 24px',
        marginBottom: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Top Search & Filter Pill Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Search Input with Capsule Design */}
        <div style={{ flex: '1 1 360px', position: 'relative', minWidth: '280px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Buscar por objeto, prefeitura, órgão ou edital..."
            aria-label="Buscar oportunidades por objeto, prefeitura, órgão ou edital"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApplySearch();
              }
            }}
            style={{
              width: '100%',
              height: '42px',
              padding: '0 42px 0 42px',
              backgroundColor: '#101012',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              color: '#FFFFFF',
              outline: 'none',
              fontSize: '16px',
              fontFamily: 'var(--font-body)',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
          />
          <kbd
            style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              fontWeight: 800,
              color: 'var(--text-secondary)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 7px',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'none',
            }}
          >
            /
          </kbd>
        </div>

        {/* Municipality Selector Pill */}
        <div ref={cityWrapRef} style={{ position: 'relative', minWidth: '220px' }}>
          <button
            type="button"
            onClick={() => setCityOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              height: '42px',
              gap: '10px',
              padding: '0 16px',
              backgroundColor: '#101012',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              color: selectedCity ? 'var(--brand-primary)' : 'var(--text-primary)',
              fontSize: '12.5px',
              fontWeight: selectedCity ? 700 : 500,
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <MapPin size={14} color={selectedCity ? 'var(--brand-primary)' : 'var(--text-secondary)'} />
              <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {selectedCity || 'Municípios (CE)'}
              </span>
            </div>
            <ChevronDown size={14} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
          </button>

          {cityOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '280px',
                zIndex: 70,
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
                    padding: '7px 12px',
                    backgroundColor: '#101012',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '16px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: viewMode === 'table' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: viewMode === 'table' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
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
                title="Cards Cockpit"
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: viewMode === 'cards' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: viewMode === 'cards' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
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
            style={{ padding: '8px 16px', fontSize: '12.5px' }}
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
          gap: '14px',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '16px',
        }}
      >
        {/* Classification Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {classificationOptions.map((opt) => {
            const isActive = currentClassification === opt.val;
            return (
              <button
                key={opt.val}
                type="button"
                onClick={() => onChange({ classification: opt.val, page: 1 })}
                style={{
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 800 : 500,
                  cursor: 'pointer',
                  border: `1px solid ${isActive ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                  backgroundColor: isActive ? 'var(--brand-primary-bg)' : '#101012',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Secondary Modality / Status / Price Range Controls with generous breathing room */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {/* Custom Status Dropdown */}
          <DropdownPill
            value={filters.status || 'OPEN'}
            options={statusOptions}
            onChange={(val) => onChange({ status: val, page: 1 })}
          />

          {/* Custom Modality Dropdown */}
          <DropdownPill
            value={filters.modality || ''}
            options={modalityOptions}
            onChange={(val) => onChange({ modality: val, page: 1 })}
          />

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
              height: '40px',
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
                width: '105px',
                padding: '4px 8px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
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
                width: '105px',
                padding: '4px 8px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
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
                padding: '5px 12px',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Filter size={12} />
              <span>Filtrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
