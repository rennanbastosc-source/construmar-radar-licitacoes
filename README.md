# Radar de Licitações — MVP PNCP (CONSTRUMAR)

Sistema de monitoramento contínuo e prospecção de oportunidades de licitações públicas com foco em obras, construção civil e engenharia no Estado do Ceará (CE) com valor estimado $\ge$ R$ 900.000,00, consumindo diretamente a API pública do Portal Nacional de Contratações Públicas (PNCP).

---

## 🏛️ Arquitetura do Sistema

```
CONSTRUMAR/
├── backend/                  # Backend em Go (Golang 1.25 / 1.23)
│   ├── cmd / main.go         # Ponto de entrada do servidor HTTP & Scheduler
│   └── internal/
│       ├── config/           # Variáveis de ambiente & configurações
│       ├── domain/           # Modelos de domínio (Oportunidades, Snapshots, Runs)
│       ├── pncp/             # Cliente HTTP resiliente PNCP com retries & backoff
│       ├── classifier/       # Motor determinístico de classificação e regras versionadas
│       ├── normalizer/       # Normalização de dados, fuso horário BRT e validação de valores
│       ├── repository/       # Persistência SQLite (modernc.org/sqlite) com transações ACID
│       ├── service/          # Pipeline de sincronização e regras de negócio
│       └── api/              # Handlers REST, CORS e roteador Chi
└── frontend/                 # Frontend em Next.js 15 (React 19 + TypeScript)
    └── src/
        ├── app/
        │   ├── page.tsx                  # Dashboard principal do Radar
        │   ├── licitacoes/[id]/page.tsx  # Detalhes da oportunidade & evidências
        │   └── sync/page.tsx             # Histórico operacional de sincronizações
        ├── components/                   # Componentes de UI (Header, Stats, Filters, Table, Badges)
        ├── lib/                          # Cliente API, Tipos TypeScript e Formatadores
        └── styles/                       # Design System CSS (Construmar Navy, Slate & Gold)
```

---

## 🚀 Como Executar Localmente

### 1. Iniciar o Backend em Go

```bash
cd backend
$HOME/.local/go/bin/go run main.go
```
*O backend inicializará a API em `http://localhost:8080` e criará automaticamente o banco SQLite `radar.db`.*

### 2. Iniciar o Frontend em Next.js

```bash
cd frontend
npm run dev
```
*O frontend estará disponível em `http://localhost:3000`.*

---

## 🧪 Execução de Testes Automatizados

### Testes do Backend (Go):
```bash
cd backend
$HOME/.local/go/bin/go test -v ./...
```
Cobre:
- Classificador determinístico de obras e engenharia (regras positivas, secundárias e termos de exclusão).
- Normalização de dados do PNCP, validação de valores (conhecido, sigiloso, nulo) e conversão de datas BRT.
- Repositório SQLite, índices, deduplicação idempotente por `numeroControlePNCP` e persistência de snapshots.

### Build de Produção do Frontend (Next.js):
```bash
cd frontend
npm run build
```

---

## 📋 Endpoints da API Go (`http://localhost:8080`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/licitacoes/oportunidades` | Lista paginada com filtros (`uf`, `minValue`, `classification`, `search`, `municipality`) |
| `GET` | `/api/licitacoes/oportunidades/{id}` | Detalhes da oportunidade, auditoria do classificador e snapshots JSON |
| `GET` | `/api/licitacoes/stats` | Resumo de métricas (total no radar, em escopo, em revisão, volume financeiro) |
| `POST` | `/api/licitacoes/sync` | Dispara sincronização em segundo plano com o PNCP |
| `GET` | `/api/licitacoes/sync/status` | Status da sincronização atual e da última execução válida |
| `GET` | `/api/licitacoes/sync/history` | Histórico completo das execuções de sincronização |
| `GET` | `/health` | Verificação de integridade do serviço |
