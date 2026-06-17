# Plano de Fechamento — Fase 6: Tabelas e Listagens (ODS)

Data: 2026-06-16
Objetivo: transformar Fase 6 de 🟡 Implementada Parcialmente → ✅ Concluída
Referências: ods-phase-6-tables-pre-analysis.md, ods-phase-6-tables-design.md, ods-phase-6-closure-audit.md

**ESCOPO DESTE DOCUMENTO:** planejamento e auditoria apenas. Nenhum código foi alterado.

---

## 1. Gap Real — Pendências e Priorização

### P0 — Bloqueia fechamento

| # | Pendência | Justificativa |
|---|---|---|
| P0-1 | `EntityCard` não existe | Necessário para fallback mobile do `DataTable` E para grids de Agenda e Ministérios. Todas as migrações de responsividade e cards dependem deste componente. |
| P0-2 | `DataTable.renderMobileCard` não implementado | Decisão arquitetural aprovada (Design, Decisão 5). Sem ela, `membros/visualizacao` não pode ser migrada: ainda usa o anti-padrão `hidden md:block`/`md:hidden`. |
| P0-3 | `/admin` não migrado | Primeira tela planejada no design e na pré-análise. Tabelas HTML brutas (`<table>`, `<thead>`, `<tbody>`) com CSS manual. Sem DataTable, sem EmptyState. Risco baixo. Sem migração a fase não pode ser declarada completa. |
| P0-4 | `/membros/visualizacao` não migrado | Única tela com o anti-padrão de DOM duplicado (`hidden md:block` + `md:hidden`) que a Fase 6 foi criada para resolver. Sem esta migração, o problema estrutural central da fase permanece. |

### P1 — Desejável (completa o escopo planejado)

| # | Pendência | Justificativa |
|---|---|---|
| P1-1 | `/agenda` — cards manuais sem `EntityCard` | `EmptyState` já adotado; cards funcionam, mas são divs manuais com boilerplate de sombra e padding repetido. Explicitamente planejado no Design (Decisão 6). Desejável para fechar com consistência. |
| P1-2 | `/ministerios` — cards manuais sem `EntityCard` | Mesmo caso de `/agenda`. Skeleton manual de `Array.from({length: 3})` ainda presente. |

### P2 — Melhoria futura (fora do escopo desta fase)

| # | Item | Justificativa |
|---|---|---|
| P2-1 | `StatusBadge` standalone | Pré-análise classificou como "Recomendado", não mandatório. Badges já funcionam com spans inline. |
| P2-2 | `TablePagination` standalone | Pré-análise classificou como "Opcional (por agora)". Paginação já está embutida no `DataTable`. |
| P2-3 | `CardSkeleton` standalone | Pode ser embutido no `EntityCard` via prop `loading` em vez de componente separado. |
| P2-4 | Escalas — listagem secundária | Design (Decisão 7) afirma explicitamente: "A Matriz de Escalas NÃO utilizará o DataTable." Fora do escopo. |

---

## 2. Sub-etapas de Implementação

---

### Fase 6.1 — Infraestrutura Restante

**Objetivo:** Criar os dois componentes ausentes que desbloqueiam todas as migrações subsequentes. Nenhuma página alterada.

**Arquivos previstos:**

| Arquivo | Operação | Descrição |
|---|---|---|
| `apps/web/src/components/app/entity-card.tsx` | CREATE | Novo componente de container de entidade |
| `apps/web/src/components/app/data-table.tsx` | MODIFY | Adicionar prop `renderMobileCard` à interface e ao JSX |

**Interface esperada — EntityCard:**

```typescript
interface EntityCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;     // status tag, tipo de evento, etc.
  meta?: React.ReactNode;      // datas, contagens, métricas
  footer?: React.ReactNode;    // tags, ministérios vinculados
  actions?: React.ReactNode;   // botões de editar/excluir
  onClick?: () => void;
  className?: string;
}
```

**Modificação esperada — DataTable:**

```typescript
// Adição à interface DataTableProps<T>
renderMobileCard?: (item: T) => React.ReactNode;
```

Lógica JSX: quando `renderMobileCard` é fornecido, a tabela `<table>` é envolta em `hidden md:block` e uma seção `md:hidden` itera os dados chamando `renderMobileCard(item)` para cada elemento. Quando a prop é ausente, o comportamento atual é **exatamente preservado** (sem regressão nas páginas que já usam DataTable sem mobile fallback).

