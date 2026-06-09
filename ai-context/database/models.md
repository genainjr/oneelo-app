# Modelagem do Banco de Dados - Dicionario de Entidades

O banco de dados PostgreSQL usa Prisma ORM. As entidades operacionais do tenant usam `tenantId` para isolamento logico. A entidade `SUPER_ADMIN` e tratada como acesso de plataforma e pode existir sem `tenantId`, conforme o modulo de administracao global.

---

## Enums Globais

| Enum | Valores | Descricao |
|---|---|---|
| `Plano` | `GRATUITO`, `BASICO`, `PROFISSIONAL` | Nivel do plano de contratacao do tenant. |
| `StatusAssinatura` | `ATIVA`, `TRIAL`, `SUSPENSA`, `CANCELADA` | Estado financeiro/operacional do tenant. |
| `Role` | `ADMIN`, `STAFF`, `BASIC`, `SUPER_ADMIN` | Perfil global de acesso do usuario. |
| `MinistryRole` | `LEADER`, `ASSISTANT_LEADER`, `MEMBER` | Papel contextual de um membro dentro de um ministerio. |
| `StatusMembro` | `ATIVO`, `INATIVO`, `VISITANTE`, `TRANSFERIDO` | Estado cadastral do membro. |
| `StatusEscala` | `RASCUNHO`, `PUBLICADA`, `ENCERRADA` | Estado do ciclo de vida de uma escala. |
| `StatusConfirmacao` | `PENDENTE`, `CONFIRMADO`, `RECUSADO` | Resposta do membro escalado. |
| `StatusEvento` | `AGENDADO`, `REALIZADO`, `CANCELADO` | Estado operacional de evento de agenda. |
| `AcaoAuditoria` | `CRIAR`, `ATUALIZAR`, `DELETAR`, `LOGIN`, `LOGOUT` | Acao registrada em auditoria. |

Decisao: os enums de `Role` nao devem ser renomeados. Labels amigaveis pertencem a UI/i18n.

---

## Entidades

### 1. Tenant

Representa uma igreja cadastrada no sistema.

- `id`: identificador unico.
- `nome`: nome da igreja.
- `slug`: identificador URL amigavel, unico.
- `plano`: plano contratado.
- `statusAssinatura`: situacao da assinatura.
- `limiteMembros`: quantidade maxima de membros ativos.
- `ativo`: status da conta.
- `createdAt` / `updatedAt`: timestamps padrao.

### 2. User

Representa credencial de login e permissao global de acesso. Nao substitui `Membro`.

- `id`: identificador unico.
- `tenantId`: vinculo com tenant. Pode ser nulo para `SUPER_ADMIN`.
- `memberId`: vinculo opcional com `Membro`.
- `nome`: nome exibido no sistema.
- `email`: email de login.
- `senhaHash`: hash bcrypt da senha.
- `role`: `ADMIN`, `STAFF`, `BASIC` ou `SUPER_ADMIN`.
- `ativo`: status do login.
- Unicidade operacional: email unico dentro do tenant.

### 3. Membro

Representa uma pessoa da igreja. Pode existir sem login.

- `id`: identificador unico.
- `tenantId`: vinculo com a igreja.
- `nome`: nome do membro.
- `whatsapp`: telefone opcional.
- `email`: email opcional.
- `dataNascimento`: data de nascimento opcional.
- `status`: estado cadastral.
- `observacoes`: anotacoes internas.
- `deletedAt`: exclusao logica.

### 4. Tag

Etiqueta customizada para segmentacao de membros.

- `id`
- `tenantId`
- `nome`
- `corHex`
- Unico por tenant: `[tenantId, nome]`.

### 5. MembroTag

Relacao N:N entre membros e tags.

- `membroId`
- `tagId`
- Chave composta: `[membroId, tagId]`.

### 6. Ministerio

Representa uma area de atuacao da igreja.

- `id`
- `tenantId`
- `nome`
- `descricao`
- `ativo`

### 7. MinisterioMembro

Relacao entre membros e ministerios. Tambem resolve lideranca ministerial.

- `ministerioId`
- `membroId`
- `role`: `LEADER`, `ASSISTANT_LEADER` ou `MEMBER`.
- Chave composta: `[ministerioId, membroId]`.

Regras:

- Nao existe mais entidade separada `MinisterioLider` como fonte de verdade.
- Lideranca e resolvida por `MinisterioMembro.role`.
- Um `User` com `role = BASIC` ganha poderes contextuais se seu `memberId` tiver `LEADER` ou `ASSISTANT_LEADER` no ministerio.

### 8. MinisterioFuncao

Lista de funcoes disponiveis em um ministerio.

- `id`
- `ministerioId`
- `nome`
- `ordem`
- Unico por ministerio: `[ministerioId, nome]`.

### 9. MinisterioMembroFuncao

Define quais funcoes um membro pode exercer dentro de um ministerio.

- `ministerioId`
- `membroId`
- `funcaoId`

### 10. Escala

Escala de servico vinculada a um ministerio.

- `id`
- `tenantId`
- `ministerioId`
- `titulo`
- `descricao`
- `data`
- `status`
- `observacoes`

### 11. EscalaItem

Linha individual de uma escala.

- `id`
- `escalaId`
- `membroId`
- `funcao`
- `statusConfirmacao`
- `observacoes`

### 12. Evento

Evento da agenda.

- `id`
- `tenantId`
- `titulo`
- `descricao`
- `dataInicio`
- `dataFim`
- `local`
- `status`

Decisao pendente: definir se `Evento` tera `ministerioId` opcional para agenda ministerial.

### 13. AuditLog

Registro historico de mutacoes e eventos sensiveis.

- `id`
- `tenantId`
- `userId`
- `entidade`
- `entidadeId`
- `acao`
- `payloadBefore`
- `payloadAfter`
- `ipAddress`
- `createdAt`

---

## Referencias

- `ai-context/backlog/permissions-matrix.md`
- `ai-context/business-rules/validation-rules.md`
- `ai-context/plans/rbac-navigation-experience-plan.md`
