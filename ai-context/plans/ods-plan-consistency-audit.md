# Auditoria de Consistência do Plano ODS

Data: 2026-06-16
Escopo: documental — nenhum código foi alterado.

Fontes consultadas:
- `ai-context/plans/ods-refactoring-plan.md`
- `ai-context/plans/ods-current-status.md`
- `ai-context/product/ods-current-status.md`
- `ai-context/plans/ods-independent-audit.md`
- `ai-context/plans/ods-phase-0-baseline.md`
- `ai-context/plans/ods-phase-1-foundations-report.md`
- `ai-context/plans/ods-phase-1-audit-fixes.md`
- `ai-context/plans/ods-phase-2-pre-analysis.md`
- `ai-context/plans/ods-phase-2-execution-plan.md`
- `ai-context/plans/ods-phase-2-feedback-report.md`
- `ai-context/plans/ods-phase-3-pre-analysis.md`
- `ai-context/plans/ods-phase-3-design.md`
- `ai-context/plans/ods-phase-3-export-report.md`
- `ai-context/plans/ods-phase-3-audit.md`
- `ai-context/plans/ods-phase-4-filters-pre-analysis.md`
- `ai-context/plans/ods-phase-4-filters-design.md`
- `ai-context/plans/ods-phase-4-filters-report.md`
- `ai-context/plans/ods-phase-4-audit.md`
- `ai-context/plans/ods-phase-5-crud-modals-pre-analysis.md`
- `ai-context/plans/ods-phase-5-crud-modals-design.md`
- `ai-context/plans/ods-phase-5-crud-modals-report.md`
- `ai-context/plans/ods-phase-5-crud-modals-audit.md`
- `ai-context/plans/ods-phase-6-tables-pre-analysis.md`
- `ai-context/plans/ods-phase-6-tables-design.md`
- `ai-context/frontend/ods-compliance-matrix.md`

---

## Situação Atual

O projeto possui documentação gerada ao longo da execução de cada fase ODS, com padrões bem estabelecidos de pré-análise → design → relatório → auditoria. A maioria das fases concluídas segue este padrão com consistência. Existem, porém, **três divergências estruturais** que comprometem a leitura do estado real por qualquer membro da equipe que tome o plano como verdade única:

1. **Fases 4 e 6 estão com os nomes invertidos entre o plano e os documentos de execução.**
2. **Fase 7 está marcada como concluída com evidência que não existe no projeto.**
3. **Dois arquivos `ods-current-status.md` coexistem com estados conflitantes.**

---

## Estado Real por Fase

### Fase 0 — Preparação e Baseline

| Item | Status |
|---|---|
| Nome no plano | Preparação e Baseline |
| Status no plano | Concluída |
| Pré-análise / Design | N/A (fase não cria componentes) |
| Documento de implementação | `ods-phase-0-baseline.md` ✅ |
| Documento de auditoria | N/A (fase não modifica código) |
| Evidência de merge | N/A |
| Pendências | Nenhuma |

**Classificação: ✅ Concluída**

---

### Fase 1 — Fundações Compartilhadas

| Item | Status |
|---|---|
| Nome no plano | Fundações Compartilhadas |
| Status no plano | Concluída |
| Pré-análise / Design | N/A |
| Documento de implementação | `ods-phase-1-foundations-report.md` ✅ |
| Documento de auditoria | `ods-independent-audit.md` (seção Fase 1) + `ods-phase-1-audit-fixes.md` ✅ |
| Evidência de merge | Não registrada em documento |
| Pendências | Nenhuma |

**Nota:** O `ods-independent-audit.md` identificou duas pendências pós-Fase 1 (FilterShell órfão e PasswordField duplicado em /meu-perfil). Ambas foram resolvidas — a primeira na Fase 4 (filtros), a segunda no `ods-phase-1-audit-fixes.md`. O documento de auditoria independente, no entanto, nunca foi atualizado para marcar esses pontos como resolvidos.

**Classificação: ✅ Concluída**

---

### Fase 2 — Confirmações e Feedback

