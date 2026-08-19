# STATE.md — Memória Persistente do Projeto CONSTRUMAR

> **Documento Oficial de Estado, Invariantes e Nuances Arquiteturais**  
> Repositório: `CONSTRUMAR — Radar de Licitações & Orçamentação Inteligente`  
> Última atualização: 19/08/2026

---

## 1. Visão Geral & Dados de Domínio

### 1.1 Identidade Corporativa
- **Razão Social:** `CONSTRUMAR LOCAÇÕES E SERVIÇOS LTDA`
- **CNPJ:** `03.795.674/0001-18` (Fortaleza - CE)
- **Contatos Oficiais:** WhatsApp `(85) 98586-0730` | E-mail: `construmarlocacoes@gmail.com`
- **Sócio-Proprietário:** `ADILSON GOIS DOS SANTOS` — CPF: `004.642.153-07`
- **Responsável Técnico:** `JOSE EDVAR FERREIRA DE SOUZA` — CREA nº `MG 20741 D` (Engenheiro Civil)

### 1.2 Stack Tecnológica
- **Backend:** Go (Golang 1.25+), SQLite local (`radar.db`) / Turso LibSQL serverless em produção (`libsql://...`), Router `chi`, Scraper PNCP, Motor Multimodal Gemini Vision, Integrador Web SEOBRA.
- **Frontend:** Next.js 16 (App Router / Turbopack), React 19, TypeScript 7, Tailwind CSS, Lucide Icons.
- **Design System:** Wishlabs Dark Obsidian (`#0E0E10`), Superfícies em Veludo Grafite (`#161618`), Volt Lime (`#C0FF73`), Neon Coral (`#FF81B2`), Ciano Técnico (`#38BDF8`), controles em cápsula (`border-radius: 9999px`), tipografia `DM Sans` + `JetBrains Mono` com números tabulares.
- **Deploy:** Render (`render.yaml` — Backend Web Service Go + Frontend Web Service Next.js).

---

## 2. Invariantes Arquiteturais & Regras Anti-Regressão (P0)

### 🚨 2.1 PROIBIÇÃO ABSOLUTA DE DADOS MOCKADOS / FALLBACKS FICTÍCIOS
- **Regra:** NUNCA utilize dados mockados (`SAMPLE_OPPORTUNITIES`, `SAMPLE_HISTORY`, `SAMPLE_EDITAIS`, etc.) em estados iniciais, componentes ou blocos `catch` de requisições.
- **Motivação:** Na semana de 18-19/08/2026, a reintrodução acidental de 3 itens de exemplo mascarou erros reais de timeout e rate-limit do PNCP, fazendo a UI mentir com status de sucesso.
- **Comportamento Obrigatório:**
  - Estados de lista devem iniciar como `[]` e estados de detalhe como `null`.
  - Em caso de erro de rede, 500, 403, 429 ou cold-start, o frontend DEVE ocultar os componentes de listagem e exibir o componente `ErrorState` com a mensagem técnica real e o botão de retry.
  - A tabela vazia só deve ser exibida quando a consulta à API retornar sucesso com `0` registros legítimos.

---

### 🌐 2.2 Portal Nacional de Contratações Públicas (PNCP) & Sincronização
- **Filtros Padrão de Negócio:**
  - Estado: `UF=CE` (Ceará prioritário).
  - Status: `status=OPEN` (propostas em fase de acolhimento).
  - Valor Estimado Mínimo: $\ge$ `R$ 900.000,00`.
- **Nuances do Servidor PNCP:**
  - O PNCP (`https://pncp.gov.br/api/consulta`) possui WAF com limite de taxa rígido (~16 requisições/minuto). Exceder gera HTTP `429 Too Many Requests`.
  - A API pública frequentemente sofre com alta latência e instabilidades temporárias (HTTP `503 Service Unavailable` ou timeouts de conexão).
  - O cliente Go (`pncp/client.go`) implementa retentativas com backoff exponencial (3 tentativas) e timeout tolerante de 60s (15s para o health-check).
  - Entre cada página durante o sync, há um `time.Sleep(2 * time.Second)` mandatório para evitar bloqueio por WAF.
