# ODS Phase 0 Baseline

Fonte:

- `ai-context/plans/ods-refactoring-plan.md`
- `ai-context/frontend/design-system-inventory.md`
- `ai-context/frontend/design-system-pattern-analysis.md`
- `ai-core/skills/oneelo-design-system/`

Objetivo: registrar a base de comparacao antes das refatoracoes do OneElo Design System, sem alterar comportamento, componentes, rotas, APIs, banco de dados, modelos Prisma, permissoes ou autenticacao.

---

## Escopo Executado

A Fase 0 cobre apenas preparacao e baseline.

Inclui:

- rotas criticas para validacao visual;
- estados esperados por rota;
- checklist de navegacao;
- checklist de responsividade;
- comandos de validacao do frontend;
- riscos conhecidos antes da Fase 1.

Nao inclui:

- criacao de componentes compartilhados;
- migracao de modais, tabelas, filtros ou metricas;
- remocao de duplicidades;
- alteracao de regras de negocio;
- alteracao de contratos de API;
- alteracao de permissoes.

---

## Rotas Criticas Para Validacao Visual

| Rota | Modulo | Layout esperado | Padrao ODS de referencia | Estados a validar |
|---|---|---|---|---|
| `/dashboard` | Dashboard | `DashboardLayout` | `PageHeader`, `StatCard` | loading, erro, com dados |
| `/membros` | Membros | `DashboardLayout` | `PageHeader`, filtros, `DataTable`, `MembroModal` | loading, vazio, erro, com dados, permissao sem edicao |
| `/membros/visualizacao` | Membros / Visualizacao | `DashboardLayout` | `PageHeader`, metricas, filtros, read-only, drawer | loading, vazio, erro, com dados, permissao sem edicao |
| `/ministerios` | Ministerios | `DashboardLayout` | `PageHeader`, cards, modal composto | loading, vazio, erro, com dados, permissao sem edicao |
| `/escalas` | Escalas | `DashboardLayout` | `PageHeader`, grade operacional, modal | loading, vazio, erro, com dados, permissao sem edicao |
| `/escalas/visualizacao` | Escalas / Visualizacao | `DashboardLayout` | `PageHeader`, filtros, `EscalaReadonlyGrid` | loading, vazio, erro, com dados, permissao sem edicao |
| `/agenda` | Agenda | `DashboardLayout` | `PageHeader`, filtros, cards, modal | loading, vazio, erro, com dados, permissao sem edicao |
| `/configuracoes` | Configuracoes | `DashboardLayout` | `PageHeader`, tabs, `DataTable`, `UsuarioModal` | loading, vazio, erro, com dados, permissao sem edicao |
| `/minhas-escalas` | Portal do Membro | `DashboardLayout` | read-only, cards, status centralizado | loading, vazio, erro, com dados |
| `/meu-perfil` | Perfil | `DashboardLayout` | `PageHeader`, cards, formulario de senha | loading, erro, com dados |
| `/admin` | Super Admin | `AdminLayout` | tabela administrativa, modais de plataforma | loading, vazio, erro, com dados |

---

## Estados Esperados

| Estado | Criterio de baseline |
|---|---|
| Loading | A tela deve manter estrutura visual previsivel durante carregamento. |
| Vazio | A tela deve comunicar ausencia de dados sem quebrar layout. |
| Erro | A tela deve exibir erro inline ou bloco de erro recuperavel. |
| Com dados | A tela deve renderizar a experiencia principal do modulo. |
| Permissao sem edicao | Acoes de criacao, edicao, exclusao, publicacao ou administracao devem ficar ocultas ou desabilitadas conforme permissao visual atual. |

---

## Checklist De Navegacao

| Perfil | Rotas principais esperadas | Status baseline |
|---|---|---|
| `ADMIN` | `/dashboard`, `/membros`, `/membros/visualizacao`, `/ministerios`, `/escalas`, `/escalas/visualizacao`, `/agenda`, `/meu-perfil`, `/configuracoes` | Pendente de validacao manual com usuario autenticado |
| `STAFF` | `/dashboard`, `/membros`, `/membros/visualizacao`, `/ministerios`, `/escalas`, `/escalas/visualizacao`, `/agenda`, `/meu-perfil` | Pendente de validacao manual com usuario autenticado |
| `BASIC` comum | `/minhas-escalas`, `/agenda`, `/meu-perfil` | Pendente de validacao manual com usuario autenticado |
| `BASIC` lider/co-lider | `/minhas-escalas`, `/ministerios`, `/escalas`, `/escalas/visualizacao`, `/agenda`, `/meu-perfil` | Pendente de validacao manual com usuario autenticado |
| `SUPER_ADMIN` | `/admin/login`, `/admin` | Pendente de validacao manual com usuario autenticado |