| Item | Status |
|---|---|
| Nome no plano | Confirmações e Feedback |
| Status no plano | Concluída |
| Pré-análise / Design | `ods-phase-2-pre-analysis.md` + `ods-phase-2-execution-plan.md` ✅ |
| Documento de implementação | `ods-phase-2-feedback-report.md` ✅ |
| Documento de auditoria | **Não existe** — cobertura indireta via `ods-independent-audit.md` |
| Evidência de merge | Não registrada em documento |
| Pendências | Nenhuma funcional |

**Nota:** Esta é a única fase executada que não possui documento de auditoria dedicado no padrão `ods-phase-2-audit.md`. O `ods-independent-audit.md` validou o resultado de Fase 2 com "PASSOU", mas foi escrito no contexto de Fase 1+2 e não segue a estrutura de auditoria isolada adotada a partir da Fase 3.

**Classificação: 🟠 Implementada sem auditoria dedicada**

---

### Fase 3 — Exportações

| Item | Status |
|---|---|
| Nome no plano | Exportações |
| Status no plano | Concluída |
| Pré-análise / Design | `ods-phase-3-pre-analysis.md` + `ods-phase-3-design.md` ✅ |
| Documento de implementação | `ods-phase-3-export-report.md` ✅ |
| Documento de auditoria | `ods-phase-3-audit.md` ✅ |
| Evidência de merge | Não registrada em documento |
| Pendências | Nenhuma |

**Classificação: ✅ Concluída**

---

### Fase 4 no plano = "Tabelas e Listagens" / Fase 6 nos documentos

> **ATENÇÃO — DIVERGÊNCIA CRÍTICA DE NUMERAÇÃO. Ver seção "Divergências".**

| Item | Status |
|---|---|
| Nome no plano | Fase 4 — Tabelas e Listagens |
| Nome nos documentos | Phase 6 — Tabelas (ods-phase-6-tables-*) |
| Status no plano | Não iniciada |
| Pré-análise / Design | `ods-phase-6-tables-pre-analysis.md` + `ods-phase-6-tables-design.md` ✅ (existem mas referem "phase-6") |
| Documento de implementação | **Não existe** |
| Documento de auditoria | **Não existe** |
| Evidência de merge | N/A |
| Pendências | Implementação integralmente pendente |

**Classificação: ⏸ Não iniciada** (design e pré-análise concluídos, nomeados como Phase 6)

---

### Fase 5 — Modais CRUD

| Item | Status |
|---|---|
| Nome no plano | Modais CRUD |
| Status no plano | Concluída |
| Pré-análise / Design | `ods-phase-5-crud-modals-pre-analysis.md` + `ods-phase-5-crud-modals-design.md` ✅ |
| Documento de implementação | `ods-phase-5-crud-modals-report.md` ✅ |
| Documento de auditoria | `ods-phase-5-crud-modals-audit.md` ✅ |
| Evidência de merge | Não registrada em documento |
| Pendências | Nenhuma |

**Classificação: ✅ Concluída**

---

### Fase 6 no plano = "Filtros" / Fase 4 nos documentos

> **ATENÇÃO — DIVERGÊNCIA CRÍTICA DE NUMERAÇÃO. Ver seção "Divergências".**

| Item | Status |
|---|---|
| Nome no plano | Fase 6 — Filtros |
| Nome nos documentos | Phase 4 — Filtros (ods-phase-4-*) |
| Status no plano | Concluída |
| Evidência citada no plano | `ods-phase-4-filters-report.md` (plano já cita o nome correto do arquivo, mas chama de Fase 6) |
| Pré-análise / Design | `ods-phase-4-filters-pre-analysis.md` + `ods-phase-4-filters-design.md` ✅ |
| Documento de implementação | `ods-phase-4-filters-report.md` ✅ |
| Documento de auditoria | `ods-phase-4-audit.md` ✅ |
| Pendências | Nenhuma |

**Classificação: ✅ Concluída** (mas com número de fase incompatível com o plano)

---

