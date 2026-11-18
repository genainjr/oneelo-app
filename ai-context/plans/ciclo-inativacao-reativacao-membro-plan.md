# Plano - Ciclo Completo de Inativação, Exclusão Coordenada e Reativação de Membros e Usuários

Status geral: concluido  
Data de criação: 2026-11-17  
Branch sugerida para implementação: feature/ciclo-inativacao-reativacao-membro  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Plano de Revisão e Atualização de Membro Existente na Triagem](triagem-atualizacao-duplicidade-membro-plan.md)
- [Plano de Fluxo Familiar e Dependente sem Celular Próprio no Auto-Cadastro](auto-cadastro-familiar-dependente-plan.md)
- [Plano de Auto-Cadastro Público e Triagem Pastoral (FT-018)](novo-membro-auto-cadastro-plan.md)
- [Regras de Negócio e Validações](../business-rules/validation-rules.md)
- [Decisões Arquiteturais](../architecture/decisions.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)

---

## 1. Objetivo da Entrega

Fechar o ciclo completo entre cadastro de **Membro** e ciclo de acesso de **Usuário**, eliminando inconsistências operacionais quando uma pessoa sai da igreja, tem um cadastro de teste excluído ou retorna futuramente pelo auto-cadastro (`/join/[slug]`):

1. **Inativação coordenada no cadastro de Membros (`ATIVO` → `INATIVO` / `TRANSFERIDO`):** quando o operador alterar o status de um membro para `INATIVO` ou `TRANSFERIDO` em `MembroModal`, exibir opção clara (pré-marcada para contas `BASIC`) para desativar na mesma transação o `User` vinculado, mantendo histórico financeiro, auditoria e credenciais preservadas para eventual retorno — protegendo estritamente contas `ADMIN` e `STAFF`.
2. **Reativação manual assistida no cadastro de Membros (`INATIVO` / `TRANSFERIDO` → `ATIVO`):** ao retornar um membro para `ATIVO` na edição (`PATCH /api/membros/:id`), validar a cota do plano e oferecer opção explícita (desmarcada por padrão) para reativar a conta `BASIC` desativada e gerar novo link de ativação de 72h.
3. **Exclusão coordenada de Membro com Usuário vinculado (`DELETE /api/membros/:id` e `POST /api/membros/bulk-delete`):**
   - Informar no diálogo de exclusão quando houver conta de acesso vinculada e permitir desativar/desvincular contas `BASIC` junto ao soft delete do membro.
   - Remover fisicamente apenas usuários `BASIC` ainda `PENDING` e sem nenhum registro histórico/restrito (`AuditLog`, `FinancialTransaction`, `EscalaItem`, `FinancePermission`), liberando imediatamente o e-mail e o telefone para recadastro/testes; para usuários que já tiveram atividade, desativar (`DISABLED`), desvincular `memberId = null` e liberar `telefoneLogin = null` preservando integridade referencial e auditoria.
   - Para contas `ADMIN`/`STAFF`, jamais desativar o acesso ao excluir o membro — apenas desvincular `memberId = null`.
4. **Reconhecimento e reativação segura de ex-membros no auto-cadastro (`/join/[slug]` e `/membros?tab=fichas`):**
   - Fazer a deduplicação (`checkMemberDuplicity` e `loadMemberDuplicityContext`) reconhecer também membros `INATIVO` e `TRANSFERIDO` (`deletedAt: null`), priorizando correspondência ativa (`ATIVO`/`VISITANTE`) e nome exato em múltiplos matches para não confundir familiares que compartilham WhatsApp.
   - Exibir alerta próprio na triagem (`"Ex-membro encontrado (Inativo / Transferido)"`) e permitir na revisão (`SolicitacaoDuplicidadeModal`) reativar o mesmo registro de membro para `ATIVO` (validando cota do plano) e, mediante consentimento explícito por checkbox (desmarcado por padrão), reativar a conta `BASIC` `DISABLED` para `PENDING` gerando novo link de ativação de 72h na mesma conta existente (sem conflito de e-mail/telefone duplicado).

