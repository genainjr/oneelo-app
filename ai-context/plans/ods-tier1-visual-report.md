# Relatório — Tier 1 de Padronização Visual (ODS)

Data: 2026-06-18
Branch: `refactor/ods-tier1-visual` (a partir de `development`)
Status: ✅ **CONCLUÍDA** — `tsc --noEmit` exit 0, `next build` exit 0 (28 rotas)
Workflow: `feature-development.md` — 3 commits separados por concern.

---

## Objetivo

Elevar a percepção de qualidade visual com 3 padronizações de baixo risco e alto retorno,
seguindo a filosofia ODS (componentes presentation-only, adoção incremental):

1. **Skeleton** — unificar os loaders manuais `animate-pulse`.
2. **EmptyState** — eliminar vazios inline e a mistura de estilos.
3. **PageHeader** — uniformizar o topo da tela inicial (`/dashboard`).

---

## 1. Componente `Skeleton` (+ `SkeletonList`)

**Problema:** 13 ocorrências de `animate-pulse` espalhadas; os loaders de página eram blocos
cinza desenhados à mão com alturas/formas divergentes, sem componente único.

**Solução:** novo `components/app/skeleton.tsx`:
- `Skeleton` — bloco shimmer base (`animate-pulse rounded-lg bg-gray-100`), forma via `className`.
- `SkeletonList` — lista vertical de N blocos (props `count`, `className`, `gap`), o padrão
  dominante (cards de listagem carregando). `aria-busy`/`aria-live` para acessibilidade.

**7 loaders migrados em 6 telas:**

| Tela | Antes | Depois |
|---|---|---|
| `minhas-escalas` | 3× `h-32` | `SkeletonList count={3} h-32` |
| `escalas/visualizacao` | 2× `h-64` | `SkeletonList count={2} h-64` |
| `meu-perfil` | 2× `h-40 rounded-2xl` | `SkeletonList count={2} … space-y-4` |
| `escalas` (lista) | 3× `h-20 rounded-2xl` | `SkeletonList count={3} …` |
| `escalas` (detalhe) | `h-12` + `h-64` | 2× `Skeleton` (formas distintas) |
| `ministerios` (aba membros) | 3× `h-12 rounded-xl` | `SkeletonList count={3} … space-y-2` |
| `configuracoes` (guard) | linhas de texto manuais | `Skeleton` (linhas) |

**Exclusões intencionais (documentadas):**
- `/` (landing): o `animate-pulse` é **hero decorativo** (shimmer estético do mockup), não loading.
- `/login`, `/admin/login`: escopo de **autenticação**, tratado à parte.
- `DataTable`/`EntityCard`/`StatCard`: já possuem skeleton interno próprio; não alterados.

---

## 2. `EmptyState` — variante `compact` + adoção

**Problema:** 2 telas com vazios inline; `minhas-escalas` misturava o componente (vazio
page-level) com caixas tracejadas inline (vazios de seção) na mesma tela.

**Solução:** prop **`compact`** no `EmptyState` (placeholder de seção: caixa tracejada, sem o
ícone grande), mantendo o `EmptyState` cheio para vazios page-level.

| Tela | Migração |
|---|---|
| `escalas` (lista) | vazio page-level → `EmptyState` (cheio, com descrição condicional) |
| `minhas-escalas` | 3 vazios de seção (Pendentes/Próximas/Histórico) → `EmptyState compact` |

`membros/page.tsx`: o `border-dashed` encontrado é um **botão** (não vazio) — não tocado;
`/membros` usa `DataTable` com empty delegado.

---

## 3. `PageHeader` no `/dashboard`

**Problema:** a tela inicial (primeira que o usuário vê) não usava `PageHeader` — `<h2>` solto
em `text-2xl`, divergente das demais telas (`text-xl` via `PageHeader`).

**Solução:** saudação + subtítulo migrados para `<PageHeader title=… description=… />`,
preservando a saudação dinâmica (nome + emoji) e a data.

---

## Validação

| Validação | Resultado |
|---|---|
| `tsc --noEmit` | ✅ Exit 0 |
| `next build` | ✅ Exit 0 — 28 rotas |
| Regra de negócio / API / schema | ✅ Inalteradas (mudança puramente visual) |
| Delta de lint introduzido | ✅ Zero |

---

## Próximos passos sugeridos (Tier 2)

- **Fase 8 — Sidebar / Navegação**: maior superfície visível; estados ativos, ícones, drawer
  responsivo no mobile. Maior impacto visual global (escopo/risco maiores).
- Polimento: micro-interações (hover/focus rings), `PasswordField` nos logins, telas placeholder
  (`/financeiro`, `/integracoes`, `/grupos`) no `coming-soon`.