**Risco:** Baixo.
- `entity-card.tsx` é arquivo novo — risco zero.
- Modificação em `data-table.tsx` é aditiva: a prop é opcional e o código de produção existente (`membros/page.tsx`, `configuracoes/page.tsx`) não a usa. Se a reestruturação do wrapper de tabela for feita errada, pode quebrar o layout nesses dois arquivos.

**Validações objetivas:**
- `tsc --noEmit` sem novos erros
- `membros/page.tsx` renderiza identicamente ao estado anterior (nenhuma prop nova adicionada)
- `configuracoes/page.tsx` renderiza identicamente ao estado anterior
- `EntityCard` renderiza sem erros de tipo com cada combinação de props

**Rollback:** Reverter `data-table.tsx` para a versão anterior via git; deletar `entity-card.tsx`.

---

### Fase 6.2 — Migração Admin

**Objetivo:** Substituir as tabelas HTML brutas de `admin/page.tsx` por `DataTable`. Primeira validação do componente em produção.

**Arquivos previstos:**

| Arquivo | Operação | Descrição |
|---|---|---|
| `apps/web/src/app/(admin)/admin/page.tsx` | MODIFY | Substituir 2 instâncias de `<table>` por `DataTable` |

**Estado atual da página:**
- 2 tabelas HTML: Tenants (3-5 colunas) e Usuários por Tenant (3-5 colunas)
- Loading skeleton: `[...Array(4)].map(() => <tr>)` manual com `animate-pulse`
- Empty state: texto inline ("Nenhum tenant cadastrado"), sem `EmptyState`
- Ações: botões Editar/Excluir na última coluna

**Transformação esperada:**
- `import { DataTable, Column } from '@/components/app/data-table'`
- Definição de `Column[]` para Tenants e para Usuários substituindo o JSX de `<thead>` e `<tbody>`
- `<DataTable columns={tenantColumns} data={tenants} loading={loading} emptyTitle="..." />`
- Remoção completa de: `<table`, `<thead`, `<tbody`, `<tr`, `<th`, `<td` (raw HTML)
- Remoção do `[...Array(4)].map` skeleton
- `renderMobileCard` **não obrigatório** nesta tela (admin é exclusivo desktop, sem mobile intenso)

**Risco:** Baixo.
- Tela exclusiva de Super Admin — menor exposição de usuários.
- Tabelas sem estado complexo (sem seleção em massa, sem paginação, sem sort).
- Única fonte de risco: ações de Editar/Excluir nos `render` das colunas. Se o callback for desconectado, as ações quebram silenciosamente.

**Validações objetivas:**
- `grep -n "<table" admin/page.tsx` retorna zero resultados
- Tabela de Tenants renderiza todas as colunas esperadas
- Botões de ação (Editar/Excluir) funcionam nos dois DataTables
- Loading state (skeleton) aparece ao carregar
- Empty state aparece quando `data.length === 0`
- `tsc --noEmit` sem novos erros

**Rollback:** `git checkout -- apps/web/src/app/(admin)/admin/page.tsx`

---

### Fase 6.3 — Migração Visualização de Membros

**Objetivo:** Eliminar o anti-padrão `hidden md:block`/`md:hidden` e adotar `DataTable` com `renderMobileCard`, ativando pela primeira vez o fallback responsivo oficial.

**Arquivos previstos:**

| Arquivo | Operação | Descrição |
|---|---|---|
| `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx` | MODIFY | Remover DOM duplicado; adotar DataTable com renderMobileCard |

**Estado atual da página:**
- `<div className="hidden overflow-x-auto md:block"><table>...</table></div>` (tabela desktop)
- `<div className="divide-y divide-gray-100 md:hidden">` (cards mobile manuais)
- `[1,2,3,4].map((item) => <div className="animate-pulse">)` skeleton manual
- `EmptyState` já importado e em uso — manter sem alteração

**Transformação esperada:**
- `import { DataTable, Column } from '@/components/app/data-table'`
- `import { EntityCard } from '@/components/app/entity-card'`
- Definição de `Column[]` para as 5 colunas: Nome, Contato, Status, Ministérios, Nascimento
- `<DataTable columns={memberColumns} data={membros} loading={loading} renderMobileCard={(membro) => <EntityCard title={membro.nome} ... />} />`
- Remoção de: `hidden md:block`, `hidden overflow-x-auto md:block`, `md:hidden`
- Remoção do `[1,2,3,4].map` skeleton manual
- `EmptyState` existente removido do JSX direto (passa a ser via `DataTable` props `emptyTitle`/`emptyDescription`)