---

## 2. Contexto e Diagnóstico

1. **Desconexão entre `Membro` e `User` na exclusão (`apps/api/src/modules/membros/membros.service.ts`):**
   - `remove` e `bulkRemove` aplicam apenas soft delete em `Membro` (`deletedAt`), apagam a foto no storage e removem vínculos ministeriais/tags, deixando o `User` vinculado ativo (`status: ACTIVE`/`PENDING`) e mantendo `email` e `telefoneLogin` presos mesmo quando a exclusão foi feita para limpar um teste ou erro de cadastro.
2. **Desconexão na inativação manual (`MembroModal` e `MembrosService.update`):**
   - Mudar o membro para `INATIVO` ou `TRANSFERIDO` no modal não avisa nem oferece desativação da conta de acesso vinculada; além disso, `MembrosService.update` não valida cota do plano quando um membro `INATIVO`/`TRANSFERIDO`/`VISITANTE` é alterado para `ATIVO`.
3. **Ponto cego na triagem de retorno (`apps/api/src/modules/membros/member-deduplication.helper.ts` e `solicitacoes-cadastro.service.ts`):**
   - `loadMemberDuplicityContext` e `checkMemberDuplicity` filtram apenas `status: { in: [StatusMembro.ATIVO, StatusMembro.VISITANTE] }`. Se um ex-membro (`INATIVO` / `TRANSFERIDO` + `User` `DISABLED`) enviar uma ficha de retorno em `/join/[slug]`, entra como desconhecido e colide com `409 Conflict` ao tentar recriar usuário com o mesmo e-mail/telefone, ou cria um membro duplicado.
   - Mesmo com vínculo manual (`vincularMembroId`), `SolicitacoesCadastroService.aprovarSolicitacao` sempre retorna `userAccessOutcome: 'DISABLED'` sem oferecer opção explícita de reativação assistida da conta anterior, e `AuthService` ainda não possui helper transacional para reativar um usuário `DISABLED` voltando-o com segurança para `PENDING` (com limpeza de `senhaHash`, novo token 72h e revogação de `UserAuthProvider` antigo se o e-mail mudar).

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Ciclo de Vida do Usuário na Exclusão e Inativação (`MembrosService` + `AuthService`)
- **`AuthService.reactivateDisabledUserInTx` (em `apps/api/src/modules/auth/auth.service.ts`):**
  - Extrair helper interno parametrizado compartilhado entre `regeneratePendingActivationInTx` e o novo `reactivateDisabledUserInTx`, evitando duplicação de validação de conflito de e-mail/telefone (`NOT: { id: user.id }`), geração de token 72h e auditoria.
  - Exigir estritamente `role === Role.BASIC` (`ForbiddenException` para `ADMIN`/`STAFF`) e estado desativado (`status === UserStatus.DISABLED || !ativo`).
  - Ao reativar para `UserStatus.PENDING`: definir `ativo: false`, `senhaHash: null` (exigindo nova definição de senha ou novo login social pelo link), gerar novo `activationTokenHash`/`activationExpiresAt` e registrar em `AuditLog`.
  - Se o `email` for alterado na reativação, revogar vínculos antigos de `UserAuthProvider` (`ativo: false, revokedAt: now`) para impedir bloqueio na reativação futura via Google com o novo e-mail.
- **`AuthService.createPendingBasicUserInTx`:**
  - Quando o e-mail colidir com um usuário `DISABLED` do **mesmo tenant** sem membro vinculado (`memberId === null`), retornar mensagem orientativa clara informando que existe conta desativada desvinculada gerenciável em *Configurações > Usuários*.
