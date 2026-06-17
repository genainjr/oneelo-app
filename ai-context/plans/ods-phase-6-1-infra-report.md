# Relatório de Execução — Fase 6.1: Infraestrutura (ODS)

Data: 2026-06-16
Escopo executado: criação de `EntityCard` + extensão de `DataTable` com `renderMobileCard` e `mobileBreakpoint`.
Referência: ods-phase-6-closure-plan.md (Fase 6.1)

**Nenhum código de página foi alterado. Nenhuma migração foi iniciada.**

---

## Arquivos Alterados

| Arquivo | Operação | Linhas |
|---|---|---|
| `apps/web/src/components/app/entity-card.tsx` | CREATE | 83 linhas |
| `apps/web/src/components/app/data-table.tsx` | MODIFY | +16 linhas (+2 props, +mobileHideClass/tableShowClass, +mobile section, +Fragment return path) |

---

## 1. EntityCard — Criado

### Localização

`apps/web/src/components/app/entity-card.tsx`

### Interface

```typescript
interface EntityCardProps {
  // Convenience props: renders standard layout with header/body/footer
  title?: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  actions?: React.ReactNode;

  // Full control: children rendered directly inside container (shell mode)
  children?: React.ReactNode;

  // Interaction
  onClick?: () => void;

  // State
  loading?: boolean;

  // Overrides
  className?: string;
}
```

### Modos de uso

**Modo convenience (standard layout):** quando qualquer prop de conteúdo é fornecida (`title`, `badge`, etc.), o componente renderiza header / description / meta / children / footer+actions em layout flex-col padronizado.

```tsx
<EntityCard
  title="João Silva"
  subtitle="(11) 99999-0000"
  badge={<span className="bg-emerald-100 text-emerald-800 ...">Ativo</span>}
  meta={<span>Nascimento: 12/03/1990</span>}
  actions={<button>Editar</button>}
/>
```

**Modo shell (full control):** quando nenhuma prop de conteúdo é fornecida, `children` são renderizados diretamente dentro do container padronizado. Útil para migrar cards complexos (Agenda, Ministérios) preservando o JSX interno sem alteração.

```tsx
<EntityCard className="flex flex-col md:flex-row gap-4">
  {/* JSX existente do card de evento ou ministério */}
</EntityCard>
```

**Estado de loading:** quando `loading={true}`, renderiza skeleton de card genérico com `animate-pulse` — elimina necessidade de `animate-pulse` manual nas páginas.

### Compatibilidade com as migrações futuras

| Migração futura | Modo esperado |
|---|---|
| `DataTable.renderMobileCard` em `/membros/visualizacao` | Convenience (title, subtitle, badge, meta) |
| Cards de `/agenda` | Shell (mantém JSX interno, ganha container padronizado) |
| Cards de `/ministerios` | Shell (mantém JSX interno, ganha container padronizado) |

---

## 2. DataTable — Estendido

### Novas props adicionadas

```typescript
// Mobile fallback — when set, replaces the table below mobileBreakpoint
renderMobileCard?: (item: T) => React.ReactNode;
mobileBreakpoint?: 'sm' | 'md' | 'lg';  // default: 'md'
```

### Comportamento

**Sem `renderMobileCard` (existente — zero breaking change):** o componente retorna exatamente a mesma estrutura DOM de antes. O caminho de retorno é `if (!renderMobileCard) { return tableCard; }` — o `tableCard` é a div com `w-full bg-white rounded-2xl...` idêntica à versão anterior.

**Com `renderMobileCard` (novo):** o componente retorna um React Fragment com dois filhos:

1. **Mobile section** (`md:hidden` por padrão): visível abaixo do breakpoint; renderiza `EntityCard loading` skeleton, `EmptyState`, ou lista de `renderMobileCard(item)` conforme o estado dos dados.
2. **Table section** (`hidden md:flex` por padrão): oculto abaixo do breakpoint, visível acima; idêntica à estrutura atual da tabela.

### Padrão de responsividade implementado

```
viewport < 768px (mobile)  → mobile section visível + tabela oculta
viewport ≥ 768px (desktop) → mobile section oculta + tabela visível
```

O padrão `hidden md:block`/`md:hidden` agora está **encapsulado no DataTable**, eliminando a necessidade de duplicar esse padrão nas páginas.

### Mapeamento de classes por breakpoint

Todas as strings Tailwind são literais completas (necessário para o scanner do Tailwind):