**Risco:** Médio.
- Mudança de responsividade: o breakpoint de transição tabela→card deve ser `md` (768px) para manter consistência com o design do app.
- Se o `renderMobileCard` retornar campos incorretos, a view mobile fica incompleta.
- Filtros desta tela foram migrados na Fase 4 e não devem ser tocados — risco de regressão se o refactor alterar o escopo do componente.

**Validações objetivas:**
- `grep -n "hidden md:block\|md:hidden" membros/visualizacao/page.tsx` retorna zero resultados
- `grep -n "\[1,2,3,4\].map\|animate-pulse" membros/visualizacao/page.tsx` retorna zero resultados
- Desktop (viewport > 768px): tabela exibe 5 colunas sem quebra visual
- Mobile (viewport < 768px): lista de `EntityCard` exibe cada membro com campos de Nome, Contato, Status
- Filtros continuam funcionando (os estados de filtro não foram alterados)
- `tsc --noEmit` sem novos erros

**Rollback:** `git checkout -- apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx`

---

### Fase 6.4 — Migração Grids (Agenda e Ministérios)

**Objetivo:** Substituir cards de div manual por `EntityCard` em `agenda/page.tsx` e `ministerios/page.tsx`, removendo boilerplate e skeletons manuais.

**Arquivos previstos:**

| Arquivo | Operação | Descrição |
|---|---|---|
| `apps/web/src/app/(dashboard)/agenda/page.tsx` | MODIFY | Substituir divs de card por EntityCard |
| `apps/web/src/app/(dashboard)/ministerios/page.tsx` | MODIFY | Substituir divs de card por EntityCard |

**Estado atual — Agenda:**
- Grid: `<div className="grid grid-cols-1 md:grid-cols-3 gap-6">`
- Cards: `<div className="rounded-lg shadow-sm border p-4 bg-white">` (manual)
- Skeleton: manual `animate-pulse` grid
- EmptyState: já em uso — manter

**Estado atual — Ministérios:**
- Grid: `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`
- Cards: `<div>` manual com métricas de membros e líderes
- Skeleton: `Array.from({length: 3}).map(...)` manual com `animate-pulse`
- EmptyState: já em uso — manter

**Transformação esperada (ambos):**
- `import { EntityCard } from '@/components/app/entity-card'`
- O container de grid (`grid grid-cols-1 md:grid-cols-3`) permanece no arquivo de página (não é responsabilidade do EntityCard)
- Cada div de card substituído por `<EntityCard title={...} badge={...} meta={...} actions={...} />`
- Skeleton manual removido. Opções (a definir na Fase 6.1): prop `loading` no EntityCard, ou manter um `CardSkeleton` mínimo no arquivo de página até a criação de um componente dedicado
- `EmptyState` já presente — sem alteração

**Risco:** Baixo.
- Alteração puramente visual; sem mudança de estado ou handlers.
- Cada arquivo pode ser revertido independentemente sem afetar o outro.
- Único risco: se `EntityCard` não aceitar as props específicas de Agenda ou Ministérios, será necessário ajustar a interface criada na Fase 6.1 antes de migrar.

**Validações objetivas (por arquivo):**
- `grep -n "import.*EntityCard" agenda/page.tsx` retorna resultado positivo
- `grep -n "animate-pulse\|Array.from\|\.map.*skeleton" agenda/page.tsx` retorna zero resultados de skeleton manual
- Cards aparecem com o mesmo conteúdo e layout visual de antes
- EmptyState continua aparecendo quando lista vazia
- `tsc --noEmit` sem novos erros

**Rollback:** `git checkout -- apps/web/src/app/(dashboard)/agenda/page.tsx` e `ministerios/page.tsx` de forma independente.

---

### Fase 6.5 — Auditoria Final

**Objetivo:** Verificar os critérios de saída, gerar o relatório formal da Fase 6 e atualizar os documentos de status.

**Arquivos previstos:**

| Arquivo | Operação | Descrição |
|---|---|---|
| `ai-context/plans/ods-phase-6-tables-report.md` | CREATE | Relatório formal da Fase 6 (mesmo formato das Fases 0–5) |
| `ai-context/plans/ods-current-status.md` | UPDATE | Fase 6: 🟡 → ✅; mover para "Fases Concluídas" |
| `ai-context/plans/ods-executive-summary.md` | UPDATE | Status Fase 6 na tabela de fases |
| `ai-context/plans/ods-refactoring-plan.md` | UPDATE | Status Fase 6 na tabela de status |

