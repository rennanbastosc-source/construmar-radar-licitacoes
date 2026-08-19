---
type: project
created: 2026-05-25
updated: 2026-07-12
---

# Project Conventions

## Git Workflow & Deploy (STRICT P0)
- **NUNCA FAZER COMMIT, PUSH OU DEPLOY SEM ORDEM EXPRESSA:** É terminantemente proibido executar `git commit`, `git push` ou acionar pipelines de deploy/produção a menos que o usuário dê a ordem explícita no prompt (ex: "faça o commit e push"). Salvar, criar ou editar arquivos locais NUNCA autoriza commit/push automático.
- Always create a new dedicated branch for major code changes.
- Branch name format should follow: `feature/[task-slug]` or `fix/[bug-slug]`.

## Supported AI platforms (AG Kit)
- AG Kit **only supports Gemini CLI and Google Antigravity**.
- Do not claim compatibility with Claude Code, Cursor, Copilot, Windsurf, or other assistants unless the user explicitly expands scope.
- Copy on the website, docs, FAQ, README, and marketing should describe AG Kit as a toolkit for Gemini CLI / Antigravity-style agent setups.

## 🛡️ Guardrails de Orçamentação & SEOBRA (Crítico)
- **Imutabilidade de Registros Existentes:** NUNCA editar, sobrescrever ou alterar nenhum edital/orçamento previamente existente no SEOBRA ou no banco de dados.
- **Apenas Novas Criações:** O robô do SEOBRA está estritamente restrito a CRIAR novos orçamentos a partir de novos editais/planilhas, gerando identificadores únicos.
