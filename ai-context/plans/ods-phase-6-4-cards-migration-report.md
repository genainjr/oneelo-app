# Relatório de Execução — Fase 6.4: Migração de Cards de Listagem (ODS)

Data: 2026-06-16
Escopo executado: migração dos grids de card de `/agenda` e `/ministerios` para o padrão unificado `EntityCard`.
Referência: `ods-phase-6-closure-plan.md` (Fase 6.4) e `ods-phase-6-1-infra-report.md` (modos do EntityCard)

**Nenhum hook de domínio, API, filtro, ordenação, modal, drawer ou regra de negócio foi alterado.**
**Fase 6.5 NÃO foi iniciada. Documentação consolidada NÃO foi atualizada.**

---

## Arquivos Alterados

| Arquivo | Operação | Diff |
|---|---|---|
| `apps/web/src/app/(dashboard)/agenda/page.tsx` | MODIFY | +1 import, skeleton manual → `EntityCard loading`, `<div>` card → `<EntityCard>` (shell) |
| `apps/web/src/app/(dashboard)/ministerios/page.tsx` | MODIFY | +1 import, skeleton manual → `EntityCard loading`, `<div>` card → `<EntityCard>` (shell) |

Diff total: **11 inserções, 10 remoções** entre os dois arquivos. Mudanças cirúrgicas restritas aos blocos de loading e aos containers de card.

---

## 1. Decisão Arquitetural — Por que shell mode (e não DataTable)

`/agenda` e `/ministerios` **não são telas tabulares** — são **grids de card** (lista vertical em agenda; grid 3-colunas em ministérios), responsivos via `grid-cols`/`flex`, sem tabela desktop. Portanto:

- **`DataTable` / `renderMobileCard` não se aplica aqui.** Esse padrão (Fase 6.3) existe para encapsular a duplicação `hidden md:block`/`md:hidden` de páginas com **tabela no desktop + card no mobile**. Essas páginas nunca tiveram tabela nem essa duplicação — forçar `DataTable` introduziria uma tabela desktop indevida.
- **`EntityCard` em shell mode** foi o modo escolhido (conforme previsto no `ods-phase-6-1-infra-report.md`): substitui o `<div>` de container manual (`bg-white rounded-2xl border shadow ...`) pelo container padronizado do `EntityCard`, **preservando o JSX interno exato** de cada card.

Motivo de shell mode em vez de convenience mode: ambos os cards têm layouts específicos incompatíveis com o layout opinativo do convenience mode:
- **Agenda:** linha horizontal (`md:flex-row md:items-center`) com badge inline antes do título e ações verticalmente centralizadas à direita.
- **Ministérios:** badges com posicionamento absoluto (`absolute top-4 right-4`), título com `pr-28`, seção de liderança com `border-top`, e ações no rodapé.

Shell mode garante consistência **arquitetural** (mesmo container, sombra, borda, hover) sem regressão **visual** de layout.

---

## 2. Agenda — Migração

### Loading (antes → depois)
```tsx
// ANTES — skeleton manual
<div className="space-y-4 animate-pulse">
  <div className="h-28 bg-gray-100 border border-gray-200 rounded-2xl" />
  <div className="h-28 bg-gray-100 border border-gray-200 rounded-2xl" />
</div>

// DEPOIS — skeleton nativo do EntityCard
<div className="space-y-4">
  {Array.from({ length: 2 }).map((_, i) => <EntityCard key={i} loading />)}
</div>
```

### Card (antes → depois)
```tsx
// ANTES
<div key={ev.id} className="bg-white rounded-2xl border border-gray-150 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
  {/* status+título, descrição, meta (datas/local), ações editar/excluir */}
</div>

// DEPOIS — shell mode, JSX interno inalterado
<EntityCard key={ev.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
  {/* JSX interno idêntico */}
</EntityCard>
```

- `EmptyState` preservado sem alteração.
- Handlers `openEdit`/`handleDelete`, badge de status, formatação de datas — inalterados.

---

## 3. Ministérios — Migração

### Loading (antes → depois)
```tsx
// ANTES — animate-pulse manual no wrapper + divs simuladas
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
  {Array.from({ length: 3 }).map((_, i) => (
    <div key={i} className="h-44 bg-gray-100 rounded-2xl border border-gray-200" />
  ))}
</div>

// DEPOIS — skeleton nativo (cada EntityCard controla o próprio pulse)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {Array.from({ length: 3 }).map((_, i) => (
    <EntityCard key={i} loading />
  ))}
</div>
```

### Card (antes → depois)
```tsx
// ANTES
<div key={m.id} className={`bg-white rounded-2xl border border-gray-150 shadow-xs hover:shadow-md transition-all flex flex-col p-5 justify-between relative overflow-hidden ${!isAtivo && 'opacity-65'}`}>
  {/* badges absolutos, título+descrição, seção liderança, ações */}
</div>

// DEPOIS — shell mode, JSX interno inalterado, opacity condicional preservada
<EntityCard key={m.id} className={`flex flex-col p-5 justify-between relative overflow-hidden ${!isAtivo && 'opacity-65'}`}>
  {/* JSX interno idêntico */}
</EntityCard>
```

