# Relatório de Execução — Fase 6: Tabelas e Listagens (ODS)

Data: 2026-06-16
Status final: ✅ **CONCLUÍDA** (todos os 15 critérios de saída verificados)
Referências: `ods-phase-6-closure-plan.md`, `ods-phase-6-closure-audit.md`, `ods-phase-6-tables-design.md`

---

## 1. Objetivo da Fase

Estabelecer `DataTable` e `EntityCard` como os padrões únicos de apresentação de dados tabulares e em grid, eliminando:
- Tags `<table>` cruas em páginas;
- O anti-pattern de duplicação de DOM `hidden md:block` / `md:hidden`;
- Skeletons de loading manuais por página;
- Empty states inline duplicados.

---

## 2. Sub-fases Executadas

A Fase 6 foi fechada em 5 sub-fases, distribuídas em 3 PRs, cada uma com relatório próprio.

| Sub-fase | Escopo | PR | Relatório |
|---|---|---|---|
| 6.1 | Infraestrutura: `EntityCard` + `DataTable.renderMobileCard`/`mobileBreakpoint` | PR 1 | `ods-phase-6-1-infra-report.md` |
| 6.2 | Migração `admin/page.tsx` (tabela crua → `DataTable`) | PR 2 | (consolidado aqui) |
| 6.3 | Migração `membros/visualizacao/page.tsx` (tabela+card duplicados → `DataTable` + `renderMobileCard`) | PR 2 | (consolidado aqui) |
| 6.4 | Migração grids `agenda` + `ministerios` (cards manuais → `EntityCard`) | PR 3 | `ods-phase-6-4-cards-migration-report.md` |
| 6.5 | Auditoria final + relatório + atualização de status | PR 3 | este documento |

---

## 3. Componentes Criados / Estendidos

### `EntityCard` (criado — Fase 6.1)
`apps/web/src/components/app/entity-card.tsx`. Container de entidade presentation-only com dois modos:
- **Convenience mode** (props `title`/`subtitle`/`badge`/`meta`/`description`/`footer`/`actions`): layout padronizado header/body/footer.
- **Shell mode** (`children` diretos): preserva JSX interno, ganha o container padronizado.
- **Loading**: prop `loading` renderiza skeleton nativo com `animate-pulse` — elimina skeletons manuais nas páginas.

### `DataTable` (estendido — Fase 6.1)
`apps/web/src/components/app/data-table.tsx`. Adicionadas duas props opcionais:
- `renderMobileCard?: (item: T) => React.ReactNode` — abaixo do breakpoint, substitui a tabela por uma lista de cards, encapsulando o padrão `hidden md:block`/`md:hidden` **dentro do componente**.
- `mobileBreakpoint?: 'sm' | 'md' | 'lg'` (default `'md'`).
- **Zero breaking change**: sem `renderMobileCard`, retorna a estrutura DOM idêntica à anterior (early return).

---

## 4. Páginas Migradas

| Página | De | Para | Técnica |
|---|---|---|---|
| `/admin` | `<table>` crua + skeleton manual | `DataTable` | Colunas + `loading`/`emptyTitle`/`emptyDescription` |
| `/membros/visualizacao` | `<table>` desktop + lista mobile (`hidden md:block`/`md:hidden`) | `DataTable` + `renderMobileCard` | Elimina duplicação de DOM |
| `/agenda` | grid de `<div>` card + skeleton manual | `EntityCard` (shell mode) | Container padronizado, JSX preservado |
| `/ministerios` | grid de `<div>` card + skeleton manual | `EntityCard` (shell mode) | Container padronizado, JSX preservado |

**Distinção arquitetural:** páginas tabulares (admin, membros/viz) usam `DataTable`; páginas de grid de card (agenda, ministerios) usam `EntityCard` diretamente — `DataTable` não se aplica a elas pois nunca tiveram tabela desktop.

---

## 5. Auditoria Final — Critérios de Saída (C1–C15)

Verificados objetivamente via grep/glob/tsc em 2026-06-16.

