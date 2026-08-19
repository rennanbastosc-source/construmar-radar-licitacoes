# Design System & Token Specification — CONSTRUMAR Radar & SEOBRA

Design system and token specifications inspired by **Wishlabs / Elena Perini** for **CONSTRUMAR Locações e Serviços LTDA**.

---

## 🎨 Color Palette & Tokens

| Token | HEX / Value | Role & Usage |
|---|---|---|
| `--bg-base` | `#0E0E10` | Fundo principal da aplicação (Dark Obsidian Profundo). |
| `--bg-surface` | `#161618` | Superfícies principais (Cards Bento, Painéis e Tabelas). |
| `--bg-surface-elevated` | `#1F1F23` | Superfícies elevadas, modais, drawers e dropdowns. |
| `--brand-primary` | `#C0FF73` | Volt Lime elétrico. Botões de ação, badges ativas e destaques em itálico. |
| `--brand-cyan` | `#38BDF8` | Ciano Técnico para tags e metadados. |
| `--status-inscope` | `#C0FF73` | Alta aderência / Escopo Construmar (Volt Lime). |
| `--status-review` | `#F59E0B` | Revisão técnica do engenheiro (Âmbar). |
| `--status-urgent` | `#FF81B2` | Vencimento crítico &le; 72h (Neon Coral). |
| `--text-primary` | `#FFFFFF` | Texto principal e títulos. |
| `--text-secondary` | `#8E8E93` | Apoio, subtítulos e descrições. |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Bordas nítidas de 1px. |

---

## 🔤 Typography

- **Headings & Display:** `DM Sans`, -apple-system, sans-serif (Weights: 700, 800, 900) com tracking `-0.04em` e ênfase expressiva em *itálico*.
- **Body & Controls:** `Inter` / `DM Sans`, sans-serif (Weights: 400, 500, 600).
- **Tabular Numerics & Financials:** `JetBrains Mono`, monospace com `tabular-nums` para alinhamento contábil e de quantitativos.

---

## 📐 Geometry & Controls

- **Border Radius:**
  - `radius-full`: `9999px` (Pills de Navegação, Botões CTAs, Chips de Filtros e Badges).
  - `radius-xl`: `20px` (Cards Bento e Painéis de Dados).
  - `radius-md`: `12px` (Logo, Sub-painéis e Inputs).
