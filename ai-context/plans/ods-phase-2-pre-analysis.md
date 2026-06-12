# ODS Phase 2 Pre-Analysis - Confirmacoes e Feedback

Fonte:

- `ai-context/plans/ods-refactoring-plan.md`
- `ai-context/plans/ods-phase-0-baseline.md`
- `ai-context/plans/ods-phase-1-foundations-report.md`
- `ai-core/skills/oneelo-design-system/`
- Codigo atual em `apps/web/src`

Objetivo: auditar confirmacoes, cancelamentos, feedbacks de erro/sucesso e estados de loading antes da implementacao exclusiva da Fase 2.

---

## Escopo Da Fase 2

Modulos alvo definidos no plano:

- Membros
- Ministerios
- Agenda
- Escalas

Fora de escopo nesta fase:

- Banco de dados
- Prisma
- APIs
- Regras de negocio
- Autenticacao
- Permissoes
- Navegacao
- Exportacoes
- Tabelas/listagens
- Refatoracao ampla de modais CRUD

---

## Dialogs De Confirmacao Existentes

| Tipo | Arquivo | Linha(s) | Fluxo | Padrao atual | Problema |
|---|---|---:|---|---|---|
| Confirmacao nativa | `apps/web/src/app/(dashboard)/membros/page.tsx` | 121 | Excluir membro | `confirm()` | Bloqueia navegador e diverge do ODS |
| Confirmacao nativa | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | 168 | Arquivar ministerio | `confirm()` | Bloqueia navegador e diverge do ODS |
| Confirmacao nativa | `apps/web/src/app/(dashboard)/agenda/page.tsx` | 76 | Excluir evento | `confirm()` | Bloqueia navegador e diverge do ODS |
| Confirmacao nativa | `apps/web/src/app/(dashboard)/escalas/page.tsx` | 465 | Excluir escala | `confirm()` | Bloqueia navegador e diverge do ODS |
| Confirmacao nativa | `apps/web/src/app/(dashboard)/escalas/page.tsx` | 838 | Remover dia da escala | `confirm()` | Bloqueia navegador e diverge do ODS |
| Modal custom isolado | `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | 354 | Desativar usuario | Modal local | Esta fora dos modulos alvo da Fase 2, mas e referencia historica usada na Fase 1 |

---

## Modais De Exclusao / Destruicao

| Modal | Arquivo | Fluxo | Status para Fase 2 |
|---|---|---|---|
| Exclusao de membro | `membros/page.tsx` | `handleDelete(membro)` | Migrar para `ConfirmDialog` |
| Arquivamento de ministerio | `ministerios/page.tsx` | `handleDelete(ministerio)` | Migrar para `ConfirmDialog` |
| Exclusao de evento | `agenda/page.tsx` | `handleDelete(evento)` | Migrar para `ConfirmDialog` |
| Exclusao de escala | `escalas/page.tsx` | `handleDelete()` | Migrar para `ConfirmDialog` |
| Remocao de dia de escala | `escalas/page.tsx` | `onRemoveDia(diaId)` | Migrar para `ConfirmDialog` |
| Desativacao de usuario | `configuracoes/page.tsx` | `handleDelete()` | Manter fora do escopo; ja possui confirmacao custom |

---

## Alerts Encontrados

| Arquivo | Linha(s) | Tipo | Fluxo |
|---|---:|---|---|
| `membros/page.tsx` | 126 | Erro | Erro ao excluir membro |
| `membros/page.tsx` | 143 | Erro | Erro ao criar tag |
| `membros/page.tsx` | 153 | Sucesso | Acao em massa de tag |
| `membros/page.tsx` | 155 | Erro | Erro em acao em massa |
| `ministerios/page.tsx` | 138 | Erro | Erro ao salvar ministerio |
| `ministerios/page.tsx` | 148 | Sucesso | Funcoes salvas |
| `ministerios/page.tsx` | 150 | Erro | Erro ao salvar funcoes |
| `ministerios/page.tsx` | 172 | Erro | Erro ao arquivar ministerio |
| `ministerios/page.tsx` | 195 | Erro | Erro ao adicionar membro |
| `ministerios/page.tsx` | 205 | Erro | Erro ao remover membro |
| `ministerios/page.tsx` | 215 | Erro | Erro ao alterar papel |
| `ministerios/page.tsx` | 227 | Erro | Erro ao salvar funcoes do membro |
| `agenda/page.tsx` | 71 | Erro | Erro ao salvar evento |
| `agenda/page.tsx` | 80 | Erro | Erro ao excluir evento |

---

## Toasts Encontrados

| Arquivo | Linha(s) | Tipo | Fluxo | Observacao |
|---|---:|---|---|---|
| `escalas/page.tsx` | 379-384 | Local | Estado `toast` + `showToast()` | Padrao visual local de sucesso/erro |
| `escalas/page.tsx` | 408 | Erro | Erro ao carregar detalhe | Ja usa toast local |
| `escalas/page.tsx` | 441 | Sucesso | Escala criada | Ja usa toast local |
| `escalas/page.tsx` | 444 | Erro | Erro ao criar escala | Ja usa toast local |
| `escalas/page.tsx` | 456 | Sucesso | Status atualizado | Ja usa toast local |
| `escalas/page.tsx` | 458 | Erro | Erro ao atualizar status | Ja usa toast local |
| `escalas/page.tsx` | 470 | Sucesso | Escala removida | Ja usa toast local |
| `escalas/page.tsx` | 472 | Erro | Erro ao remover escala | Ja usa toast local |
| `escalas/page.tsx` | 496 | Erro | Erro ao atualizar celula | Ja usa toast local |
| `escalas/page.tsx` | 820 | Erro | Erro ao adicionar membro na escala | Ja usa toast local |
| `escalas/page.tsx` | 829 | Erro | Erro ao remover membro da escala | Ja usa toast local |

Nao foi encontrado componente global de toast.

---

## Feedbacks De Sucesso

| Arquivo | Fluxo | Padrao atual | Acao Fase 2 |
|---|---|---|---|
| `membros/page.tsx` | Aplicar tag em massa | `alert()` | Substituir por feedback visual inline/toast local |
| `ministerios/page.tsx` | Salvar funcoes | `alert()` | Substituir por feedback visual inline |
| `escalas/page.tsx` | Criar escala | Toast local | Manter e alinhar com confirmacoes |
| `escalas/page.tsx` | Atualizar status | Toast local | Manter |
| `escalas/page.tsx` | Remover escala | Toast local | Manter |
| `app/page.tsx` | Enviar lead publico | Estado local `success` | Fora do escopo da Fase 2 |
| `meu-perfil/page.tsx` | Alterar senha | Feedback inline | Fora do escopo da Fase 2 |

---

## Feedbacks De Erro

| Arquivo | Fluxo | Padrao atual | Acao Fase 2 |
|---|---|---|---|
| `membros/page.tsx` | Erro de carregamento | Bloco inline com retry | Manter |
| `membros/page.tsx` | Excluir membro, criar tag, bulk tag | `alert()` | Substituir por feedback visual |
| `ministerios/page.tsx` | Erro de carregamento | Bloco inline com retry | Manter |
| `ministerios/page.tsx` | Salvar, funcoes, membros, papel | `alert()` | Substituir por feedback visual |
| `agenda/page.tsx` | Erro de carregamento | Bloco inline com retry | Manter |
| `agenda/page.tsx` | Salvar/excluir evento | `alert()` | Substituir por feedback visual |
| `escalas/page.tsx` | Erro de carregamento | Bloco inline com retry | Manter |
| `escalas/page.tsx` | Acoes operacionais | Toast local | Manter |

---

## Estados De Loading

| Arquivo | Estado | Uso atual |
|---|---|---|
| `membros/page.tsx` | `loading` do `useMembros` | `DataTable` skeleton |
| `ministerios/page.tsx` | `loading` do `useMinisterios` | Skeleton de cards |
| `ministerios/page.tsx` | `loadingDetails` | Skeleton/lista e combobox |
| `ministerios/page.tsx` | `savingFuncoes` | Desabilita botao e altera label |
| `ministerios/page.tsx` | `savingFuncoesMembro` | Desabilita botao por membro e altera label |
| `agenda/page.tsx` | `loading` do `useEventos` | Skeleton de cards |
| `escalas/page.tsx` | `loading` do `useEscalas` | Skeleton de lista |
| `escalas/page.tsx` | `loadingDetail` | Skeleton de detalhe |
| `escalas/page.tsx` | `creating` | Desabilita criacao de escala e altera label |
| `EscalaGrid` | `savingDia` | Desabilita fluxo de adicionar dia |
| `CellMemberSelect` | `saving` | Desabilita select durante adicao |

---

## Componentes ODS Disponiveis Para A Fase 2

| Componente | Arquivo | Uso planejado |
|---|---|---|
| `ConfirmDialog` | `apps/web/src/components/app/confirm-dialog.tsx` | Confirmacoes destrutivas |
| `ModalError` | `apps/web/src/components/app/modal-shell.tsx` | Erro inline dentro de modais quando aplicavel |
| `ModalShell` | `apps/web/src/components/app/modal-shell.tsx` | Base de dialogs quando houver modal ja migravel com baixo risco |

---

## Riscos Da Implementacao

| Risco | Impacto | Mitigacao |
|---|---|---|
| Alterar fluxo destrutivo pode mudar a ordem de fechamento de modais | Regressao visual ou estado preso | Manter handlers existentes e trocar apenas gatilho de confirmacao |
| Ministerios tem modal complexo com tabs | Risco alto se migrar shell inteiro | Nao migrar modal completo na Fase 2; apenas feedback e confirmacao |
| Escalas tem acoes contextuais dentro de grade | Estado de confirmacao precisa preservar `diaId`/escala selecionada | Usar estado explicito para acao pendente |
| Nao ha toast global | Criar novo padrao amplo seria fora do escopo | Usar feedback visual local padronizado sem alterar arquitetura global |