### Fase 7 — Visualizações e Métricas

| Item | Status |
|---|---|
| Nome no plano | Visualizações e Métricas |
| Status no plano | Concluída |
| Evidência citada no plano | `artifacts/walkthrough.md` |
| Existência da evidência | **NÃO EXISTE** — arquivo não encontrado no projeto |
| Pré-análise / Design | **Não existe** `ods-phase-7-*.md` |
| Documento de implementação | **Não existe** `ods-phase-7-report.md` — trabalho descrito apenas em `plans/ods-current-status.md` |
| Documento de auditoria | **Não existe** |
| Pendências | Falta formalização documental no padrão das outras fases |

**Nota:** O conteúdo da Fase 7 está descrito em `plans/ods-current-status.md` (InfoItem, MemberProfileDrawer reduzido, escala-shared.tsx, meu-perfil e minhas-escalas). A implementação ocorreu, mas a ausência de relatório dedicado e a referência a um arquivo inexistente tornam a evidência inverificável pelos padrões estabelecidos nas fases anteriores.

**Classificação: 🟠 Implementada sem relatório formal nem auditoria** (evidência inválida no plano)

---

### Fase 8 — Permissões e Navegação

| Item | Status |
|---|---|
| Nome no plano | Permissões e Navegação |
| Status no plano | Não iniciada |
| Pré-análise / Design | Não existe |
| Documento de implementação | Não existe |
| Documento de auditoria | Não existe |

**Classificação: ⏸ Não iniciada**

---

### Fase 9 — Validação Final

| Item | Status |
|---|---|
| Nome no plano | Validação Final |
| Status no plano | Não iniciada |
| Pré-análise / Design | Não existe |
| Documento de implementação | Não existe |
| Documento de auditoria | Não existe |

**Classificação: ⏸ Não iniciada**

---

## Divergências Encontradas

### D1 — CRÍTICA: Fases 4 e 6 com numeração invertida entre plano e documentos

**Plano (`ods-refactoring-plan.md`) diz:**
- Seção `## Fase 4` = Tabelas e Listagens (não iniciada)
- Seção `## Fase 6` = Filtros (concluída)
- Ordem recomendada: "5. Fase 4 - Tabelas → 6. Fase 5 - Modais → 7. Fase 6 - Filtros"

**Documentos de execução dizem:**
- `ods-phase-4-filters-*.md` (4 arquivos) = Filtros
- `ods-phase-5-crud-modals-*.md` (4 arquivos) = Modais CRUD
- `ods-phase-6-tables-*.md` (2 arquivos) = Tabelas

**A contradição é explícita no próprio plano:** na tabela de status, ao declarar "Fase 6 - Filtros" como concluída, o plano cita `ods-phase-4-filters-report.md` como evidência — cruzando deliberadamente o número de fase (6) com um arquivo nomeado phase-4. Isso indica que o plano foi parcialmente atualizado para refletir a mudança de execução (pular Tabelas, fazer Filtros primeiro), mas as seções `## Fase 4` e `## Fase 6` do corpo do plano nunca foram trocadas.

**Por que ocorreu:** A execução real descartou a ordem original (Tabelas → Modais → Filtros) e fez Filtros antes de Tabelas. Os documentos de execução refletem a nova ordem. O plano teve sua tabela de status parcialmente corrigida, mas o corpo e a ordem recomendada não foram atualizados.

**Impacto:** Qualquer membro da equipe que leia o plano e tente cruzar com os documentos por número de fase vai referenciar a fase errada. "Fase 4 do plano" ≠ "ods-phase-4-*".

---

### D2 — CRÍTICA: Fase 7 com evidência inexistente

**Plano diz:** Fase 7 concluída, evidência: `artifacts/walkthrough.md`

**Realidade:**
- `artifacts/walkthrough.md` **não existe** no projeto (glob retornou vazio)
- Nenhum arquivo `ods-phase-7-*.md` existe em `ai-context/plans/`
- A única documentação existente de Fase 7 está em `plans/ods-current-status.md` (seção "Fase 7: Visualizações e Métricas"), sem seguir o padrão pré-análise → design → relatório → auditoria

