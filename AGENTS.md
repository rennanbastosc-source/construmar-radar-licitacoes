# AGENTS.md

Contrato compartilhado de trabalho para agentes neste repositório (**CONSTRUMAR — Radar de Licitações & Orçamentação Inteligente**).

---

## 1. Contrato de trabalho & Regra de Ouro (P0)

- 🚨 **NUNCA INICIE COMMIT, PUSH OU DEPLOY SEM ORDEM EXPRESSA E LITERAL DO USUÁRIO NO PROMPT.** Salvar, editar, testar ou auditar arquivos locais NÃO autoriza `git commit` ou `git push`. Apenas execute commit/push quando o usuário pedir explicitamente (ex: "faça o commit e push").
- Respeite o escopo explícito do usuário, inclusive modo somente leitura, sem edição, sem commit ou sem push.
- Explore o código e os padrões relevantes antes de editar.
- Responda em **PT-BR** por padrão, salvo pedido contrário.

---

## 2. Método comportamental

- **Pensar antes:** pergunte só quando a ambiguidade puder mudar escopo, segurança, dados ou comportamento; caso contrário, declare a suposição.
- **Simplicidade:** não adicione abstração, dependência ou configuração sem necessidade demonstrável.
- **Mudança cirúrgica:** preserve alterações não relacionadas, limite o diff ao objetivo e remova apenas órfãos criados pela própria mudança.
- **Execução verificável:** defina checagem proporcional ao impacto e não afirme conclusão sem evidência atual.
- Se uma checagem falhar, faça uma correção direcionada; se falhar de novo, pare e reporte o estado real.

Não exija pergunta para toda tarefa, TDD universal, planejamento formal para alterações triviais ou paralelismo desnecessário.

---

## 3. Fatos estáveis e comandos

- **Stack Frontend:** Next.js 16 (App Router / Turbopack), React 19, TypeScript 7, Tailwind CSS, Lucide Icons.
- **Stack Backend:** Go (Golang 1.22+), SQLite (`radar.db`), REST API nativa, PNCP Scraper & Integrador SEOBRA.
- **Identidade Visual:** `DESIGN.md` e `MANUAL_IDENTIDADE_VISUAL.md` (Azul Oceano `#0A2540`, Marinho `#144272`, Laranja Ação `#F26419`, Ciano Técnico `#0EA5E9`).
- **Deploy:** Render (`render.yaml` — Backend Go Web Service + Frontend Next.js).
- **CI/CD & Dependências:** `.github/workflows/` (deploy) e `.github/dependabot.yml` (atualização semanal de deps).

### Comandos de Desenvolvimento

```bash
# Frontend (diretório ./frontend)
cd frontend
npm run dev              # Dev server Next.js (porta 3000)
npm run build            # Build de produção com Turbopack
npm run lint             # Typecheck estático via tsc --noEmit

# Backend (diretório ./backend)
cd backend
go run main.go           # Executa API Go e sincronizador local (porta 8080)
go build -o radar-backend main.go # Compila binário de produção
```

Versões exatas de pacotes ficam em `frontend/package.json` e `backend/go.mod`.

---

## 4. Invariantes do domínio CONSTRUMAR

- **Empresa & Governança Oficial:**
  - **Razão Social:** `CONSTRUMAR LOCAÇÕES E SERVIÇOS LTDA`
  - **CNPJ:** `03.795.674/0001-18` (Fortaleza - CE)
  - **Contatos Oficiais:** WhatsApp `(85) 98586-0730` | E-mail: `construmarlocacoes@gmail.com`
  - **Sócio-Proprietário:** `ADILSON GOIS DOS SANTOS` — CPF: `004.642.153-07`
  - **Responsável Técnico:** `JOSE EDVAR FERREIRA DE SOUZA` — CREA nº `MG 20741 D` (Engenheiro Civil)

- **Radar de Licitações (PNCP):**
  - Monitoramento prioritário no Estado do Ceará (`UF=CE`).
  - Filtro padrão para propostas abertas (`status=OPEN`) e valor total estimado $\ge$ `R$ 900.000,00`.
  - Classificação de Escopo Determinística:
    - `IN_SCOPE` (Obras Civis, Pavimentação Asfáltica, Drenagem, Terraplenagem, Contenção de Encostas, Locação de Andaimes e Máquinas Pesadas, Construção Predial).
    - `REVIEW` (Termos complementares de infraestrutura e serviços que exigem validação técnica).
    - `OUT_OF_SCOPE` (Fornecimento de materiais de escritório, gêneros alimentícios, TI não relacionada, etc.).

