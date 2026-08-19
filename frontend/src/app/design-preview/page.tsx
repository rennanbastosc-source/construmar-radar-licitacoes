'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Search,
  ChevronRight,
  ArrowRight,
  Radio,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Building,
  Zap,
} from 'lucide-react';

export default function WishlabsDesignShowcase() {
  const [filterTab, setFilterTab] = useState<'ALL' | 'IN_SCOPE' | 'REVIEW' | 'URGENT'>('ALL');

  return (
    <div
      style={{
        backgroundColor: '#0E0E10',
        color: '#F4F4F6',
        minHeight: '100vh',
        fontFamily: "'DM Sans', 'Inter', -apple-system, sans-serif",
        backgroundImage:
          'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(192, 255, 115, 0.08), transparent 60%), radial-gradient(circle at 90% 20%, rgba(56, 189, 248, 0.05), transparent 40%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Top Bar / Navigation (Wishlabs Style) */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(14, 14, 16, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '0 32px',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            height: '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
          }}
        >
          {/* Logo & Brand Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  backgroundColor: '#C0FF73',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(192, 255, 115, 0.35)',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    backgroundColor: '#0E0E10',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ color: '#C0FF73', fontSize: '12px', fontWeight: 900 }}>C</span>
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                    color: '#FFFFFF',
                  }}
                >
                  CONSTRU<span style={{ color: '#C0FF73' }}>MAR</span>
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#8E8E93',
                    display: 'block',
                    fontWeight: 500,
                  }}
                >
                  Radar & Orçamentação IA
                </span>
              </div>
            </Link>

            {/* Navigation Pills */}
            <nav
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '4px',
                borderRadius: '9999px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {[
                { label: 'Radar PNCP', active: true },
                { label: 'Orçamentos SEOBRA', active: false },
                { label: 'Analista de Editais', active: false },
                { label: 'Sincronizador', active: false },
              ].map((tab) => (
                <span
                  key={tab.label}
                  style={{
                    fontSize: '13px',
                    fontWeight: tab.active ? 700 : 500,
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    backgroundColor: tab.active ? '#1E1E22' : 'transparent',
                    color: tab.active ? '#FFFFFF' : '#8E8E93',
                    border: tab.active ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </span>
              ))}
            </nav>
          </div>

          {/* Right Action & Live Pulse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(192, 255, 115, 0.1)',
                border: '1px solid rgba(192, 255, 115, 0.25)',
                color: '#C0FF73',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#C0FF73',
                  boxShadow: '0 0 10px #C0FF73',
                }}
              />
              <span>PNCP Ceará Ao Vivo</span>
            </div>

            <button
              style={{
                padding: '9px 18px',
                borderRadius: '9999px',
                backgroundColor: '#C0FF73',
                color: '#0E0E10',
                border: 'none',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(192, 255, 115, 0.25)',
              }}
            >
              <Sparkles size={15} />
              <span>Orçar com IA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 32px 80px' }}>
        {/* Style Tag / Header Banner */}
        <div style={{ marginBottom: '36px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '11px',
              fontWeight: 700,
              color: '#C0FF73',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#C0FF73' }} />
            <span>Wishlabs Inspired • Modern High-End Dark UI</span>
          </div>

          <h1
            style={{
              fontSize: '36px',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              color: '#FFFFFF',
              lineHeight: 1.15,
              maxWidth: '850px',
            }}
          >
            Inteligência de Licitações & Orçamentação{' '}
            <span
              style={{
                fontStyle: 'italic',
                fontWeight: 600,
                color: '#C0FF73',
              }}
            >
              SEOBRA
            </span>
          </h1>
          <p style={{ fontSize: '15px', color: '#8E8E93', marginTop: '8px', maxWidth: '640px' }}>
            Monitoramento determinístico no Portal Nacional de Contratações Públicas com classificação técnica automática.
          </p>
        </div>

        {/* BENTO CARDS KPI SECTION (Wishlabs Aesthetic) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {/* Card 1: Featured Pipeline (Col 1-5) */}
          <div
            style={{
              gridColumn: 'span 5',
              backgroundColor: '#161618',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: 'rgba(192, 255, 115, 0.1)',
                filter: 'blur(30px)',
                pointerEvents: 'none',
              }}
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#8E8E93' }}>Volume em Aberto</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(192, 255, 115, 0.15)',
                    color: '#C0FF73',
                  }}
                >
                  PIPELINE CE
                </span>
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '32px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '-0.04em',
                }}
              >
                R$ 48.920.000,00
              </div>
            </div>

            <div
              style={{
                fontSize: '12.5px',
                color: '#8E8E93',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                marginTop: '16px',
              }}
            >
              Soma total de 34 oportunidades &ge; R$ 900k no Ceará
            </div>
          </div>

          {/* Card 2: Escopo Direto (Col 6-8) */}
          <div
            style={{
              gridColumn: 'span 3',
              backgroundColor: '#161618',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#8E8E93' }}>Escopo Construmar</span>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(192, 255, 115, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#C0FF73',
                  }}
                >
                  <Check size={16} />
                </div>
              </div>
              <div
                style={{
                  fontSize: '34px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '-0.04em',
                }}
              >
                18
              </div>
            </div>
            <div style={{ fontSize: '12.5px', color: '#C0FF73', fontWeight: 600 }}>
              Alta aderência técnica
            </div>
          </div>

          {/* Card 3: Revisão (Col 9-10) */}
          <div
            style={{
              gridColumn: 'span 2',
              backgroundColor: '#161618',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#8E8E93' }}>Revisão</span>
                <AlertTriangle size={16} color="#F59E0B" />
              </div>
              <div
                style={{
                  fontSize: '34px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '-0.04em',
                }}
              >
                16
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#F59E0B', fontWeight: 600 }}>
              Análise necessária
            </div>
          </div>

          {/* Card 4: Urgentes (Col 11-12) */}
          <div
            style={{
              gridColumn: 'span 2',
              backgroundColor: '#161618',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#8E8E93' }}>Críticos</span>
                <Clock size={16} color="#FF81B2" />
              </div>
              <div
                style={{
                  fontSize: '34px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '-0.04em',
                }}
              >
                4
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#FF81B2', fontWeight: 600 }}>
              Encerram em &le; 72h
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div
          style={{
            backgroundColor: '#161618',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          {/* Quick Filter Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'ALL', label: 'Todas Oportunidades' },
              { id: 'IN_SCOPE', label: 'Escopo Direto' },
              { id: 'REVIEW', label: 'Revisão Técnica' },
              { id: 'URGENT', label: 'Prazos Curtos' },
            ].map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id as any)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '9999px',
                    fontSize: '12.5px',
                    fontWeight: active ? 700 : 500,
                    backgroundColor: active ? 'rgba(192, 255, 115, 0.15)' : 'transparent',
                    color: active ? '#C0FF73' : '#8E8E93',
                    border: active ? '1px solid rgba(192, 255, 115, 0.3)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Box with clean minimal style */}
          <div style={{ position: 'relative', width: '340px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#8E8E93',
              }}
            />
            <input
              type="text"
              placeholder="Buscar por objeto, órgão ou município..."
              defaultValue="Pavimentação Asfáltica Maracanaú"
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: '#101012',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '9999px',
                paddingLeft: '38px',
                paddingRight: '16px',
                color: '#FFFFFF',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* MODERN WISHLABS OPPORTUNITY TABLE */}
        <div
          style={{
            backgroundColor: '#161618',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#8E8E93',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '16px 24px', width: '25%' }}>Órgão Licitante</th>
                <th style={{ padding: '16px 24px', width: '38%' }}>Objeto & Tags</th>
                <th style={{ padding: '16px 24px', width: '12%' }}>Classificação</th>
                <th style={{ padding: '16px 24px', width: '13%', textAlign: 'right' }}>Valor Estimado</th>
                <th style={{ padding: '16px 24px', width: '12%', textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1 */}
              <tr
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <td style={{ padding: '20px 24px', verticalAlign: 'middle' }}>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '14px' }}>SEINFRA CEARÁ</div>
                  <div style={{ fontSize: '12px', color: '#8E8E93', marginTop: '2px' }}>
                    Maracanaú/CE • Concorrência 042/26
                  </div>
                </td>
                <td style={{ padding: '20px 24px', verticalAlign: 'middle' }}>
                  <div style={{ color: '#E4E4E6', lineHeight: 1.45, fontWeight: 500 }}>
                    Execução de obras de urbanização, terraplenagem, drenagem e pavimentação asfáltica no Polo Industrial.
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {['PAVIMENTAÇÃO', 'DRENAGEM', 'TERRAPLENAGEM'].map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '10px',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: '#A1A1AA',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '20px 24px', verticalAlign: 'middle' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(192, 255, 115, 0.12)',
                      color: '#C0FF73',
                      border: '1px solid rgba(192, 255, 115, 0.3)',
                    }}
                  >
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#C0FF73' }} />
                    <span>IN_SCOPE 9.0</span>
                  </span>
                </td>
                <td style={{ padding: '20px 24px', verticalAlign: 'middle', textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    R$ 14.580.000,00
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#C0FF73', marginTop: '2px', fontWeight: 600 }}>
                    Restam 12 dias
                  </div>
                </td>
                <td style={{ padding: '20px 24px', verticalAlign: 'middle', textAlign: 'right' }}>
                  <button
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Inspecionar</span>
                    <ChevronRight size={14} />
                  </button>
                </td>
              </tr>

              {/* Row 2 */}
              <tr
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  backgroundColor: 'rgba(255, 255, 255, 0.01)',
                }}
              >
                <td style={{ padding: '20px 24px', verticalAlign: 'middle' }}>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '14px' }}>PREFEITURA DE FORTALEZA</div>
                  <div style={{ fontSize: '12px', color: '#8E8E93', marginTop: '2px' }}>
                    Fortaleza/CE • Pregão SRP 118/26
                  </div>
                </td>
                <td style={{ padding: '20px 24px', verticalAlign: 'middle' }}>
                  <div style={{ color: '#E4E4E6', lineHeight: 1.45, fontWeight: 500 }}>
                    Registro de preços para locação de andaimes tubulares, betoneiras e máquinas pesadas para manutenção
                    predial.
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {['LOCAÇÃO DE MÁQUINAS', 'ANDAIMES'].map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '10px',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: '#A1A1AA',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '20px 24px', verticalAlign: 'middle' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(192, 255, 115, 0.12)',
                      color: '#C0FF73',
                      border: '1px solid rgba(192, 255, 115, 0.3)',
                    }}
                  >
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#C0FF73' }} />
                    <span>IN_SCOPE 8.5</span>
                  </span>
                </td>
                <td style={{ padding: '20px 24px', verticalAlign: 'middle', textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    R$ 3.890.000,00
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#FF81B2', marginTop: '2px', fontWeight: 700 }}>
                    Encerra em 72h
                  </div>
                </td>
                <td style={{ padding: '20px 24px', verticalAlign: 'middle', textAlign: 'right' }}>
                  <button
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Inspecionar</span>
                    <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