- **`MembrosService.update`:**
  - Validar cota do plano (`totalAtivos` com `{ tenantId, deletedAt: null, status: StatusMembro.ATIVO }`) sempre que o status passar de `!== ATIVO` para `=== ATIVO`.
  - Suportar `desativarUsuario?: boolean` (quando o status final for `INATIVO` ou `TRANSFERIDO`) e `reativarUsuario?: boolean` (quando o status final for `ATIVO`), bloqueando alteração sobre contas `ADMIN`/`STAFF` (`ForbiddenException`) e executando tudo em `$transaction` única com `AuditLog`. Retornar opcionalmente `activationLink` quando houver reativação de usuário.
- **`MembrosService.remove` e `bulkRemove`:**
  - Compartilhar helper privado `handleLinkedUsersOnMemberDeletionInTx`:
    - Se `user.role !== Role.BASIC` (`ADMIN`/`STAFF`): desvincular apenas `memberId: null`, mantendo acesso intacto.
    - Se `user.role === Role.BASIC` e `desativarUsuario !== false`:
      - Se `status === PENDING` e sem referências restritas (`auditLog`, `escalaItem`, `financialTransaction`, `financePermissionCreatedBy`/`UpdatedBy`), executar `tx.user.delete` (permitindo limpeza real pós-testes e liberando e-mail/telefone).
      - Caso contrário, preservar o registro para auditoria/FKs atualizando `ativo: false`, `status: UserStatus.DISABLED`, `memberId: null`, `telefoneLogin: null`, `activationTokenHash: null`, `activationExpiresAt: null`, `activationCreatedAt: null` e registrar em `AuditLog`.

### 3.2. Deduplicação Inteligente com Ex-Membros e Reativação Segura na Triagem
- **`member-deduplication.helper.ts` (`pickBestMemberMatch`):**
  - Remover a restrição `[ATIVO, VISITANTE]` na busca mantendo estritamente `deletedAt: null` (nunca vincular registros soft-deleted).
  - Dentro de cada critério (`CPF`, `TELEFONE`, `EMAIL`, `NOME_EXATO`), aplicar desempate determinístico:
    1. Correspondência exata de nome normalizado (`normalizeName(m.nome) === normName`), resolvendo famílias que compartilham WhatsApp quando um ex-membro retorna com seu próprio nome;
    2. Prioridade por status (`ATIVO` → `VISITANTE` → `INATIVO` → `TRANSFERIDO`).
- **`SolicitacoesCadastroService.aprovarSolicitacao`:**
  - Mantém o invariante de segurança: sem `criarOuRegenerarAcesso: true`, conta `DISABLED` **nunca** é reativada silenciosamente (`userAccessOutcome: 'DISABLED'`).
  - Com `criarOuRegenerarAcesso: true` e `canReceiveBasicUser` (`targetStatus === StatusMembro.ATIVO`) e `existingUser.status === UserStatus.DISABLED` e `existingUser.role === Role.BASIC`: invoca `reactivateDisabledUserInTx` sincronizando `nome`, `email` e `whatsapp` (quando selecionados em `camposAtualizar`), retornando `userAccessOutcome: 'REACTIVATED'` e o `activationLink` de 72h.
  - Em `TELEFONE`/`EMAIL`/`NOME_EXATO`, mantém disponível `"Pessoa Diferente / Familiar"` (`permitirCriarNovoMesmoDuplicado: true`) inclusive quando o match for um ex-membro `INATIVO`/`TRANSFERIDO`, mantendo o bloqueio absoluto para `CPF`.

### 3.3. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Reativação acidental de conta `DISABLED` bloqueada por disciplina/segurança | Baixa | Crítico | Backend exige `criarOuRegenerarAcesso: true` explícito; checkbox de reativação nasce **desmarcado** por padrão em ambos os modais. |
| Bloqueio de conta `ADMIN`/`STAFF` ao inativar ou excluir seu registro de `Membro` | Média | Crítico | Proteção estrita RBAC no backend (`role !== BASIC`) e apenas `memberId: null` na exclusão do membro, nunca alterando `ativo`/`status`/`role`. |
| Erro de FK (`Restrict`) ao excluir membro com usuário `BASIC` que já logou | Alta sem checagem | Alto | Verificar contagens nas tabelas restritas (`AuditLog`, `EscalaItem`, `FinancialTransaction`, `FinancePermission`) antes de optar por `delete` vs `DISABLED` + unlink. |
| Ex-membro `INATIVO` com mesmo WhatsApp da esposa ativa não ser reconhecido no retorno | Média | Médio | Helper de desempate por `normalizeName` dentro do critério `TELEFONE`/`EMAIL` antes de ordenar por status. |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Branch, Plano e Baseline
Status: concluido

