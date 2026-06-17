# Auditoria de Fechamento — Fase 6: Tabelas e Listagens (ODS)

Data: 2026-06-16
Escopo: documental e de código — nenhum código foi alterado.

Fontes consultadas:
- `ai-context/plans/ods-phase-6-tables-pre-analysis.md`
- `ai-context/plans/ods-phase-6-tables-design.md`
- `apps/web/src/components/app/data-table.tsx`
- `apps/web/src/components/app/empty-state.tsx`
- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/src/app/(dashboard)/membros/page.tsx`
- `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/page.tsx`
- `apps/web/src/app/(dashboard)/agenda/page.tsx`
- `apps/web/src/app/(dashboard)/ministerios/page.tsx`

---

## Veredicto Geral

**Fase 6 está em estado B — Implementada parcialmente.**

Trabalho significativo foi realizado: o `DataTable` foi estendido com recursos que vão além do design original, o `EmptyState` foi criado e amplamente adotado, e `membros/page.tsx` foi totalmente migrado. No entanto, três entregas obrigatórias do design estão incompletas: `EntityCard` não existe, a migração de `admin/page.tsx` não foi iniciada, e `membros/visualizacao/page.tsx` ainda usa a tabela HTML manual com o padrão `md:hidden` legado.

---

## 1. DataTable

### Existe?

**Sim.** `apps/web/src/components/app/data-table.tsx`

### Foi estendido?

**Sim — e vai além do design original.**

O design especificou um componente que aceita `columns` e `data`. O componente implementado inclui:

| Feature | Design | Implementado |
|---|---|---|
| `columns` + `data` props | ✅ Previsto | ✅ Implementado |
| Loading skeleton interno | Via `TableSkeleton` separado | ✅ Embutido (prop `loading`) |
| EmptyState integrado | Via componente separado | ✅ Embutido (props `emptyTitle`, `emptyDescription`, `emptyAction`) |
| Seleção de linhas (checkboxes) | Não previsto | ✅ Implementado (props `selectedIds`, `onSelectChange`) |
| Paginação integrada | Via `TablePagination` (opcional futuro) | ✅ Implementado (props `currentPage`, `totalItems`, `onPageChange`) |
| `renderMobileCard` prop | ✅ Previsto como padrão B | ❌ **NÃO IMPLEMENTADO** |

**Observação crítica:** A prop `renderMobileCard` — decisão central do design (Decisão 5: "Padrão B — Tabela desktop + EntityCard mobile") — não existe no componente. O `DataTable` atual usa apenas `overflow-x-auto` para scroll horizontal em mobile, o que contradiz a decisão arquitetural aprovada.

### Está em uso?

| Página | Usa DataTable? | Nota |
|---|---|---|
| `membros/page.tsx` | ✅ Sim | Implementação completa: colunas ricas, seleção, paginação, loading, empty state |
| `configuracoes/page.tsx` | ✅ Sim | Dois `DataTable` (usuários e logs de auditoria) — já existia no baseline pré-Fase 6 |
| `admin/page.tsx` | ❌ Não | Ainda usa `<table>` HTML manual |
| `membros/visualizacao/page.tsx` | ❌ Não | Ainda usa `<table>` manual + `md:hidden` |

---

## 2. EntityCard

### Existe?

**Não.** Nenhum arquivo `entity-card.tsx` foi encontrado em `apps/web/src/components/`.

### Está em produção?

**Não.** Nenhuma importação de `EntityCard` foi encontrada em nenhum arquivo do projeto.

**Impacto:** As telas de Agenda e Ministérios continuam usando `<div>` com grid manual (`grid-cols-1 md:grid-cols-3`) para seus cards, conforme descrito como problema na pré-análise. A duplicação de boilerplate de sombra e padding permanece.

---

## 3. EmptyState

### Existe?

**Sim.** `apps/web/src/components/app/empty-state.tsx`

Interface implementada conforme o design: `title`, `description`, `action`, `icon`.

### Foi adotado?

**Sim — adoção ampla.**

| Página | Usa EmptyState? |
|---|---|
| `agenda/page.tsx` | ✅ Sim |
| `ministerios/page.tsx` | ✅ Sim |
| `membros/visualizacao/page.tsx` | ✅ Sim |
| `minhas-escalas/page.tsx` | ✅ Sim |
| `meu-perfil/page.tsx` | ✅ Sim |
| `escalas/visualizacao/page.tsx` | ✅ Sim |
| `data-table.tsx` (built-in) | ✅ Sim |
| `admin/page.tsx` | ❌ Não (usa texto inline "Nenhum tenant cadastrado") |

**Observação:** O `EmptyState` dentro do `DataTable` é chamado via props (`emptyTitle`, `emptyDescription`), tornando sua adoção automática em qualquer uso do `DataTable`.

---

## 4. Responsividade — `renderMobileCard`

**Não implementado.**

O design aprovou explicitamente o "Padrão B (Tabela desktop + EntityCard mobile)" com a prop `renderMobileCard` no `DataTable`. Na prática:

- O `DataTable` não possui esta prop
- `membros/visualizacao/page.tsx` ainda duplica o DOM com `hidden md:block` (tabela) e `md:hidden` (cards manuais)
- A estratégia de responsividade oficial não foi concretizada

---

## 5. Migração das Páginas

### `/admin` (admin/page.tsx)

| Critério | Status |
|---|---|
| DataTable adotado | ❌ Não |
| EmptyState adotado | ❌ Não (texto inline) |
| Loading skeleton padronizado | ❌ Não (`[...Array(4)].map` manual) |
| HTML `<table>` manual removido | ❌ Não |

**Classificação: ⏸ Não iniciada**

---

### `/configuracoes` (configuracoes/page.tsx)

| Critério | Status |
|---|---|
| DataTable adotado | ✅ Sim (2 instâncias) |
| EmptyState via DataTable | ✅ Sim (embutido) |
| Loading via DataTable | ✅ Sim (prop `loading`) |
| HTML `<table>` manual removido | ✅ Sim |

**Nota:** O `DataTable` em `configuracoes` estava presente no baseline pré-Fase 6 (conforme `ods-compliance-matrix.md`: "Alta conformidade"). A versão atual usa o componente estendido. Não há evidência documental clara sobre o que foi alterado especificamente na Fase 6 nesta página.

**Classificação: 🟠 Implementada** (estado ambíguo — DataTable pré-existente, versão estendida em uso, sem auditoria)

---

### `/membros` (membros/page.tsx)

| Critério | Status |
|---|---|
| DataTable adotado | ✅ Sim |
| Colunas com render customizado | ✅ Sim (avatar, status badge, tags coloridas, datas) |
| Seleção em massa via DataTable | ✅ Sim |
| Paginação via DataTable | ✅ Sim |
| Loading via DataTable | ✅ Sim |
| EmptyState via DataTable | ✅ Sim |
| HTML `<table>` manual removido | ✅ Sim |
| Responsividade (renderMobileCard) | ❌ Não (overflow-x-auto apenas) |

**Classificação: 🟠 Implementada sem auditoria** (funcionalidade completa, sem `renderMobileCard`, sem auditoria formal)

---

### `/membros/visualizacao` (membros/visualizacao/page.tsx)

| Critério | Status |
|---|---|
| DataTable adotado | ❌ Não |
| EmptyState adotado | ✅ Sim |
| Loading skeleton padronizado | ❌ Não (`[1,2,3,4].map` manual com `animate-pulse`) |
| HTML `<table>` manual removido | ❌ Não (ainda usa `hidden md:block` / `md:hidden`) |
| Responsividade padrão B | ❌ Não |

**Classificação: 🟡 Parcial** (EmptyState implementado; tabela e responsividade pendentes)

---

### `/agenda` (agenda/page.tsx)

| Critério | Status |
|---|---|
| EmptyState adotado | ✅ Sim |
| EntityCard adotado | ❌ Não (grid de divs manuais) |
| CardSkeleton adotado | ❌ Não (`animate-pulse` manual) |
| Boilerplate de cards removido | ❌ Não |

**Classificação: 🟡 Parcial** (EmptyState implementado; EntityCard e skeleton pendentes)

---

### `/ministerios` (ministerios/page.tsx)

| Critério | Status |
|---|---|
| EmptyState adotado | ✅ Sim |
| EntityCard adotado | ❌ Não (grid de divs manuais com `animate-pulse`) |
| CardSkeleton adotado | ❌ Não (skeleton manual de `Array.from({length: 3})`) |
| Boilerplate de cards removido | ❌ Não |

**Classificação: 🟡 Parcial** (EmptyState implementado; EntityCard e skeleton pendentes)

---

## Resumo de Status por Componente/Entrega

| Entrega | Status | Observação |
|---|---|---|
| `DataTable` (existência) | ✅ Existe e funciona | Mais completo que o design previu |
| `DataTable.renderMobileCard` | ❌ Não implementado | Decisão arquitetural aprovada não concretizada |
| `EmptyState` | ✅ Existe e amplamente adotado | 7+ locais de uso incluindo dentro do DataTable |
| `EntityCard` | ❌ Não existe | Componente mandatório pelo design não criado |
| `TableSkeleton` separado | 🟠 Embutido no DataTable | Diferente do design mas funcionalmente coberto |
| `CardSkeleton` separado | ❌ Não existe | Páginas ainda usam animate-pulse manual |
| Migração `/admin` | ⏸ Não iniciada | Primeira tela planejada; ainda raw HTML |
| Migração `/membros` | 🟠 Implementada | DataTable completo; sem renderMobileCard |
| Migração `/membros/visualizacao` | 🟡 Parcial | EmptyState sim; DataTable não |
| Migração `/configuracoes` | 🟠 Preexistente/Estendida | DataTable estava no baseline |
| Migração `/agenda` (EntityCard) | 🟡 Parcial | EmptyState sim; EntityCard não |
| Migração `/ministerios` (EntityCard) | 🟡 Parcial | EmptyState sim; EntityCard não |

---

## Itens Pendentes para Conclusão da Fase 6

### Obrigatórios (bloqueantes)

1. **Criar `EntityCard`** — Componente mandatório aprovado no design. Necessário para Agenda, Ministérios e como fallback mobile do DataTable.
2. **Migrar `admin/page.tsx`** — Primeira tela do roteiro; ainda usa HTML puro. Menor risco, maior sinalização de conclusão.
3. **Migrar `membros/visualizacao/page.tsx`** — Remover `md:hidden`/`hidden md:block` manual e adotar DataTable.

### Recomendados (melhoria de consistência)

4. **Implementar `renderMobileCard` no `DataTable`** — Decisão arquitetural aprovada. Sem ela, o DataTable não segue o "Padrão B" definido no design.
5. **Migrar cards de Agenda e Ministérios para `EntityCard`** — Após criar o componente.
6. **Criar `CardSkeleton` ou reutilizar o skeleton interno do DataTable** — Remover os `animate-pulse` manuais de Agenda e Ministérios.
7. **Adotar `EmptyState` em `admin/page.tsx`** — Única página sem EmptyState.

---

## Respostas Objetivas

**1. Fase 6 deve continuar aberta?**

**Sim.** Os componentes obrigatórios `EntityCard` e `renderMobileCard` não existem. A migração de `admin/page.tsx` (primeira tela do roteiro) não foi iniciada. `membros/visualizacao/page.tsx` ainda usa tabela HTML manual com o padrão de responsividade legado. A fase não pode ser declarada concluída.

**2. Fase 6 pode receber PR?**

**Sim, para o que foi implementado — com escopo explícito.** O trabalho entregue (DataTable estendido, EmptyState criado e adotado, `membros/page.tsx` migrado) é testável, estável e independente das pendências. Um PR parcial pode ser aberto com documentação clara dos itens restantes em aberto.

**3. Deve atualizar `ods-current-status.md`?**

**Sim.** O status atual do documento lista Fase 6 como "⏸ Não iniciada". A realidade é implementação parcial com trabalho significativo feito. O documento deve ser atualizado para refletir "🟡 Em andamento" com a lista de entregas concluídas e pendentes.

**4. Próxima fase recomendada?**

**Concluir Fase 6 antes de avançar para Fase 8.** A Fase 8 (Permissões e Navegação) depende de tabelas e cards estáveis para gerenciar visibilidade de ações por linha. Iniciar Fase 8 com as tabelas em estado inconsistente aumenta o risco de retrabalho. O roteiro recomendado é:

1. Criar `EntityCard`
2. Migrar `admin/page.tsx`
3. Migrar `membros/visualizacao/page.tsx`
4. Implementar `renderMobileCard` ou documentar formalmente a decisão de não implementá-lo
5. Aplicar `EntityCard` em Agenda e Ministérios
6. Auditar Fase 6 e declarar concluída
7. Iniciar Fase 8
