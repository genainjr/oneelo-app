# OneElo Design System — Resumo Executivo

Última atualização: 2026-06-16
Fonte de verdade: `ai-context/plans/ods-current-status.md`

---

## Estado Atual

O projeto de adoção do ODS está **em andamento estável**. As principais camadas de interação do sistema (formulários, modais, filtros, exportações, confirmações e agora **tabelas e listagens**) foram totalmente padronizadas. Com a Fase 6 concluída, o `DataTable` (tabular) e o `EntityCard` (grid) tornaram-se os padrões únicos de apresentação de dados. As etapas restantes são Permissões/Navegação (Fase 8) e a Validação Final (Fase 9).

---

## Fases por Status

| # | Fase | Status |
|---|---|---|
| 0 | Preparação e Baseline | ✅ Concluída |
| 1 | Fundações Compartilhadas | ✅ Concluída |
| 2 | Confirmações e Feedback | ✅ Concluída |
| 3 | Exportações | ✅ Concluída |
| 4 | Filtros | ✅ Concluída |
| 5 | Modais CRUD | ✅ Concluída |
| 6 | Tabelas e Listagens | ✅ Concluída |
| 7 | Visualizações e Métricas | 🟠 Concluída (sem auditoria dedicada) |
| 8 | Permissões e Navegação | ⏸ Não iniciada |
| 9 | Validação Final | ⏸ Não iniciada |

**Legenda:** ✅ Concluída com todos os artefatos | 🟠 Concluída com lacuna documental | ⏸ Não iniciada

---

## Aderência ODS

| Área | Aderência |
|---|---|
| Filtros | ~100% |
| Exportações | ~100% |
| Formulários (campos) | ~100% |
| Modais | ~100% |
| CRUDs (fluxos de mutação) | ~100% |
| Visualizações / Métricas | ~80% |
| Tabelas / Listagens | ~95% |
| Navegação (Sidebar / Layout) | 0% |
| Permissões (visibilidade UI) | 0% |

**Estimativa global: > 85%**

---

## Componentes ODS Disponíveis

| Componente | Categoria | Adoção |
|---|---|---|
| `ModalShell` + `ModalError` | Modais | 100% |
| `ModalFooter` | Modais | 100% (fluxos CRUD) |
| `TabsShell` | Modais | 100% (modais com abas) |
| `ConfirmDialog` | Feedback | 100% (ações destrutivas) |
| `InputField`, `SelectField`, `TextareaField`, `PasswordField` | Formulários | ~100% |
| `FilterShell` + `FilterActions` | Filtros | 100% (5 telas) |
| `ExportShell` + `useExport` | Exportações | 100% (4 telas) |
| `useFilterState` | Filtros | 100% (5 telas) |
| `StatCard` | Métricas | ~100% |
| `InfoItem` | Views read-only | Alta adoção |
| `DataTable` (+ `renderMobileCard`) | Tabelas | 100% (telas tabulares alvo) |
| `EntityCard` | Listagens / grids | 100% (telas de grid alvo) |
| `EmptyState` | Tabelas / listagens | 100% (delegado via `DataTable` ou inline) |

---

## Próximos Passos

### ✅ Concluído — Fase 6: Tabelas e Listagens

Auditada (15/15 critérios) em 2026-06-16. Relatório: `ods-phase-6-tables-report.md`. Resultado:
- `/admin` e `/membros/visualizacao` migrados para `DataTable` (esta última com `renderMobileCard`, eliminando `hidden md:block`/`md:hidden`).
- `/agenda` e `/ministerios` migrados para `EntityCard`.
- Matriz de escalas mantida com lógica customizada (exceção justificada).
- Aderência em tabelas elevada de ~20% para ~95%.

### Imediato — Fase 8: Permissões e Navegação

- Centralizar uso de `/api/auth/me` em hook/contexto
- Padronizar nomes de flags de permissão visual
- Revisar visibilidade de exportação por perfil

### Final — Fase 9: Validação

- Lint/build/testes
- Validação manual em desktop e mobile
- Validação de todos os perfis (ADMIN, STAFF, BASIC, BASIC líder, SUPER_ADMIN)

---

## Débito Técnico Remanescente

- `setState` dentro de `useEffect` em hooks legados (`use-membros`, `use-ministerios`, etc.) e `any` em handlers — anti-pattern preexistente, não introduzido pela refatoração ODS
- Skeleton manual remanescente **dentro do modal** de `/ministerios` (aba de membros) — fora do escopo de listagens; candidato a padronização futura de loading interno de modais
- Sidebar e regras de visibilidade por permissão aguardando Fase 8

---

## Documentos de Referência

| Documento | Conteúdo |
|---|---|
| `plans/ods-refactoring-plan.md` | Plano mestre com todas as fases |
| `plans/ods-current-status.md` | Estado atual completo com compliance |
| `plans/ods-phase-6-tables-report.md` | Relatório formal da Fase 6 (concluída) |
| `plans/ods-phase-6-1-infra-report.md` | Relatório da infraestrutura (6.1) |
| `plans/ods-phase-6-4-cards-migration-report.md` | Relatório da migração de grids (6.4) |
| `plans/ods-plan-consistency-audit.md` | Auditoria de consistência documental |
| `frontend/ods-compliance-matrix.md` | Matriz de conformidade por tela |