- [x] Confirmar repositório limpo na branch `development` e atualizar com `git pull`
- [x] Criar a branch `feature/ciclo-inativacao-reativacao-membro` a partir de `development`
- [x] Registrar plano em `ai-context/plans/ciclo-inativacao-reativacao-membro-plan.md` e índice `ai-context/plans/README.md`
- [x] Critério de validação da etapa: Branch criada sobre `development` (`e46465c`) e suíte baseline em `apps/api` aprovada (`11/11` suites, `110/110` testes em `src/modules/membros src/modules/auth`).

### Etapa 1 - Reativação Transacional em Auth e Deduplicação de Ex-Membros (Backend Auth & Helper)
Status: concluido

- [x] Atualizar `apps/api/src/modules/auth/auth.service.ts`:
  - [x] Extrair helper interno parametrizado para sincronizar dados/conflitos/token sem duplicação entre renovação `PENDING` e reativação `DISABLED`
  - [x] Implementar `reactivateDisabledUserInTx` garantindo bloqueio para `ADMIN`/`STAFF`, limpeza de `senhaHash`, novo token 72h (`PENDING`), revogação de `UserAuthProvider` antigo se o e-mail mudar e registro em `AuditLog`
  - [x] Melhorar mensagem em `createPendingBasicUserInTx` quando colidir com conta `DISABLED` sem membro vinculado no mesmo tenant
- [x] Atualizar `apps/api/src/modules/membros/member-deduplication.helper.ts`:
  - [x] Incluir membros `INATIVO` e `TRANSFERIDO` (mantendo `deletedAt: null`) em `loadMemberDuplicityContext` e `checkMemberDuplicity`
  - [x] Implementar helper de seleção/desempate (`pickBestMemberMatch`) priorizando nome normalizado coincidente e depois ordem `ATIVO` → `VISITANTE` → `INATIVO` → `TRANSFERIDO`
- [x] Atualizar e expandir testes em `apps/api/src/modules/auth/auth.service.spec.ts` e `apps/api/src/modules/membros/solicitacoes-cadastro.service.spec.ts`:
  - [x] Cobrir `reactivateDisabledUserInTx` (sucesso com novo e-mail/telefone, revogação de provider social antigo, bloqueio para `ADMIN`/`STAFF` e bloqueio de conflito de e-mail)
  - [x] Cobrir detecção de ex-membro `INATIVO`/`TRANSFERIDO` em `checkMemberDuplicity` mantendo precedência de `ATIVO`/`VISITANTE` e desempate por nome
- [x] Critério de validação da etapa: Testes unitários de `src/modules/auth` e `solicitacoes-cadastro.service.spec.ts` passando sem regressões (`6/6` suites, `68/68` testes).

### Etapa 2 - Inativação/Exclusão Coordenada e Triagem de Retorno (Backend Membros)
Status: concluido

- [x] Atualizar `apps/api/src/modules/membros/dto/update-membro.dto.ts`:
  - [x] Adicionar campos opcionais `@IsOptional() @IsBoolean() desativarUsuario?: boolean` e `reativarUsuario?: boolean`
- [x] Atualizar `apps/api/src/modules/membros/dto/bulk-delete-membros.dto.ts`:
  - [x] Adicionar campo opcional `@IsOptional() @IsBoolean() desativarUsuarios?: boolean`