**Impacto:** A Fase 7 é a única fase marcada como concluída sem evidência verificável no padrão estabelecido. O link no plano está quebrado.

---

### D3 — MAJOR: Dois arquivos `ods-current-status.md` com estados conflitantes

**Localização:**
- `ai-context/plans/ods-current-status.md` — atualizado após Fase 5 e Fase 7
- `ai-context/product/ods-current-status.md` — desatualizado (estado pré-Fase 5)

**Conflito de compliance:**

| Área | plans/ (atual) | product/ (desatualizado) |
|---|---|---|
| Formulários | ~100% | ~50% |
| Modais | ~100% | ~50% |
| CRUDs | ~100% | ~20% |
| Fase 5 (Modais CRUD) | Listada como concluída | **Ausente** |
| Fase 7 (Visualizações) | Listada como concluída | **Ausente** |

**O `product/ods-current-status.md` ainda lista como próximas prioridades** os Modais CRUD (Fase 5) e Navegação — estados que não refletem mais a realidade.

**Impacto:** Qualquer leitor do documento em `product/` tem uma imagem dois ciclos atrás do estado real do projeto.

---

### D4 — MENOR: `ods-independent-audit.md` lista problemas já resolvidos sem atualização

**Documento:** `ai-context/plans/ods-independent-audit.md`

**Problemas listados como ativos no documento:**
1. "FilterShell e FilterActions não estão sendo utilizados em nenhuma tela" → **resolvido na Fase 4**
2. "Definição local duplicada de PasswordField em /meu-perfil" → **resolvido em ods-phase-1-audit-fixes.md**

**Aderência geral reportada no documento:** ~25% → número pré-Fases 3, 4, 5, 7.

**Impacto:** O documento não foi arquivado nem atualizado. Leitores podem interpretá-lo como auditoria corrente e concluir que FilterShell é código morto ou que há duplicidade em /meu-perfil, quando ambos estão resolvidos.

---

### D5 — MENOR: Fase 2 sem auditoria dedicada

**Fases com auditoria dedicada:** 3 (ods-phase-3-audit.md), 4 (ods-phase-4-audit.md), 5 (ods-phase-5-crud-modals-audit.md)

**Fase 2:** auditada apenas via `ods-independent-audit.md` (documento de escopo mais amplo, não dedicado)

**Impacto:** Menor, pois o resultado de Fase 2 no independent audit foi "PASSOU" sem ressalvas. A inconsistência é de padronização documental, não de risco de regressão.

---

## Numeração Corrigida

A numeração correta é aquela usada pelos documentos de execução, pois reflete a ordem real de implementação e está consolidada em 10 arquivos de pré-análise, design, relatório e auditoria.

| Fase | Nome correto | Nome atual no plano | Situação |
|---|---|---|---|
| 0 | Preparação e Baseline | Fase 0 — correto | ✅ Sem divergência |
| 1 | Fundações Compartilhadas | Fase 1 — correto | ✅ Sem divergência |
| 2 | Confirmações e Feedback | Fase 2 — correto | ✅ Sem divergência |
| 3 | Exportações | Fase 3 — correto | ✅ Sem divergência |
| **4** | **Filtros** | Fase 4 — Tabelas (errado) | ❌ **Plano invertido** |
| 5 | Modais CRUD | Fase 5 — correto | ✅ Sem divergência |
| **6** | **Tabelas e Listagens** | Fase 6 — Filtros (errado) | ❌ **Plano invertido** |
| 7 | Visualizações e Métricas | Fase 7 — correto | ✅ Sem divergência (nome certo, evidência quebrada) |
| 8 | Permissões e Navegação | Fase 8 — correto | ✅ Sem divergência |
| 9 | Validação Final | Fase 9 — correto | ✅ Sem divergência |