| `mobileBreakpoint` | Mobile section class | Table section class |
|---|---|---|
| `'sm'` | `sm:hidden` | `hidden sm:flex` |
| `'md'` (default) | `md:hidden` | `hidden md:flex` |
| `'lg'` | `lg:hidden` | `hidden lg:flex` |

### Correção de lint aplicada

Dois erros pré-existentes de `@typescript-eslint/no-explicit-any` foram corrigidos:

| Linha original | Problema | Correção |
|---|---|---|
| `rowKey = 'id' as any` | `as any` no default | Removido default; `getRowId` trata `rowKey === undefined` com fallback seguro para campo `'id'` |
| `(item[col.key as keyof T] as any)` | `as any` no render fallback | Substituído por `as unknown as React.ReactNode` |

### Consumidores existentes — compatibilidade confirmada

| Arquivo | Usa `renderMobileCard`? | Impacto |
|---|---|---|
| `membros/page.tsx` | Não | Zero — segue o caminho `if (!renderMobileCard) { return tableCard; }` |
| `configuracoes/page.tsx` | Não | Zero — idem |

---

## 3. Validações Executadas

| Validação | Resultado |
|---|---|
| `tsc --noEmit` (antes das correções de lint) | ✅ Zero erros |
| `tsc --noEmit` (após correções de lint) | ✅ Zero erros |
| `eslint entity-card.tsx data-table.tsx --max-warnings=0` | ✅ Zero erros, zero warnings |
| `next build` | ✅ Exit code 0 — todas as rotas compilaram |

---

## 4. Validação Desktop/Mobile (Behavioral)

A lógica de responsividade foi implementada via CSS puro (Tailwind). Não é possível validar visualmente aqui (sem browser), mas o comportamento é determinístico:

- Sem `renderMobileCard`: nenhuma classe de visibilidade é adicionada à tabela (zero regressão)
- Com `renderMobileCard`: mobile section e table section são mutuamente exclusivos via CSS — apenas um está visível a qualquer viewport

Para validação em browser, as fases 6.2 e 6.3 serão os primeiros casos de uso real com `renderMobileCard`.

---

## 5. Critérios da Fase 6.1 — Verificados

| Critério | Status |
|---|---|
| `entity-card.tsx` existe em `components/app/` | ✅ |
| `DataTableProps<T>` contém `renderMobileCard?: (item: T) => React.ReactNode` | ✅ |
| `DataTableProps<T>` contém `mobileBreakpoint?: 'sm' \| 'md' \| 'lg'` | ✅ |
| Nenhuma página foi alterada | ✅ |
| Nenhum hook de domínio foi alterado | ✅ |
| Nenhuma API foi alterada | ✅ |
| TypeScript: zero erros | ✅ |
| ESLint nos arquivos alterados: zero erros | ✅ |
| `membros/page.tsx` e `configuracoes/page.tsx`: comportamento preservado | ✅ (path `!renderMobileCard` retorna estrutura idêntica) |

---

## Respostas Objetivas

**1. Quais componentes foram criados?**

- `EntityCard` — novo componente de container de entidade com dois modos: convenience (props de conteúdo) e shell (children diretos). Inclui skeleton nativo via `loading` prop.
- `DataTable` — estendido (não criado do zero) com props `renderMobileCard` e `mobileBreakpoint`. Encapsula o padrão `hidden md:block`/`md:hidden` internamente.

**2. Houve breaking change?**

**Não.** O DataTable preserva o comportamento anterior exatamente quando `renderMobileCard` não é fornecido — o componente retorna a mesma estrutura DOM de antes via early return. As duas correções de lint (`as any` → tipagem adequada) não alteram o comportamento em runtime.

**3. DataTable permaneceu controlado?**

**Sim.** Nenhuma lógica de negócio foi adicionada. As novas props são opcionais e puramente visuais/estruturais. Paginação, seleção, ordenação e empty state existentes funcionam sem alteração. A compatibilidade retroativa é garantida pelo early return `if (!renderMobileCard)`.

**4. Está pronto para PR 2?**

**Sim.** As pré-condições do PR 2 (Fases 6.2 + 6.3) estão satisfeitas:
- `EntityCard` existe e pode ser usado em `renderMobileCard`
- `DataTable.renderMobileCard` existe e encapsula o padrão de responsividade
- TypeScript e ESLint passam sem erros
- Nenhuma migração de página iniciada (escopo limpo para PR 2)