- [x] Atualizar `apps/api/src/modules/membros/membros.controller.ts`:
  - [x] Repassar `actorUserId`, `ip` e query `desativarUsuario` no endpoint `@Delete(':id')`
  - [x] Repassar `actorUserId` e `ip` em `@Patch(':id')`
  - [x] Repassar `dto.desativarUsuarios` e `ip` em `bulkDeletePost` e `bulkDelete`
- [x] Atualizar `apps/api/src/modules/membros/membros.service.ts`:
  - [x] Validar cota de membros ativos em `update` quando membro passar de status não-ativo para `ATIVO`
  - [x] Implementar inativação/reativação opcional e segura de usuário `BASIC` em `update` dentro de `$transaction`, com bloqueio RBAC para `ADMIN`/`STAFF` e retorno opcional de `activationLink`
  - [x] Implementar helper compartilhado `handleLinkedUsersOnMemberDeletionInTx` usado por `remove` e `bulkRemove` (remoção limpa de `PENDING` sem referências, desativação + unlink + liberação de `telefoneLogin` em contas já usadas e apenas `memberId: null` para `ADMIN`/`STAFF`)
- [x] Atualizar `apps/api/src/modules/membros/solicitacoes-cadastro.service.ts`:
  - [x] Incluir `'REACTIVATED'` no tipo `UserAccessOutcome`
  - [x] Permitir reativação explícita de usuário `BASIC` `DISABLED` em `aprovarSolicitacao` quando `reativarUsuarioDesativado === true` e `targetStatus === ATIVO`, mantendo proteção estrita por padrão quando `false`/omitido
- [x] Atualizar e expandir testes em `apps/api/src/modules/membros/membros.service.spec.ts` e `apps/api/src/modules/membros/solicitacoes-triagem.service.spec.ts`:
  - [x] Testar `update` (`ATIVO` → `INATIVO` com `desativarUsuario`, `INATIVO` → `ATIVO` com validação de cota e `reativarUsuario`, proteção `ADMIN`/`STAFF`)
  - [x] Testar `remove` e `bulkRemove` (usuário `PENDING` sem histórico, usuário `ACTIVE` com histórico, usuário `ADMIN`/`STAFF`, flag `false`)
  - [x] Testar `aprovarSolicitacao` para ex-membro `INATIVO`/`TRANSFERIDO` com `DISABLED` (`reativarUsuarioDesativado: true` → `'REACTIVATED'` e `false` → `'DISABLED'`)
- [x] Critério de validação da etapa: Toda a suíte `npm.cmd test -w apps/api -- src/modules/membros src/modules/auth` (`11/11` suites, `127/127` testes) e `npm.cmd run build -w apps/api` passando.

### Etapa 3 - Modais de Membro, Confirmação de Exclusão e Triagem de Retorno (Frontend)
Status: concluido

- [x] Atualizar `apps/web/src/types/index.ts` para refletir `ativo?: boolean` e retorno opcional de atualização com `activationLink` se necessário
- [x] Atualizar `apps/web/src/hooks/use-membros.ts`:
  - [x] Estender `deleteMembro(id, desativarUsuario?)` e `bulkDeleteMembros(ids, desativarUsuarios?)`
  - [x] Suportar retorno tipado de `updateMembro` preservando atualização limpa de estado em `rawMembros` mesmo quando vier `activationLink`
- [x] Atualizar `apps/web/src/components/app/membro-modal.tsx`:
  - [x] Ao alterar status de membro existente com conta `BASIC` ativa/pendente para `INATIVO` ou `TRANSFERIDO`, exibir checkbox contextual pré-marcado para desativar também o usuário de acesso
  - [x] Ao alterar status de membro com conta `ADMIN`/`STAFF` para `INATIVO` ou `TRANSFERIDO`, exibir alerta informativo de proteção administrativa
  - [x] Ao reativar membro `INATIVO`/`TRANSFERIDO` para `ATIVO` com usuário `BASIC` `DISABLED`, exibir checkbox explícito (desmarcado por padrão) para reativar acesso e gerar link 72h