**Correção necessária no `ods-refactoring-plan.md`:**
- Trocar os conteúdos das seções `## Fase 4` e `## Fase 6`
- Atualizar a tabela de status para refletir: Fase 4 = Filtros (concluída), Fase 6 = Tabelas (não iniciada)
- Atualizar a "Ordem Recomendada de Execução"
- Corrigir a evidência de Fase 7 (remover referência a `artifacts/walkthrough.md`)

---

## Status Corrigido

| Fase | Nome | Status Corrigido | Observação |
|---|---|---|---|
| 0 | Preparação e Baseline | ✅ Concluída | |
| 1 | Fundações Compartilhadas | ✅ Concluída | |
| 2 | Confirmações e Feedback | 🟠 Implementada sem auditoria dedicada | Sem impacto funcional conhecido |
| 3 | Exportações | ✅ Concluída | |
| 4 | Filtros | ✅ Concluída | Plano atualmente chama de Fase 6 — numeração errada |
| 5 | Modais CRUD | ✅ Concluída | |
| 6 | Tabelas e Listagens | ⏸ Não iniciada | Design e pré-análise existem (ods-phase-6-tables-*); plano atualmente chama de Fase 4 — numeração errada |
| 7 | Visualizações e Métricas | 🟠 Implementada sem relatório formal | Evidência no plano é link quebrado |
| 8 | Permissões e Navegação | ⏸ Não iniciada | |
| 9 | Validação Final | ⏸ Não iniciada | |

**Fases efetivamente concluídas (com todos os artefatos esperados):** 0, 1, 3, 5
**Fases concluídas com lacuna documental:** 2 (sem auditoria dedicada), 4 (numeração), 7 (sem relatório, evidência inválida)
**Fases em aberto:** 6, 8, 9

---

## Aderência ODS Recalculada

Fonte primária: `plans/ods-current-status.md` (mais recente, pós-Fase 7) e auditorias dedicadas de Fases 3, 4 e 5.

| Área | Fonte | Aderência |
|---|---|---|
| Filtros | ods-phase-4-audit.md | ~100% |
| Exportações | ods-phase-3-audit.md | ~100% |
| Formulários (campos) | ods-phase-5-crud-modals-audit.md | ~100% |
| Modais | ods-phase-5-crud-modals-audit.md | ~100% |
| CRUDs (fluxos de mutação) | ods-phase-5-crud-modals-audit.md | ~100% |
| Visualizações / Métricas | plans/ods-current-status.md | ~80% (sem auditoria formal) |
| Tabelas / Listagens | ods-phase-6-tables-pre-analysis.md + current-status | ~20% |
| Navegação (Sidebar / Layout) | plans/ods-current-status.md | 0% |
| Permissões (visibilidade UI) | plans/ods-current-status.md | 0% |

**Estimativa global:** > 70% (conforme `plans/ods-current-status.md`)

**O que NÃO se deve usar como referência de aderência:**
- `product/ods-current-status.md` — desatualizado (reporta Formulários/Modais a ~50%, CRUDs a ~20%)
- `ods-independent-audit.md` — reporta ~25% de aderência, estado pré-Fases 3, 4, 5, 7

---

## Recomendação

Os seguintes documentos precisam ser atualizados antes que o estado do projeto possa ser comunicado com precisão. Listados por prioridade:

### Prioridade 1 — Corrigir o plano mestre

**Arquivo:** `ai-context/plans/ods-refactoring-plan.md`

Alterações necessárias:
1. Trocar os conteúdos das seções `## Fase 4` e `## Fase 6` para que Fase 4 = Filtros e Fase 6 = Tabelas
2. Atualizar a tabela de status: Fase 4 = Filtros (concluída, evidência: ods-phase-4-filters-report.md); Fase 6 = Tabelas (não iniciada, evidência: ods-phase-6-tables-design.md)
3. Corrigir a "Ordem Recomendada de Execução" para refletir a sequência real
4. Corrigir a evidência de Fase 7: substituir `artifacts/walkthrough.md` por `ai-context/plans/ods-current-status.md`

### Prioridade 2 — Consolidar os dois current-status

