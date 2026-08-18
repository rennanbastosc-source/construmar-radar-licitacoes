# Design System & Token Specification — CONSTRUMAR Radar

Design tokens and UI guidelines for **CONSTRUMAR Locações e Serviços LTDA** Radar de Licitações & Orçamentação Inteligente com SEOBRA.

---

## 🎨 Color Palette & Tokens

| Token | HEX / Value | Role & Usage |
|---|---|---|
| `--color-brand-ocean` | `#0A2540` | Cor primária institucional nobre. Cabeçalhos e barras de navegação. |
| `--color-brand-navy` | `#144272` | Azul corporativo médio. Superfícies de cartões e gradientes. |
| `--color-brand-orange` | `#F26419` | Laranja construtivo de ação e destaque. Botões primários e chamadas de ação. |
| `--color-brand-cyan` | `#0EA5E9` | Azul técnico. Badges de engenharia, conexões ativas e links em foco. |
| `--color-bg-base` | `#0b1320` | Fundo principal da aplicação (Dark Theme Industrial de Alta Legibilidade). |
| `--color-bg-surface` | `#111c2e` | Fundo de cartões, formulários e painéis de dados. |
| `--color-bg-surface-elevated` | `#1a2b44` | Fundo de modais, menus suspensos e linhas em hover. |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.08)` | Bordas discretas e divisórias. |
| `--color-border-accent` | `rgba(14, 165, 233, 0.3)` | Bordas ativas e caixas de seleção. |
| `--color-text-primary` | `#f8fafc` | Texto principal e títulos. |
| `--color-text-secondary` | `#94a3b8` | Textos de apoio, descrições e legendas. |
| `--color-text-muted` | `#64748b` | Metadados terciários e datas. |
| `--color-confidence-high` | `#10b981` | Alta confiança da IA (>90%) — Verde Esmeralda. |
| `--color-confidence-med` | `#f59e0b` | Confiança média da IA (70–89%) — Amarelo Alerta. |
| `--color-confidence-low` | `#ef4444` | Baixa confiança da IA (<70%) — Vermelho Atenção. |

---

## 🔤 Typography

- **Headings & Display:** `Montserrat`, -apple-system, sans-serif (Weights: 600, 700, 800)
- **Body & Data Grids:** `Inter`, -apple-system, sans-serif (Weights: 400, 500, 600)
- **Numeric & Financial Tables:** `JetBrains Mono` / `ui-monospace`, monospace (Tabular figures para alinhamento perfeito de valores monetários e quantitativos).

---

## 📐 Spacing, Radius & Geometry

- **Border Radius:**
  - `radius-sm`: `4px` (Tags e Badges)
  - `radius-md`: `8px` (Inputs e Botões)
  - `radius-lg`: `12px` (Cards e Painéis de Tabela)
  - `radius-xl`: `16px` (Modais e Hub de Upload)
- **Grid Layout:** 12-column responsive layout com `max-width: 1400px`.