**Pré-condição:** TODOS os critérios de saída da Seção 3 verificados via grep/glob antes de alterar qualquer documento.

**Risco:** Nenhum (documentação apenas).

**Rollback:** N/A.

---

## 3. Critério de Saída — Quando Fase 6 Muda de 🟡 para ✅

A mudança de status SOMENTE ocorre quando TODOS os 15 critérios abaixo forem verificáveis objetivamente:

### Componentes (2/15)

```
[ ] C1. apps/web/src/components/app/entity-card.tsx EXISTE
         → verificar: Glob "apps/web/src/components/app/entity-card.tsx"

[ ] C2. DataTableProps<T> contém a assinatura:
        renderMobileCard?: (item: T) => React.ReactNode
         → verificar: grep "renderMobileCard" apps/web/src/components/app/data-table.tsx
```

### Admin — /admin (4/15)

```
[ ] C3. admin/page.tsx contém ZERO instâncias de "<table", "<thead", "<tbody"
         → verificar: grep "<table\|<thead\|<tbody" apps/web/src/app/(admin)/admin/page.tsx

[ ] C4. admin/page.tsx importa DataTable
         → verificar: grep "import.*DataTable" apps/web/src/app/(admin)/admin/page.tsx

[ ] C5. admin/page.tsx contém ZERO instâncias de skeleton manual
         → verificar: grep "\.\.\.(Array\|Array\.from\|\.map.*skeleton\|animate-pulse" admin/page.tsx
         (aceita: animate-pulse dentro do DataTable se for internal — não da página)

[ ] C6. admin/page.tsx não contém texto inline de empty state
         → verificar: grep "Nenhum tenant\|Nenhum usuário" admin/page.tsx retorna zero
```

### Visualização de Membros — /membros/visualizacao (3/15)

```
[ ] C7. membros/visualizacao/page.tsx contém ZERO instâncias de "hidden md:block" ou "md:hidden"
         → verificar: grep "hidden md:block\|md:hidden" membros/visualizacao/page.tsx

[ ] C8. membros/visualizacao/page.tsx importa e usa DataTable com renderMobileCard
         → verificar: grep "renderMobileCard" membros/visualizacao/page.tsx

[ ] C9. membros/visualizacao/page.tsx contém ZERO instâncias de skeleton manual
         → verificar: grep "\[1,2,3\|1,2,3,4\]\.map\|Array\.from.*skeleton" membros/visualizacao/page.tsx
```

### Agenda — /agenda (2/15)

```
[ ] C10. agenda/page.tsx importa EntityCard
          → verificar: grep "import.*EntityCard" agenda/page.tsx

[ ] C11. agenda/page.tsx contém ZERO instâncias de skeleton manual de card
          → verificar: grep "Array\.from\|animate-pulse" agenda/page.tsx retorna zero de skeleton
```

### Ministérios — /ministerios (2/15)

```
[ ] C12. ministerios/page.tsx importa EntityCard
          → verificar: grep "import.*EntityCard" ministerios/page.tsx

[ ] C13. ministerios/page.tsx contém ZERO instâncias de skeleton manual de card
          → verificar: grep "Array\.from\|animate-pulse" ministerios/page.tsx retorna zero de skeleton
```

### Build e Documentação (2/15)

```
[ ] C14. tsc --noEmit passa sem novos erros introduzidos pela Fase 6
          → verificar: npx tsc --noEmit (comparar com estado atual)

[ ] C15. ai-context/plans/ods-phase-6-tables-report.md EXISTE
          → verificar: Glob "ai-context/plans/ods-phase-6-tables-report.md"
```

**Todos os 15 = ✅. Qualquer um faltando = 🟡 continua aberta.**

---

## 4. Dependências Entre Sub-etapas

```
6.1 (Infraestrutura)
  ├── 6.2 (Admin)          — requer DataTable.renderMobileCard NÃO obrigatório aqui,
  │                           mas a etapa depende de 6.1 estar merged para ter build estável
  ├── 6.3 (membros/viz)    — requer 6.1 OBRIGATÓRIO (renderMobileCard + EntityCard)
  └── 6.4 (Agenda+Min)     — requer 6.1 OBRIGATÓRIO (EntityCard)
        └── 6.5 (Auditoria) — requer 6.2 + 6.3 + 6.4 TODOS concluídos
```