---

## Checklist De Responsividade

| Viewport | Rotas prioritarias | Criterios |
|---|---|---|
| Desktop | todas as rotas criticas | sidebar/header sem sobreposicao, conteudo com largura adequada, tabelas/grades escaneaveis |
| Tablet | `/membros`, `/ministerios`, `/escalas`, `/agenda`, `/configuracoes` | filtros e cards sem quebra visual, modais centralizados |
| Mobile | `/membros/visualizacao`, `/escalas/visualizacao`, `/minhas-escalas`, `/meu-perfil`, `/agenda` | sidebar mobile utilizavel, textos sem corte, cards/tabelas sem overflow indevido |

Status: pendente de validacao visual manual com ambiente autenticado e dados representativos.

---

## Baseline De Conformidade ODS

Fonte: `ai-context/frontend/ods-compliance-matrix.md`.

| Grupo | Situacao antes da refatoracao |
|---|---|
| Alta aderencia | telas que ja usam `PageHeader`, `DataTable`, `StatCard`, `ComingSoon` ou componentes compartilhados equivalentes |
| Aderencia parcial | telas com padroes corretos, mas duplicacoes locais de filtros, modais, metricas, status ou confirmacoes |
| Baixa aderencia | telas com tabela/modal/shell local em vez dos componentes compartilhados definidos pelo ODS |

Percentual consolidado antes da refatoracao: nao calculado numericamente no inventario original; baseline qualitativo mantido pela matriz de conformidade existente.

Percentual depois da Fase 0: sem alteracao esperada, pois a fase nao modifica interface.

---

## Validacoes Automatizadas

| Comando | Objetivo | Resultado |
|---|---|---|
| `npm.cmd run lint -w apps/web` | ESLint do frontend | Falhou com problemas preexistentes |
| `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` | TypeScript do frontend | Passou |
| `npm.cmd run build -w apps/web` | Build Next.js do frontend | Passou com avisos |

### Resultado Do ESLint

Status: falhou.

Resumo:

- 101 problemas encontrados;
- 82 erros;
- 19 warnings.

Principais categorias:

- `@typescript-eslint/no-explicit-any`;
- `react-hooks/set-state-in-effect`;
- `react-hooks/exhaustive-deps`;
- `@typescript-eslint/no-unused-vars`;
- `@next/next/no-img-element`.

Arquivos citados pelo lint incluem:

- `apps/web/src/app/(admin)/admin/page.tsx`;
- `apps/web/src/app/(dashboard)/agenda/page.tsx`;
- `apps/web/src/app/(dashboard)/configuracoes/page.tsx`;
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`;
- `apps/web/src/app/(dashboard)/escalas/page.tsx`;
- `apps/web/src/hooks/use-escalas.ts`;
- `apps/web/src/hooks/use-eventos.ts`;
- `apps/web/src/hooks/use-membros.ts`;
- `apps/web/src/hooks/use-ministerios.ts`;
- `apps/web/src/lib/api.ts`.

Decisao da Fase 0: registrar como baseline e nao corrigir nesta fase.

### Resultado Do TypeScript

Status: passou.

Comando executado:

```bash
npx.cmd tsc -p apps/web/tsconfig.json --noEmit
```

### Resultado Do Build

Status: passou.

Comando executado:

```bash
npm.cmd run build -w apps/web
```

Rotas confirmadas pelo build:

| Rota | Status build |
|---|---|
| `/` | dinamica |
| `/admin` | dinamica |
| `/admin/login` | dinamica |
| `/agenda` | dinamica |
| `/agenda/exportacao` | dinamica |
| `/configuracoes` | dinamica |
| `/dashboard` | dinamica |
| `/escalas` | dinamica |
| `/escalas/exportacao` | dinamica |
| `/escalas/visualizacao` | dinamica |
| `/financeiro` | dinamica |
| `/grupos` | dinamica |
| `/integracoes` | dinamica |
| `/login` | dinamica |
| `/membros` | dinamica |
| `/membros/exportacao` | dinamica |
| `/membros/visualizacao` | dinamica |
| `/meu-perfil` | dinamica |
| `/minhas-escalas` | dinamica |
| `/ministerios` | dinamica |
| `/ministerios/exportacao` | dinamica |
| `/ministerios/infantil` | dinamica |
| `/ministerios/louvor` | dinamica |
| `/ministerios/midia` | dinamica |
| `/locale` | dinamica |
| `/_not-found` | dinamica |
| `/icon.svg` | estatica |

Avisos do build:

- Next.js inferiu o workspace root por existirem multiplos lockfiles: `package-lock.json` na raiz e em `apps/web`.
- A convencao de arquivo `middleware` esta depreciada em favor de `proxy`.

---

## Riscos Registrados

| Risco | Impacto | Mitigacao |
|---|---|---|
| Validacoes podem falhar por problemas preexistentes | Bloqueia baseline verde, mas nao implica regressao da Fase 0 | Registrar erro integralmente e nao corrigir nesta fase |
| Rotas autenticadas exigem usuarios reais e dados representativos | Screenshots e responsividade nao podem ser comprovados apenas por build | Registrar checklist manual para execucao em ambiente autenticado |
| Build Next.js pode gerar artefatos em `.next` | Mudanca operacional esperada, fora do codigo-fonte | Nao versionar artefatos de build |
| Aviso de permissao no ignore global do Git | Ruido em comandos Git | Nao impacta arquivos do projeto |

---

## Criterios De Aceite Da Fase 0

| Criterio | Status |
|---|---|
| Baseline documentado | Concluido |
| Rotas criticas listadas | Concluido |
| Estados esperados registrados | Concluido |
| Navegacao documentada para validacao | Concluido |
| Responsividade documentada para validacao | Concluido |
| ESLint executado | Concluido com falha baseline |
| TypeScript executado | Concluido com sucesso |
| Build executado | Concluido com sucesso e avisos |
| Nenhuma alteracao funcional aplicada | Concluido |

---

## Relatorio Final Da Fase 0

### Alteracoes realizadas

- Criado documento de baseline para a refatoracao ODS.
- Registradas rotas criticas para validacao visual.
- Registrados estados esperados por rota.
- Registrados checklists de navegacao e responsividade.
- Executadas validacoes automatizadas do frontend.
- Registrados problemas preexistentes do ESLint como baseline.

### Componentes criados

Nenhum componente foi criado.

### Componentes removidos

Nenhum componente foi removido.

### Componentes reutilizados

Nenhum componente foi alterado ou reutilizado em nova implementacao nesta fase.

Componentes apenas referenciados como baseline ODS:

- `PageHeader`;
- `DataTable`;
- `EmptyState`;
- `StatCard`;
- `MemberProfileDrawer`;
- `EscalaReadonlyGrid`;
- `Sidebar`;
- `Header`.

### Arquivos alterados

| Arquivo | Tipo de alteracao |
|---|---|
| `ai-context/plans/ods-phase-0-baseline.md` | criado |

### Possiveis regressoes

Nenhuma regressao funcional esperada, pois nenhum arquivo de aplicacao foi alterado.

Riscos registrados para proximas fases:

- ESLint ja inicia com falhas preexistentes.
- Validacao visual completa depende de usuarios autenticados e dados representativos.
- Build passa, mas exibe avisos de configuracao do Next.js.

### Testes recomendados

- Validar manualmente as rotas criticas em desktop, tablet e mobile.
- Validar menus por perfil: `ADMIN`, `STAFF`, `BASIC`, `BASIC` lider/co-lider e `SUPER_ADMIN`.
- Reexecutar `npm.cmd run lint -w apps/web` antes da Fase 1 para confirmar se a baseline mudou.
- Reexecutar `npx.cmd tsc -p apps/web/tsconfig.json --noEmit`.
- Reexecutar `npm.cmd run build -w apps/web`.

### Percentual de aderencia ao ODS antes e depois

| Momento | Aderencia |
|---|---|
| Antes da Fase 0 | Sem percentual numerico consolidado; referencia qualitativa em `ai-context/frontend/ods-compliance-matrix.md` |
| Depois da Fase 0 | Sem alteracao, pois nenhuma tela ou componente foi refatorado |

### Validacao solicitada

| Item | Resultado |
|---|---|
| Build frontend | Passou |
| TypeScript | Passou |
| ESLint | Falhou por problemas preexistentes |
| Rotas | Confirmadas pelo build do Next.js |
| Navegacao | Checklist documentado; validacao manual pendente |
| Responsividade | Checklist documentado; validacao manual pendente |