- **Polling de Status no Frontend:**
  - O disparo da sincronização manual (`POST /api/licitacoes/sync`) inicia uma rotina em background.
  - O frontend executa polling ativo a cada 3s via `fetchSyncStatus()` até `isRunning === false`, exibindo o feedback preciso do lote (`SUCCESS`, `PARTIAL` ou `FAILED` com mensagem de erro).

---

### 💾 2.3 Banco de Dados & Concorrência (SQLite & Turso LibSQL)
- **Persistência Multi-Deploy:**
  - Em produção (Render), o backend se conecta ao Turso LibSQL Serverless via string `libsql://...` com `authToken`, mantendo o histórico de sincronizações e orçamentos persistido entre deploys e reinicializações de instâncias efêmeras.
  - Em desenvolvimento local, utiliza o arquivo `radar.db`.
- **Prevenção de Locks (`database is locked`):**
  - O pool de conexões SQLite/LibSQL é configurado com `db.SetMaxOpenConns(1)` e modo WAL (`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;`) para garantir serialização atômica de escritas.
- **Deduplicação de Licitações:**
  - As licitações são normalizadas e deduplicadas por `CNPJ + Número de Processo` (`source_external_id`), evitando duplicidades geradas por retificações e republicações no PNCP.
- **Limpeza Automática (Soft-Delete / Arquivamento):**
  - O scheduler diário (12:00 PM UTC-3) e as sincronizações de sucesso executam `SoftDeleteOldOpportunities` para arquivar automaticamente registros não atualizados nas últimas 36 horas ou com prazo de propostas encerrado.

---

### 🤖 2.4 Módulo de Orçamentação com IA & SEOBRA
- **Entrada Multimodal:**
  - Suporte a PDF digital, PDF escaneado (OCR integrado), planilhas Excel (`.xlsx`, `.xls`) e imagens (`.png`, `.jpg`, `.jpeg`).
- **Prevenção de Out-Of-Memory (Anti-OOM):**
  - Na leitura de planilhas Excel grandes, o backend utiliza o iterador de streaming `excelize.Rows()` em vez de carregar a planilha inteira na memória.
- **Mapeamento & Despacho SEOBRA:**
  - Mapeamento determinístico de itens e composições para bases SINAPI / SICRO / SEOBRA.
  - Cálculo paramétrico de BDI (padrão 25%) com suporte a descontos diferenciados para mão de obra e materiais.
  - Automação de sessão autenticada com o sistema SEOBRA Ceará para criação de pastas de obra e despacho direto.

---

### ⚖️ 2.5 Analista IA de Editais (Lei nº 14.133/2021)
- **Fusão de Múltiplos Arquivos:**
  - O módulo aceita upload conjunto de Edital + Termo de Referência + Anexos Técnicos, fundindo o contexto em uma única esteira de raciocínio.
- **Detecção de Pegadinhas:**
  - Identificação de cláusulas com armadilhas (prazos exíguos de vistoria técnica, exigências ilegais ou restritivas, cláusulas de desclassificação automática).
- **Qualificação Técnica & Checklist:**
  - Mapeamento de parcelas de maior relevância e quantitativos mínimos de atestados (CAT/ART com limite de 50%).
  - Geração de checklist interativo de habilitação com persistência individual de status por item (`toggleEditalChecklist`).

---

### 🔒 2.6 Segurança & Headers
- **Autenticação:** Todas as rotas `/api/*` exigem Bearer Token (`API_AUTH_TOKEN`). O frontend injeta via `NEXT_PUBLIC_API_AUTH_TOKEN`.
- **CORS Lockdown:** `CORS_ALLOWED_ORIGINS` deve conter origens explícitas (ex.: `http://localhost:3000,https://construmar-radar.onrender.com`). Proibido uso de wildcard `*`.
- **Validação de Uploads:** Validação de tamanho máximo (32MB) e magic bytes no servidor Go.

---

## 3. Linha do Tempo e Evolução dos Commits (Semana 17 a 19 de Agosto de 2026)