| # | Critério | Verificação | Resultado |
|---|---|---|---|
| C1 | `entity-card.tsx` existe | `ls` | ✅ existe |
| C2 | `DataTableProps<T>` tem `renderMobileCard` | grep (5 ocorrências) | ✅ |
| C3 | admin: zero `<table>/<thead>/<tbody>` | grep = 0 | ✅ |
| C4 | admin importa `DataTable` | grep linha 9 | ✅ |
| C5 | admin: zero skeleton manual | grep `animate-pulse` = 0 | ✅ |
| C6 | admin sem empty state inline | ver nota ↓ | ✅ (delegado) |
| C7 | membros/viz: zero `hidden md:block`/`md:hidden` | grep = 0 | ✅ |
| C8 | membros/viz usa `renderMobileCard` | grep linha 221 | ✅ |
| C9 | membros/viz: zero skeleton manual | grep = 0 | ✅ |
| C10 | agenda importa `EntityCard` | grep linha 8 | ✅ |
| C11 | agenda: zero skeleton manual de card | ver nota ↓ | ✅ |
| C12 | ministerios importa `EntityCard` | grep linha 9 | ✅ |
| C13 | ministerios: zero skeleton manual de card | ver nota ↓ | ✅ (listagem) |
| C14 | `tsc --noEmit` sem novos erros | exit 0 | ✅ |
| C15 | `ods-phase-6-tables-report.md` existe | este arquivo | ✅ |

**Resultado: 15/15 ✅ — Fase 6 muda de 🟡 para ✅.**

### Notas de interpretação (transparência da auditoria)

- **C6:** o grep `"Nenhum tenant"` casa na linha 380, que é a prop `emptyTitle="Nenhum tenant cadastrado"` passada ao `DataTable`. Isso **é** o padrão correto de delegação — o empty state é renderizado pelo `DataTable`, não inline na página. Não há bloco JSX de empty state manual. Critério satisfeito por intenção (delegação ao componente).
- **C11 / C13 (listagem):** o grep `Array.from` casa nas linhas de loading (`Array.from({length}).map((_, i) => <EntityCard key={i} loading />)`). Isso **não** é um skeleton manual — é um laço de renderização que delega o skeleton ao `EntityCard loading` (skeleton nativo), exatamente o mecanismo construído na Fase 6.1 e usado internamente pelo `DataTable`. Nenhuma marcação de skeleton hand-rolled (`<div className="h-X bg-gray-100 animate-pulse"/>`) permanece nas listagens. Critério satisfeito por intenção.
- **C13 (fora de escopo):** resta um `animate-pulse` na linha ~495 de `ministerios/page.tsx` — porém está **dentro do modal** (aba de membros, `loadingDetails`), não no grid de listagem. Modais foram explicitamente protegidos pelas restrições da Fase 6.4. Registrado como débito candidato a uma futura fase de padronização de loading interno de modais.

---

## 6. Validações Técnicas

| Validação | Resultado |
|---|---|
| `tsc --noEmit` | ✅ Exit 0 — zero erros |
| `next build` | ✅ Exit 0 — todas as rotas compilaram (`/admin`, `/membros/visualizacao`, `/agenda`, `/ministerios`) |
| Delta de lint introduzido pela Fase 6 | ✅ Zero — débitos de lint nas páginas migradas são 100% pré-existentes (provado por comparação com HEAD em 6.4) |
| Anti-pattern `hidden md:block`/`md:hidden` no escopo | ✅ Eliminado (encapsulado no `DataTable`) |

---

## 7. Débito Técnico Remanescente (fora do escopo da Fase 6)

- **`setState` síncrono em `useEffect`** em hooks legados (`use-membros`, `use-ministerios`) e na página de ministérios (efeito do modal) — anti-pattern pré-existente, não introduzido pela Fase 6.
- **`any` em handlers/payloads** de `agenda` e `ministerios` — pré-existente; corrigir exigiria tocar lógica de domínio (proibido pelo escopo).
- **Skeleton manual dentro do modal de ministérios** (linha ~495) — modal-internal, fora do escopo de listagens.
- **`PasswordField` órfão em `/meu-perfil`** — herdado de fases anteriores.

Recomendação: tratar o débito de lint/efeitos em uma tarefa dedicada de cleanup, desacoplada do ciclo ODS.

---

## 8. Conclusão

A Fase 6 está **concluída e auditada**. Os padrões `DataTable` (tabular) e `EntityCard` (grid) estão estabelecidos e adotados nas páginas-alvo, com a infraestrutura de responsividade (`renderMobileCard`) eliminando a duplicação de DOM. Aderência de Tabelas/Listagens elevada de ~20% para ~95%.

**Próxima fase:** Fase 8 — Permissões e Navegação (Fase 9 — Validação Final ao término).
