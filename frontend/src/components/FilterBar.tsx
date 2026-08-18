'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OpportunityFilterParams } from '@/lib/types';
import { MUNICIPIOS_CE } from '@/lib/municipios-ce';
import { valorPorExtenso } from '@/lib/valorPorExtenso';
import { Search, RotateCcw, MapPin, Check } from 'lucide-react';

interface Props {
  filters: OpportunityFilterParams;
  onChange: (updated: Partial<OpportunityFilterParams>) => void;
  onReset: () => void;
}

function fold(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px 10px 36px',
  backgroundColor: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...fieldStyle,
  padding: '8px 10px',
  paddingLeft: '12px',
  backgroundColor: 'var(--bg-surface-elevated)',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
};

export const FilterBar: React.FC<Props> = ({ filters, onChange, onReset }) => {
  const classificationOptions = [
    { label: 'Radar Ativo (Escopo + Revisão)', val: 'IN_SCOPE_AND_REVIEW' },
    { label: 'Obras & Engenharia (Escopo)', val: 'IN_SCOPE' },
    { label: 'Em Revisão', val: 'REVIEW' },
    { label: 'Todas as Licitações', val: 'ALL' },
  ];

  const currentClassification = filters.classification ?? 'IN_SCOPE';
  const selectedCity = filters.municipality || '';

  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const cityWrapRef = useRef<HTMLDivElement>(null);

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

  const minVal = filters.minValue;
  const maxVal = filters.maxValue;
  const minExtenso = minVal !== undefined ? valorPorExtenso(minVal) : '';
  const maxExtenso = maxVal !== undefined ? valorPorExtenso(maxVal) : '';
  const rangeInvalid =
    minVal !== undefined && maxVal !== undefined && minVal > maxVal;

  const handleDeadlineChange = (value: string) => {
    if (value === 'any') {
      onChange({ deadlineTo: undefined, page: 1 });
      return;
    }

    const days = Number(value);
    onChange({
      deadlineTo: new Date(Date.now() + days * 86400000).toISOString(),
      page: 1,
    });
  };

  const deadlinePreset = filters.deadlineTo
    ? ([7, 15, 30].find((days) => {
        const deadline = new Date(filters.deadlineTo as string).getTime();
        return Math.abs(deadline - (Date.now() + days * 86400000)) < 60000;
      })?.toString() ?? 'any')
    : 'any';

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ flex: '1 1 320px', position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Buscar por objeto, órgão, número PNCP..."
            value={filters.search || ''}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            style={fieldStyle}
          />
        </div>

        <div ref={cityWrapRef} style={{ flex: '0 1 280px', position: 'relative' }}>
          <MapPin
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          <input
            type="text"
            role="combobox"
            aria-expanded={cityOpen}
            aria-controls="municipio-listbox"
            aria-autocomplete="list"
            placeholder="Todas as cidades"
            value={cityOpen ? cityQuery : selectedCity}
            onFocus={() => {
              setCityOpen(true);
              setCityQuery('');
            }}
            onChange={(e) => {
              setCityQuery(e.target.value);
              if (!cityOpen) setCityOpen(true);
            }}
            style={{
              ...fieldStyle,
              paddingRight: selectedCity ? '36px' : '12px',
              borderColor: cityOpen ? 'var(--border-focus)' : 'var(--border-subtle)',
              cursor: 'pointer',
            }}
          />
          {selectedCity ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearCity}
              aria-label="Limpar município"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '22px',
                height: '22px',
                border: 'none',
                borderRadius: '4px',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          ) : null}

          {cityOpen && (
            <ul
              id="municipio-listbox"
              role="listbox"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 30,
                maxHeight: '280px',
                overflowY: 'auto',
                margin: 0,
                padding: '4px 0',
                listStyle: 'none',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <li role="option" aria-selected={!selectedCity}>
                <button
                  type="button"
                  onClick={() => pickCity('')}
                  onMouseEnter={() => setHoveredCity('')}
                  onMouseLeave={() => setHoveredCity(null)}
                  style={optionStyle(!selectedCity, hoveredCity === '')}
                >
                  <span>Todas as cidades</span>
                  {!selectedCity ? <Check size={14} color="var(--brand-primary)" /> : null}
                </button>
              </li>
              {filteredCities.map((name) => {
                const active = selectedCity === name;
                return (
                  <li key={name} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => pickCity(name)}
                      onMouseEnter={() => setHoveredCity(name)}
                      onMouseLeave={() => setHoveredCity(null)}
                      style={optionStyle(active, hoveredCity === name)}
                    >
                      <span>{name}</span>
                      {active ? <Check size={14} color="var(--brand-primary)" /> : null}
                    </button>
                  </li>
                );
              })}
              {filteredCities.length === 0 && (
                <li
                  style={{
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Nenhum município encontrado
                </li>
              )}
            </ul>
          )}
        </div>

        <button
          type="button"
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

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {classificationOptions.map((opt) => {
              const isActive = currentClassification === opt.val;
              return (
                <button
                  key={opt.val}
                  type="button"
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
            {filters.term ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 8px 6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid var(--brand-primary)',
                  backgroundColor: 'var(--brand-primary-subtle)',
                  color: 'var(--brand-primary)',
                }}
              >
                <span>Termo: {filters.term}</span>
                <button
                  type="button"
                  onClick={() => onChange({ term: '', page: 1 })}
                  aria-label="Remover termo"
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '15px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ flex: '0 1 140px', minWidth: '120px' }}>
              <select
                aria-label="Status"
                value={filters.status || 'OPEN'}
                onChange={(e) => onChange({ status: e.target.value, page: 1 })}
                style={selectStyle}
              >
                <option value="OPEN">Abertas</option>
                <option value="CLOSED">Encerradas</option>
                <option value="ALL">Todas</option>
              </select>
            </div>

            <div style={{ flex: '0 1 170px', minWidth: '150px' }}>
              <select
                aria-label="Prazo"
                value={deadlinePreset}
                onChange={(e) => handleDeadlineChange(e.target.value)}
                style={selectStyle}
              >
                <option value="any">Prazo: qualquer</option>
                <option value="7">Encerra em 7 dias</option>
                <option value="15">Encerra em 15 dias</option>
                <option value="30">Encerra em 30 dias</option>
              </select>
            </div>

            <div style={{ flex: '0 1 170px', minWidth: '150px' }}>
              <select
                aria-label="Modalidade"
                value={filters.modality || ''}
                onChange={(e) => onChange({ modality: e.target.value, page: 1 })}
                style={selectStyle}
              >
                <option value="">Modalidade: todas</option>
                <option value="Pregão">Pregão</option>
                <option value="Concorrência">Concorrência</option>
                <option value="Dispensa">Dispensa</option>
                <option value="Tomada de Preços">Tomada de Preços</option>
                <option value="Credenciamento">Credenciamento</option>
                <option value="Leilão">Leilão</option>
                <option value="Inexigibilidade">Inexigibilidade</option>
              </select>
            </div>

            <div style={{ flex: '0 1 170px', minWidth: '150px' }}>
              <select
                aria-label="Confiança"
                value={filters.minScore !== undefined ? String(filters.minScore) : ''}
                onChange={(e) => onChange({ minScore: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
                style={selectStyle}
              >
                <option value="">Confiança: qualquer</option>
                <option value="4">Alta (score ≥ 4)</option>
                <option value="6">Máxima (score ≥ 6)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '280px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <MoneyField
              label="Valor mín."
              placeholder="R$ mín."
              value={minVal}
              extenso={minExtenso}
              onValue={(n) => onChange({ minValue: n, page: 1 })}
            />
            <MoneyField
              label="Valor máx."
              placeholder="R$ máx."
              value={maxVal}
              extenso={maxExtenso}
              onValue={(n) => onChange({ maxValue: n, page: 1 })}
            />
          </div>
          {rangeInvalid && (
            <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 500 }}>
              Mínimo maior que máximo
            </span>
          )}
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
      ? 'var(--brand-primary-subtle)'
      : hovered
        ? 'var(--bg-surface-hover)'
        : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: active ? 600 : 500,
    textAlign: 'left',
    cursor: 'pointer',
  };
}

function MoneyField({
  label,
  placeholder,
  value,
  extenso,
  onValue,
}: {
  label: string;
  placeholder: string;
  value?: number;
  extenso: string;
  onValue: (n: number | undefined) => void;
}) {
  return (
    <label style={{ flex: 1, minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={value !== undefined ? String(value) : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          onValue(digits ? Number(digits) : undefined);
        }}
        style={{
          width: '100%',
          padding: '8px 10px',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          outline: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      />
      <span
        style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          lineHeight: 1.3,
          minHeight: '1.3em',
        }}
      >
        {extenso || '\u00a0'}
      </span>
    </label>
  );
}