**6.2 pode rodar em paralelo com 6.3/6.4 após 6.1 merged.**

---

## 5. Recomendação de PRs

**3 PRs, em sequência:**

### PR 1 — Infraestrutura (Fase 6.1)

**Conteúdo:**
- `entity-card.tsx` (novo arquivo)
- `data-table.tsx` (modificação aditiva: prop `renderMobileCard`)

**Rationale:** Isola o risco de modificação do `DataTable` existente. Permite review completo do novo componente antes de qualquer página ser alterada. Merge independente sem impacto em produção (nenhuma página usa `EntityCard` ainda; `renderMobileCard` é opcional no `DataTable`).

---

### PR 2 — Migrações de Tabelas (Fases 6.2 + 6.3)

**Conteúdo:**
- `admin/page.tsx`
- `membros/visualizacao/page.tsx`

**Rationale:** Agrupa as duas migrações que dependem de `DataTable` — a simples (admin, para validar o componente) e a complexa (membros/viz, para validar o `renderMobileCard`). Review visual das tabelas em um único PR facilita a comparação antes/depois.

**Pré-condição:** PR 1 merged.

---

### PR 3 — Migrações de Grids + Auditoria (Fases 6.4 + 6.5)

**Conteúdo:**
- `agenda/page.tsx`
- `ministerios/page.tsx`
- `ai-context/plans/ods-phase-6-tables-report.md` (novo)
- Atualizações de status em `ods-current-status.md`, `ods-executive-summary.md`, `ods-refactoring-plan.md`

**Rationale:** Grids são de baixo risco e independentes das tabelas. O relatório de auditoria fecha o PR com a evidência documental de que todos os critérios foram verificados.

**Pré-condição:** PR 1 merged. Pode ser feito em paralelo com PR 2.

---

## 6. Respostas Objetivas

**1. O que falta obrigatoriamente?**

Quatro itens são P0 (bloqueantes):
- Criar `EntityCard` (`entity-card.tsx`)
- Adicionar `renderMobileCard` ao `DataTable`
- Migrar `admin/page.tsx` para DataTable
- Migrar `membros/visualizacao/page.tsx` para DataTable com renderMobileCard (removendo `hidden md:block`/`md:hidden`)

**2. O que pode ficar para depois?**

Dois itens são P1 (desejáveis, mas não bloqueiam o fechamento formal em uma leitura pragmática):
- `/agenda`: substituir divs de card manual por `EntityCard`
- `/ministerios`: substituir divs de card manual por `EntityCard`

**Ressalva:** o design (Decisão 6) inclui explicitamente Agenda e Ministérios no escopo de EntityCard. Se o critério de fechamento for "design totalmente cumprido", /agenda e /ministerios também são P0. O presente plano os inclui como P0 nos critérios de saída (C10-C13) — a classificação P1 indica apenas que são de menor risco e menor urgência que as quatro pendências acima.

**3. Quantos PRs recomenda?**

**3 PRs:**
- PR 1: Infraestrutura (EntityCard + DataTable.renderMobileCard)
- PR 2: Migrações de Tabelas (admin + membros/visualizacao)
- PR 3: Migrações de Grids + Auditoria (agenda + ministerios + docs)

**4. Qual a ordem de execução?**

```
1. Fase 6.1 (PR 1) — PRIMEIRO e OBRIGATÓRIO
2. Fase 6.2 (PR 2, parte 1) — em paralelo com 6.3 e 6.4 após PR 1 merged
3. Fase 6.3 (PR 2, parte 2) — em paralelo com 6.2
4. Fase 6.4 (PR 3, parte 1) — em paralelo com 6.2/6.3
5. Fase 6.5 (PR 3, parte 2) — ÚLTIMO, após 6.2 + 6.3 + 6.4 concluídos
```

**5. Estimativa de aderência após fechamento?**

| Área | Atual | Após Fase 6 |
|---|---|---|
| Tabelas e Listagens | ~20% | **~95%** |
| (gap residual de 5% = Matriz de Escalas, excluída por Decisão 7 do design) | | |
| **ODS Global** | **> 70%** | **~85%** |

O aumento global de ~15pp reflete que Tabelas e Listagens eram o último grande pilar visual pendente. As áreas de Navegação (0%) e Permissões (0%) permanecerão em aberto para Fase 8.
