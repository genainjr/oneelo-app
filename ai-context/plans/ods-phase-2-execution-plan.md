# ODS Phase 2 Execution Plan - Confirmacoes e Feedback

Fonte:

- `ai-context/plans/ods-phase-2-pre-analysis.md`
- `ai-context/plans/ods-refactoring-plan.md`
- `ai-core/skills/oneelo-design-system/CRUD_STANDARD.md`
- `ai-core/skills/oneelo-design-system/FORM_STANDARD.md`

Objetivo: executar exclusivamente a Fase 2, substituindo confirmacoes nativas e alerts por feedback visual padronizado com componentes ODS ja existentes.

---

## Escopo Permitido

Arquivos previstos para alteracao:

| Arquivo | Motivo |
|---|---|
| `apps/web/src/app/(dashboard)/membros/page.tsx` | Substituir `confirm()`/`alert()` por `ConfirmDialog` e feedback visual |
| `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Substituir `confirm()`/`alert()` por `ConfirmDialog` e feedback visual |
| `apps/web/src/app/(dashboard)/agenda/page.tsx` | Substituir `confirm()`/`alert()` por `ConfirmDialog` e feedback visual |
| `apps/web/src/app/(dashboard)/escalas/page.tsx` | Substituir `confirm()` de exclusao/remocao de dia por `ConfirmDialog`; manter toast local |
| `ai-context/plans/ods-refactoring-plan.md` | Adicionar e atualizar status das fases |
| `ai-context/plans/ods-phase-2-feedback-report.md` | Relatorio final da Fase 2 |

Arquivos que nao devem ser alterados:

- Backend
- Prisma
- Banco de dados
- API contracts
- Auth
- Permissoes
- Sidebar/navegacao
- Exportacoes
- Tabelas/listagens fora do feedback

---

## Onde Utilizar ConfirmDialog

| Fluxo | Arquivo | Estado pendente sugerido | ConfirmDialog |
|---|---|---|---|
| Excluir membro | `membros/page.tsx` | `pendingDeleteMembro` | `variant="danger"` |
| Arquivar ministerio | `ministerios/page.tsx` | `pendingArchiveMinisterio` | `variant="warning"` |
| Excluir evento | `agenda/page.tsx` | `pendingDeleteEvento` | `variant="danger"` |
| Excluir escala | `escalas/page.tsx` | `pendingConfirmAction` com tipo `deleteEscala` | `variant="danger"` |
| Remover dia da escala | `escalas/page.tsx` | `pendingConfirmAction` com tipo `removeDia` | `variant="warning"` |

Configuracoes:

- `configuracoes/page.tsx` ja possui modal custom e nao faz parte dos modulos alvo da Fase 2.
- Nao migrar nesta fase para evitar ampliar escopo.

---

## Onde Utilizar ModalError

| Local | Acao |
|---|---|
| Modais ja padronizados (`MembroModal`, `UsuarioModal`) | Ja usam `ModalError`; nao alterar |
| Modais inline de Agenda, Ministerios e Escalas | Nao migrar shell completo nesta fase; usar feedback visual fora do modal quando necessario |

Decisao: nao usar `ModalError` em modais inline ainda, pois isso seria parte da Fase 5 de modais CRUD.

---

## Onde Padronizar Mensagens De Sucesso

| Arquivo | Fluxo | Padrao previsto |
|---|---|---|
| `membros/page.tsx` | Bulk tag aplicada | Feedback visual local |
| `ministerios/page.tsx` | Funcoes salvas | Feedback visual local |
| `escalas/page.tsx` | Criar/remover/status | Manter toast local existente |

Agenda nao possui feedback de sucesso atual para salvar/excluir, entao nao adicionar nova funcionalidade alem de remover alerts de erro e padronizar confirmacao.

---

## Onde Padronizar Mensagens De Erro

| Arquivo | Fluxo | Padrao previsto |
|---|---|---|
| `membros/page.tsx` | Excluir membro, criar tag, bulk tag | Feedback visual local |
| `ministerios/page.tsx` | Salvar ministerio, salvar funcoes, arquivar, membros/papeis | Feedback visual local |
| `agenda/page.tsx` | Salvar/excluir evento | Feedback visual local |
| `escalas/page.tsx` | Ja usa toast local | Manter |

---

## Onde Padronizar Indicadores De Loading

| Arquivo | Fluxo | Ajuste permitido |
|---|---|---|
| `membros/page.tsx` | Confirmacao de exclusao | `ConfirmDialog.loading` durante exclusao |
| `ministerios/page.tsx` | Confirmacao de arquivamento | `ConfirmDialog.loading` durante arquivamento |
| `agenda/page.tsx` | Confirmacao de exclusao | `ConfirmDialog.loading` durante exclusao |
| `escalas/page.tsx` | Excluir escala/remover dia | `ConfirmDialog.loading` durante acao pendente |

Nao alterar loading estrutural de tabelas, cards, hooks ou chamadas de dados.

---

## Estrategia De Implementacao

1. Adicionar `ConfirmDialog` nas paginas alvo.
2. Trocar `confirm()` por estados pendentes e handlers confirmados.
3. Trocar `alert()` por feedback visual local.
4. Manter mensagens existentes sempre que possivel.
5. Preservar os handlers de dominio (`deleteMembro`, `deleteMinisterio`, `deleteEvento`, `deleteEscala`, `removeDia`).
6. Nao alterar contratos, payloads, permissoes ou rotas.
7. Validar TypeScript, build e ESLint focado nos arquivos alterados.

---

## Padrao Visual Para Feedback Local

Como nao existe toast global no ODS e a Fase 2 nao deve criar novo padrao amplo, o feedback local deve seguir o padrao ja existente de blocos inline:

- sucesso: `bg-emerald-50`, `text-emerald-700`, `border-emerald-100`;
- erro: `bg-red-50`, `text-red-700`, `border-red-100`;
- container arredondado `rounded-2xl`;
- botao de fechar simples quando necessario;
- mensagem visivel sem bloquear o navegador.

---

## Criterios De Aceite

| Criterio | Resultado esperado |
|---|---|
| Nenhum `alert()` nos modulos alvo | `membros`, `ministerios`, `agenda` sem `alert()` |
| Nenhum `confirm()` nos modulos alvo | `membros`, `ministerios`, `agenda`, `escalas` sem `confirm()` |
| Acoes destrutivas usam `ConfirmDialog` | Excluir/arquivar/remover dia padronizados |
| Erros permanecem visiveis | Feedback inline/toast local |
| Sucessos nao bloqueiam navegador | Feedback inline/toast local |
| Loading em confirmacao | `ConfirmDialog.loading` usado nas acoes destrutivas |
| Fase 3 nao iniciada | Exportacoes nao alteradas |