| Hash | Data | Escopo | Descrição do Commit e Impacto |
| :--- | :--- | :--- | :--- |
| `8582a5b` | 17/08 | `MVP` | Criação da base do Radar de Licitações (Go backend + Next.js frontend + SQLite). |
| `e14bfd3` | 17/08 | `Backend` | Deduplicação de licitações por `CNPJ + Processo` normalizado. |
| `09acfe2` | 17/08 | `CORS` | Ajuste de CORS sem wildcard para suporte a credentials e fontes Next.js. |
| `2925827` | 17/08 | `CI/CD` | Configuração de deploy automático no Render via GitHub Actions. |
| `0e5aa08` | 18/08 | `Frontend` | Adição de combobox de municípios cearenses e filtro com exibição monetária por extenso. |
| `ce29c81` | 18/08 | `Filtros` | Filtros de escopo (Status, Presets de Prazo 7/15/30 dias, Modalidade, Termos). |
| `04920bf` | 18/08 | `Frontend` | Armazenamento da chave do preset de prazo no estado sem engenharia reversa de datas. |
| `1d10498` | 18/08 | `Orçamentos` | Módulo de Orçamentação Inteligente com IA e integração SEOBRA. |
| `f3b69d8` | 18/08 | `Segurança` | Hardening de segurança: Bearer Auth, CORS lockdown, validação de boot e upload. |
| `2070d86` | 18/08 | `PNCP` | Aumento do timeout de health-check do PNCP de 5s para 15s para tolerar lentidão do órgão. |
| `685d161` | 18/08 | `Editais` | Módulo Analista de Editais: parser multimodal PDF/Imagem e detector de pegadinhas. |
| `f6f8c02` | 18/08 | `IA Benchmark`| Benchmark estatístico de 5-shot no edital de Parambu/CE garantindo consistência. |
| `9e516d8` | 18/08 | `IA Benchmark`| Benchmark estatístico de 5-shot no edital de Baixio/CE. |
| `38d5f9d` | 18/08 | `Editais` | Ingestão multi-arquivo com fusão de raciocínio cross-document. |
| `2dda0c8` | 19/08 | `IA Hardening`| Hardening de prompts 100% em PT-BR e resumo executivo unificado. |
| `1ed14c8` | 19/08 | `Concorrência`| SQLite `SetMaxOpenConns(1)`, rate limiter por IP e timeouts de 12s no cliente HTTP. |
| `143783c` | 19/08 | `Banco Turso` | Integração do banco serverless Turso LibSQL para persistência permanente no Render. |
| `504d333` | 19/08 | `Scheduler` | Scheduler diário (12:00 PM UTC-3) e arquivamento automático de itens vencidos/antigos (>36h). |
| `2b2200a` | 19/08 | `Performance` | Leitura streaming de Excel (`excelize.Rows()`), context propagation e ping ativo em `/health`. |
| `18567a4` | 19/08 | `UI Wishlabs` | Redesign completo de 100% das telas no padrão Wishlabs (Dark Obsidian, Volt Lime, Cápsulas). |
| `76dbcee` | 19/08 | `Anti-Mock Fix`| **Eliminação definitiva de fallbacks mockados**, restabelecimento de polling em tempo real e exibição hermética de erros. |

---

## 4. Guia Rápido de Troubleshooting & Comandos

### 4.1 Comandos de Desenvolvimento
```bash
# Frontend (Next.js)
cd frontend
npm run dev              # Executa servidor local (http://localhost:3000)
npm run lint             # Verificação estática de tipos (tsc --noEmit)
npm run build            # Build de produção com Turbopack

# Backend (Go)
cd backend
go run main.go           # Inicia API Go na porta 8080
go build -o radar-backend main.go # Compilação do binário de produção
```

### 4.2 Verificação de Integridade no SQLite / Banco
```bash
# Verificar quantidade de oportunidades e histórico de execuções
sqlite3 backend/radar.db "SELECT count(*) FROM licitacao_oportunidade; SELECT count(*) FROM licitacao_sync_run;"

# Verificar os últimos erros registrados nas sincronizações do PNCP
sqlite3 backend/radar.db "SELECT started_at, status, total_received, error_message FROM licitacao_sync_run ORDER BY started_at DESC LIMIT 5;"
```

---

## 5. Checklist para Futuras Sessões e Agentes
1. [ ] Consultar `STATE.md` antes de efetuar alterações arquiteturais ou de integração.
2. [ ] Nunca adicionar dados mockados ou fakes para contornar falhas de backend.
3. [ ] Respeitar estritamente a paleta e tokens descritos em `DESIGN.md` e `MANUAL_IDENTIDADE_VISUAL.md`.
4. [ ] Garantir passagem com zero erros em `npm run lint` e `npm run build` antes de qualquer entrega.