**Arquivo a arquivar/deprecar:** `ai-context/product/ods-current-status.md`

O `product/ods-current-status.md` está dois ciclos de fases atrás. Recomenda-se:
- Ou substituir seu conteúdo pelo conteúdo atual de `plans/ods-current-status.md`
- Ou adicionar cabeçalho de deprecação explícito com link para `plans/ods-current-status.md`

### Prioridade 3 — Criar relatório formal da Fase 7

**Arquivo a criar:** `ai-context/plans/ods-phase-7-visualizations-report.md`

O trabalho existe (conforme descrito em `plans/ods-current-status.md`), mas sem documento dedicado no padrão das outras fases. Criar o relatório com:
- Componentes criados: `InfoItem`, `escala-shared.tsx`
- Telas refatoradas: `/meu-perfil`, `/minhas-escalas`, `MemberProfileDrawer`, `/dashboard`
- Validações realizadas
- Aderência antes/depois

### Prioridade 4 — Atualizar o audit independente

**Arquivo:** `ai-context/plans/ods-independent-audit.md`

Adicionar bloco no início do documento deixando claro que se trata de auditoria histórica (pós-Fase 1), com nota de que todas as pendências listadas foram resolvidas:
- FilterShell: resolvido na Fase 4
- PasswordField duplicado: resolvido em ods-phase-1-audit-fixes.md
- Aderência geral reportada (~25%): obsoleta, ver plans/ods-current-status.md

---

## Respostas Objetivas

**1. Qual é a numeração correta?**

A numeração dos documentos de execução é a correta, pois reflete a ordem real de implementação:
- Fase 4 = Filtros (não Tabelas)
- Fase 5 = Modais CRUD
- Fase 6 = Tabelas e Listagens (não Filtros)
- Fase 7 = Visualizações e Métricas

O plano (`ods-refactoring-plan.md`) está com as seções 4 e 6 invertidas em relação a todos os documentos de execução.

**2. Quais fases realmente estão concluídas?**

Com todos os artefatos no padrão esperado (implementação + auditoria): **Fases 0, 1, 3, 5.**

Com implementação confirmada mas lacuna documental:
- **Fase 2** — implementada, auditada indiretamente (sem ods-phase-2-audit.md dedicado)
- **Fase 4 (Filtros)** — concluída com todos os artefatos, mas numerada como "Fase 6" no plano
- **Fase 7** — implementada, sem relatório formal e com evidência inválida no plano

**3. Qual fase está aberta agora?**

**Fase 6 — Tabelas e Listagens** (denominada "Fase 4" incorretamente no plano atual).

Os documentos de design (`ods-phase-6-tables-design.md`) e pré-análise (`ods-phase-6-tables-pre-analysis.md`) estão concluídos e aprovados. A implementação aguarda início. Componentes a criar: `DataTable`, `EmptyState`, `TableSkeleton`, `CardSkeleton`, `EntityCard`.

**4. Quais documentos devem ser atualizados?**

| Documento | Tipo de atualização |
|---|---|
| `plans/ods-refactoring-plan.md` | Trocar seções Fase 4/6, corrigir tabela de status, corrigir evidência de Fase 7 |
| `product/ods-current-status.md` | Deprecar ou sincronizar com `plans/ods-current-status.md` |
| `plans/ods-independent-audit.md` | Adicionar nota histórica; marcar pendências como resolvidas |
| (criar) `plans/ods-phase-7-visualizations-report.md` | Formalizar entregas da Fase 7 |

**5. O resumo executivo precisa ser corrigido?**

**Sim**, mas apenas o localizado em `product/ods-current-status.md`.

O resumo em `plans/ods-current-status.md` está correto e atualizado.

O resumo enviado à equipe anteriormente com base no plano (`ods-refactoring-plan.md`) chamou Filtros de "Fase 6" e Tabelas de "Fase 4" — o que está correto segundo o plano atual, mas diverge dos arquivos de execução. Após a correção do plano, o resumo executivo deve ser reemitido com a numeração alinhada aos documentos de execução.
