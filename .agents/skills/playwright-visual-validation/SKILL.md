---
name: playwright-visual-validation
description: Executa a matriz E2E visual das telas protegidas com Chromium headless, captura screenshots reais e registra evidências em manifest.json.
when_to_use: "Obrigatoriamente após criar, alterar ou corrigir telas, páginas, componentes, formulários, modais, toasts ou fluxos de UI/UX."
allowed-tools: run_command, view_file
version: 2.0.0
---

# Playwright Visual Validation

## Comando seguro

O servidor deve estar rodando localmente na porta 3001 com o bypass explicitamente
habilitado apenas fora de produção. Execute em um terminal:

```bash
PLAYWRIGHT_MOCK_AUTH=1 \
PLAYWRIGHT_MOCK_AUTH_SECRET=local-only-e2e-secret \
PORT=3001 npm run dev
```

Em outro terminal, na raiz do repositório:

```bash
PLAYWRIGHT_MOCK_AUTH_SECRET=local-only-e2e-secret \
node e2e/run-ui-matrix.mjs
```

O valor acima é somente um segredo local fictício. Nunca substitua por segredo
real em documentação, scripts versionados ou comandos copiados para CI.

## Fonte da matriz

`e2e/ui-matrix.json` é a fonte legível dos casos. Ela define:

- `schemaVersion: 2`, com headings esperados por rota em
  `headingExpectations.common` e `headingExpectations.GESTOR_ONLY`;
- os papéis `ALMOXARIFE` e `GESTOR`;
- credenciais fictícias apenas para documentar a identidade do caso — elas não
  são usadas em login nem enviadas ao Supabase;
- viewports `390x844` (mobile) e `1440x900` (desktop);
- as rotas comuns `/dashboard`, `/itens`, `/entradas-nfe`,
  `/movimentacoes` e `/solicitacoes`;
- as rotas exclusivas de `GESTOR`: `/auditoria`, `/relatorios` e `/usuarios`.

Não edite a matriz para inserir credenciais de produção.

## Mock seguro de autenticação

O mock de `src/lib/auth.ts` e `src/proxy.ts` só é aceito quando todas as
condições são verdadeiras:

1. `PLAYWRIGHT_MOCK_AUTH === "1"`;
2. `NODE_ENV !== "production"`;
3. `PLAYWRIGHT_MOCK_AUTH_SECRET` existe e o header
   `x-playwright-mock-secret` é exatamente igual;
4. `x-playwright-role` é exatamente `ALMOXARIFE` ou `GESTOR`.

Qualquer valor inválido segue o fluxo real. A sessão mockada é mínima,
determinística e sem token ou credencial real: status `ATIVO`, empresa `1`
(`Empresa de Teste`), `saasAdmin: false`, canteiro `1` para `ALMOXARIFE` e
`null` para `GESTOR`. O bypass não existe em produção e não imprime headers,
segredos ou credenciais.

O runner usa um estado de sessão fictício somente no cookie local para que o
`AuthProvider` consulte o `/api/auth/me` mockado. O cookie não é enviado a
origens externas; o runner também remove os headers de mock antes de continuar
qualquer requisição fora do servidor local.

## O que o runner faz

`e2e/run-ui-matrix.mjs`:

1. exige `PLAYWRIGHT_MOCK_AUTH_SECRET` sem exibi-lo;
2. lê e valida `e2e/ui-matrix.json`;
3. verifica a disponibilidade de `http://localhost:3001`;
4. inicia `chromium.launch({ headless: true })` e cria um `BrowserContext` por
   combinação de papel e viewport;
5. envia os headers mockados apenas para requisições locais;
6. mocka, em memória e somente para leitura, os GETs de
   `/api/auth/me`, `/api/notificacoes`, `/api/canteiros`, `/api/itens`,
   `/api/nfe`, `/api/movimentacoes`, `/api/solicitacoes-criticas` e
   `/api/auditoria/eventos`;
7. deixa o documento HTML passar pelo Next.js — não mocka HTML nem mascara
   falhas de renderização;
8. usa `page.goto` e `page.screenshot` para cada rota, aguardando a carga,
   hidratação e o estado inicial; verifica HTTP 200, URL final esperada,
   ausência de `Application error`/`Internal Server Error`, o heading visível
   esperado para a rota e overflow horizontal inesperado no documento ou em
   controles visíveis, registrando os primeiros ofensores no manifest;
9. grava screenshots e `manifest.json` em
   `/tmp/opencode/almoxarifado-ui-matrix/<timestamp>/` e termina com código
   diferente de zero quando algum caso falha.

Os artefatos ficam fora do repositório e não devem ser adicionados ao Git.

## Inspeção visual e evidências

Após a execução, abra as imagens com `view_file` e verifique, em mobile e
desktop:

- alinhamento, espaçamento, overflow e quebras de layout;
- contraste, legibilidade, hierarquia e estados vazios/carregando;
- navegação, heading esperado e ausência de erro visível;
- ausência de overflow horizontal inesperado no documento (carrosséis internos
  intencionais não contam quando o documento não estoura); o manifest registra
  os primeiros elementos visíveis que ultrapassarem o viewport;
- fidelidade às regras do `DESIGN.md`.

Na entrega, anexe as evidências com caminho absoluto:

```markdown
![Dashboard mobile](file:///tmp/opencode/almoxarifado-ui-matrix/<timestamp>/001-almoxarife-mobile-dashboard.png)
```

Consulte também o `manifest.json` para relacionar cada caso ao screenshot e ao
resultado automatizado.

## Limitações conhecidas

- A matriz valida renderização inicial e estado de leitura; não executa fluxos
  mutáveis, upload de NF-e, exportações ou submits.
- Apenas os GETs listados acima são substituídos por fixtures. O HTML,
  componentes client-side e consultas server-side fora desse conjunto seguem
  o código real e podem exigir o ambiente local correspondente.
- Screenshot headless é evidência, não substitui revisão humana de conteúdo,
  acessibilidade e comportamento em dispositivos físicos.
- O harness não cria usuários, altera senha, chama Admin API nem grava no
  Supabase.