- Grid container (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`) permanece na página.
- `EmptyState` preservado sem alteração.
- Cálculo de `cardLeaders`, contagem de membros, handlers `handleDelete`/abertura de modal — inalterados.

### Fora de escopo (intencional)
O skeleton `animate-pulse` na linha ~495 **permanece** — ele está **dentro do modal** (aba de membros, `loadingDetails`), não no grid de listagem. Modais estão explicitamente protegidos pelas restrições da Fase 6.4. Candidato a fase futura de padronização de loading interno de modais.

---

## 4. Validações Executadas

| Validação | Resultado |
|---|---|
| `tsc --noEmit` | ✅ Zero erros |
| `next build` | ✅ Exit 0 — `/agenda` e `/ministerios` compilaram |
| ESLint nos arquivos alterados (baseline) | ⚠️ 27 problemas — **100% pré-existentes** |
| Delta de lint introduzido pela migração | ✅ **Zero** (provado por comparação com HEAD) |
| Grep anti-pattern `animate-pulse` no grid de agenda | ✅ Zero ocorrências |
| Grep anti-pattern manual card `bg-white rounded-2xl border-gray-150` em agenda | ✅ Zero ocorrências |
| Grep `hidden md:block` / `md:hidden` em ambos | ✅ Zero (nunca existiu; não reintroduzido) |
| `import EntityCard` em ambos | ✅ Presente |

### Nota sobre ESLint — débito pré-existente
Os 27 problemas reportados (`no-explicit-any` ×23, `set-state-in-effect` ×2, `no-unused-vars` ×1) **já existiam antes desta fase** e estão em código que a Fase 6.4 está proibida de tocar (handlers de submit, uso de hooks, efeitos, modais). Prova objetiva:

- Foi feito `git stash` das duas alterações e rodado ESLint na versão **HEAD** (pré-migração): resultado **idêntico** — `✖ 27 problems (25 errors, 2 warnings)`.
- Nenhum erro de lint ocorre nas linhas alteradas pela migração (imports, blocos de loading, tags de container de card). O diff `-U1` confirma que nenhuma linha com `any`/efeito foi tocada.

Corrigir esse débito exigiria tipar payloads de domínio e reestruturar efeitos com `setState` — o que viola as restrições fortes da Fase 6.4 (não alterar regras de negócio, hooks, modais). **Recomendado tratar em tarefa dedicada de lint-cleanup, fora da Fase 6.**

---

## 5. Validação Desktop vs Mobile (Behavioral)

A responsividade de ambas as páginas é controlada pelo container de grid/flex, que **permanece na página** (não foi alterado):
- **Agenda:** lista vertical `space-y-4`; cada card colapsa de `md:flex-row` para `flex-col` abaixo de `md`. Comportamento preservado.
- **Ministérios:** grid `1 / md:2 / lg:3` colunas. Comportamento preservado.

O `EntityCard` em shell mode não injeta nenhuma classe de breakpoint própria — apenas o container base (`bg-white rounded-2xl border shadow-sm hover:shadow-md`). Portanto não há risco de regressão responsiva.

---

## Respostas Objetivas

**1. Quais páginas foram migradas?**
Duas: `/agenda` (`app/(dashboard)/agenda/page.tsx`) e `/ministerios` (`app/(dashboard)/ministerios/page.tsx`). Em ambas, o skeleton de loading manual e o container de card `<div>` manual foram substituídos por `EntityCard`.

**2. Alguma duplicação de layout foi eliminada?**
Não havia duplicação `hidden md:block`/`md:hidden` nessas páginas (elas sempre foram grids de card, sem tabela desktop). O que foi eliminado: **boilerplate de container de card duplicado** (a string `bg-white rounded-2xl border shadow ... transition-all` repetida manualmente em cada card e em cada skeleton) e os **skeletons `animate-pulse` manuais** — ambos agora centralizados no `EntityCard`.

**3. DataTable manteve responsabilidade controlada?**
Sim — o `DataTable` **não foi tocado** nesta fase. Foi corretamente identificado que ele não se aplica a grids de card (apenas a telas tabulares com tabela desktop). Nenhuma lógica de domínio foi adicionada a ele.

**4. EntityCard foi suficiente ou houve necessidade de extensão?**
Suficiente, **sem necessidade de extensão**. O shell mode (children diretos + `className`) cobriu integralmente os dois layouts específicos (linha horizontal da agenda; card com badges absolutos e seção de liderança dos ministérios) e a prop `loading` cobriu os skeletons. A interface do `EntityCard` criada na Fase 6.1 não precisou de nenhuma alteração.

**5. Está pronto para Fase 6.5?**
Sim — as três migrações de página do PR de listagens (6.2 admin, 6.3 membros/visualização, 6.4 agenda + ministérios) estão concluídas e compilam. A Fase 6.5 (auditoria final dos critérios C1–C15 + consolidação de documentação) pode ser iniciada **mediante autorização explícita**.

---

> ⛔ **Fase 6.5 NÃO iniciada.** Conforme instrução, não há avanço para auditoria final nem consolidação de documentação até autorização explícita.