- [x] Atualizar `apps/web/src/app/(dashboard)/membros/page.tsx`:
  - [x] Enriquecer os `ConfirmDialog` de exclusão individual e em lote com aviso sobre usuários vinculados e checkbox (marcado por padrão) para desativar/desvincular contas `BASIC`
  - [x] Ao salvar edição em `MembroModal` com reativação de acesso que retorne `activationLink`, abrir `WelcomeActivationModal` com orientação clara de envio por WhatsApp
- [x] Atualizar `apps/web/src/components/app/solicitacao-duplicidade-modal.tsx`:
  - [x] Adaptar rótulo e mensagem de promoção para distinguir `VISITANTE` vs ex-membro (`INATIVO`/`TRANSFERIDO`) com pre-check inteligente conforme `item.tipo`
  - [x] Adicionar checkbox explícito (desmarcado por padrão) na seção de usuário `DISABLED` quando o destino for `ATIVO`, permitindo optar por reativar a conta anterior com link 72h usando os dados atualizados
- [x] Atualizar `apps/web/src/components/app/solicitacoes-triagem-tab.tsx`:
  - [x] Exibir banner e rótulo de botão dedicados (`"Ex-membro encontrado (...)"` e `"Revisar e Reativar Cadastro"`) quando `membroExistenteStatus` for `INATIVO` ou `TRANSFERIDO`
  - [x] Tratar `userAccessOutcome === 'REACTIVATED'` no `applyApprovalSuccess` abrindo `WelcomeActivationModal` com título e descrição específicos de reativação
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` (40/40 rotas) passando sem erros ou warnings bloqueantes.

### Etapa 4 - Documentação, Testes Completos e Validação Integrada
Status: concluido

- [x] Atualizar `ai-context/business-rules/validation-rules.md` com as regras de inativação/exclusão coordenada de membro+usuário e reativação segura na triagem
- [x] Atualizar `ai-context/backlog/novo-membro-auto-cadastro.md` registrando o suporte a retorno de ex-membros (`INATIVO`/`TRANSFERIDO`) e reativação de conta `DISABLED`
- [x] Atualizar `ai-context/plans/ciclo-inativacao-reativacao-membro-plan.md` com `Status geral: concluido` e todos os checkboxes marcados
- [x] Executar bateria de testes backend (`npm.cmd test -w apps/api`), type-check e build de produção (`apps/api` e `apps/web`)
- [x] Executar validação visual/funcional E2E com Playwright (desktop e mobile) cobrindo inativação, exclusão e retorno de ex-membro
- [x] Critério de validação da etapa: Todos os builds (`nest build` e `next build` 40/40 rotas), testes automatizados (`37/37` suites, `430/430` testes) e validações Playwright desktop/mobile aprovados sem erros.

---

## 5. Critérios de Aceite Gerais

- [x] Ao alterar um membro para `INATIVO` ou `TRANSFERIDO` no modal de edição, é possível desativar também o usuário `BASIC` vinculado na mesma ação (sem tocar em contas `ADMIN`/`STAFF`).
- [x] Ao excluir um membro (individual ou em lote), usuários `BASIC` `PENDING` sem histórico são removidos liberando e-mail/telefone para novos cadastros/testes, enquanto usuários com histórico são desativados e desvinculados preservando auditoria e FKs.
- [x] Ao retornar um ex-membro (`INATIVO` ou `TRANSFERIDO`) pelo `/join/[slug]`, a triagem identifica o cadastro anterior em vez de duplicá-lo e permite reativar o membro para `ATIVO` (com validação de cota do plano) preservando histórico.
- [x] Uma conta de acesso `DISABLED` nunca é reativada silenciosamente — a reativação exige marcação explícita no modal e gera um novo token de ativação de 72h sem erro de conflito de e-mail/telefone duplicado.
- [x] Todas as telas e modais alterados seguem integralmente os padrões do ODS (`ModalShell`, `ModalFooter`, `ConfirmDialog`, `StatusBadge`, tokens semânticos) em desktop e mobile.