- **Orçamentação com IA & SEOBRA:**
  - Extração inteligente de editais em PDF (digital ou OCR escaneado), imagens e planilhas `.xlsx`.
  - Mapeamento determinístico de itens para bases SINAPI/SICRO/SEOBRA com cálculo de BDI e quantitativos.

- **Documentos & Papel Timbrado Oficial:**
  - Modelos em HTML, `.docx` e PDF com cabeçalho vetorizado oficial, rodapé com dados societários e de responsabilidade técnica, e campos padronizados de assinatura.

- **Design System:**
  - `DESIGN.md` é a fonte visual única. Tipografia: Títulos em `Montserrat`, corpo em `Inter`, valores financeiros e códigos em `JetBrains Mono`.

---

## 5. Memória e progressive disclosure

- Leia `DESIGN.md` em tarefas de UI/UX ou componentes visuais.
- Leia `MANUAL_IDENTIDADE_VISUAL.md` para padrões gráficos e timbrados oficiais.
- Adicione regra a este arquivo só após erro recorrente ou descoberta estável que evite falha futura.

---

## 6. Ferramentas de busca e memória (uso balanceado)

- **`codebase-memory-mcp` (Knowledge Graph / AST):** Prioridade para entender estrutura e arquitetura, rastrear chamadas (`trace_path`), consultar símbolos/rotas e mapear impacto entre arquivos.
- **`grep_search` (Ripgrep nativo):** Prioridade para termos literais, mensagens de erro, classes CSS/Tailwind, strings de rota, configs/env e arquivos não estruturados.
- **`claude-mem`:** Prioridade para resgatar histórico de decisões de sessões passadas, contexto de conversas anteriores e busca semântica em corpus.

---

## 7. Validação visual obrigatória na UI

- **Regra:** Sempre que houver implementação, alteração ou correção em telas, páginas, componentes, formulários, modais, toasts ou fluxos de interface (UI/UX):
  1. Inicie o dev server (`npm run dev`) se não estiver ativo.
  2. Capture screenshots reais via Chromium headless contra `http://localhost:3000`.
  3. Realize auto-auditoria visual via `view_file` para verificar alinhamentos, contraste, fidelidade às regras do `DESIGN.md`, responsividade e ausência de quebras.
  4. Anexe as capturas de tela diretamente no chat com link Markdown `![Descrição](file:///caminho/absoluto/screenshot.png)` acompanhadas de um resumo visual na entrega da tarefa.

---

## 8. Guardrails de Qualidade, Contratos & Hardening (Execution Harness v5 — Reflective Loop)

Todo agente ou modelo DEVE executar obrigatoriamente o **Loop Reflexivo de 4 Etapas** antes de considerar qualquer tarefa de código concluída:

### 🔄 O Loop de Auto-Questionamento Obrigatório
1. **Fase 1 (Draft/Implementação):** Aplicação cirúrgica das alterações solicitadas com rigor arquitetural.
2. **Fase 2 (O Ataque do Adversário — 5 Perguntas):**
   - **Q1 (Falha de Rede/API/Cold-Start):** Se a API Go ou PNCP der 403/500/cold-start ou cair a rede, a tela explode, mente exibindo "0 itens / Tudo em dia" ou renderiza tabela vazia debaixo do erro? *(Exige timeout rápido com `AbortSignal.timeout`, ocultação sob erro + card explicativo + retry resiliente)*.
   - **Q2 (Auditoria de Escopo Cruzado):** Outros arquivos do mesmo diff ou fluxos análogos da aplicação (ex.: Dashboard, Orçamentos, Sincronização) possuem o mesmo vício? *(Exige busca e correção em lote)*.
   - **Q3 (Comportamento de Filtros & Triggers):** Inputs de pesquisa disparam requisições a cada caractere digitado? *(Exige buffer local + botão de submit/Enter explícito)*.
   - **Q4 (Tetos & Sanitização):** Todas as queries e buscas têm limites seguros? Filtros monetários validam teto mínimo e máximo?
   - **Q5 (Resiliência Assíncrona & Tipografia Mobile):** Todas as mutações usam `try / catch / finally` para liberar estados de carregamento? Todos os inputs móveis usam `text-base md:text-sm` (16px base) para evitar auto-zoom no Safari iOS?
3. **Fase 3 (Rodada de Refinamento):** Se qualquer pergunta revelar um gap ou inconsistência, corrija os arquivos imediatamente antes de prosseguir.
4. **Fase 4 (Verificação Verificável):** Passagem obrigatória em `npm run lint` (`tsc --noEmit`), `npm run build` (0 erros) e inspeção visual antes de responder.
