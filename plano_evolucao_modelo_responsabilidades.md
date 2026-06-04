# Plano de Evolução do Modelo de Responsabilidades - Oneelo

## Objetivo

Separar completamente:

* Pessoa da igreja (Member/Membro)
* Acesso ao sistema (User/Usuário)
* Papel dentro dos ministérios (MinisterioMembro.role)
* Permissões dentro do sistema (User.role)

Evitar que regras de negócio da igreja dependam da existência de um usuário de login.

---

# Modelo de Domínio

## Entidades

### Membro (Member)

Representa uma pessoa da igreja. Pode existir sem ter login no sistema.

Campos principais:

* id
* tenantId
* nome
* whatsapp
* email
* dataNascimento
* status (ATIVO, INATIVO, VISITANTE, TRANSFERIDO)
* deletedAt (soft delete)

### User (Usuário)

Representa acesso ao sistema. Pode existir sem ser membro (ex: dev, funcionário contratado).

Campos principais:

* id
* tenantId
* memberId (nullable — vínculo opcional com Membro)
* nome
* email
* senhaHash
* role (ADMIN, STAFF, BASIC)
* ativo

Relacionamento:

* User → Membro (opcional, via memberId)
* Um Membro pode existir sem User
* Um User pode existir sem Membro

---

## Roles de Sistema (User.role)

| Role | Quem é | Acesso |
|------|--------|--------|
| ADMIN | Dev, suporte, administrador geral | Acesso irrestrito a todo o tenant |
| STAFF | Pastor, secretário, funcionário operacional | Gestão de membros, ministérios, escalas de qualquer ministério |
| BASIC | Membro comum, líder, co-líder | Acesso restrito; poderes extras via MinisterioMembro.role |

---

## Roles de Ministério (MinisterioMembro.role)

| Role | Responsabilidade |
|------|------------------|
| LEADER | Líder do ministério — gerencia membros e escalas do seu ministério |
| ASSISTANT_LEADER | Co-líder — mesmos poderes sobre escalas, sem gestão de membros |
| MEMBER | Participante — visualiza escalas e confirma presença |

---

## Estrutura de Dados

### MinisterioMembro (substitui MinisterioLider + MinisterioMembro atuais)

Campos:

* id
* ministerioId
* membroId
* role (LEADER, ASSISTANT_LEADER, MEMBER)

Tabela unificada que define tanto participação quanto liderança.

---

# Regras de Negócio de Permissões

## Restrições de Liderança

* LEADER não pode remover outro LEADER do mesmo ministério
* LEADER não pode se auto-atribuir role LEADER (promoção vem apenas de ADMIN/STAFF)
* LEADER pode ser líder de múltiplos ministérios (autonomia independente em cada)
* Apenas ADMIN e STAFF podem definir/alterar quem é LEADER

## Autonomia sobre Escalas

* ADMIN e STAFF: podem criar/editar escalas de qualquer ministério
* LEADER e ASSISTANT_LEADER: podem criar/editar escalas apenas do seu ministério
* BASIC (MEMBER): apenas visualiza e confirma presença

## Gestão de Membros do Ministério

* ADMIN e STAFF: adicionam/removem membros de qualquer ministério
* LEADER: adiciona/remove membros do seu ministério (exceto outros LEADERs)
* ASSISTANT_LEADER e MEMBER: sem permissão de gestão

---

# Fases de Desenvolvimento

## Fase 1 — Schema Prisma

Alterações:

1. Substituir enum `Role` por: ADMIN, STAFF, BASIC
2. Criar enum `MinistryRole`: LEADER, ASSISTANT_LEADER, MEMBER
3. Adicionar campo `role MinistryRole` em MinisterioMembro
4. Adicionar campo `memberId String?` em User (relação opcional com Membro)
5. Remover tabela MinisterioLider (unificada em MinisterioMembro)

## Fase 2 — Migration e Dados

1. Criar migration Prisma
2. Migrar dados existentes:
   - MinisterioLider → MinisterioMembro com role = LEADER
   - Role.ADMIN_GERAL → ADMIN
   - Role.PASTOR → STAFF
   - Role.LIDER_MINISTERIO → BASIC (liderança definida em MinisterioMembro)
   - Role.SECRETARIO → STAFF
   - Role.MEMBRO → BASIC

## Fase 3 — Permissões (Guards e Decorators)

1. Atualizar RolesGuard para novos enums
2. Criar MinistryGuard (valida se User tem LEADER/ASSISTANT_LEADER no ministério da rota)
3. O guard consulta MinisterioMembro filtrando por memberId do User logado + role

## Fase 4 — Services e DTOs

1. Ajustar MinisterioService (usar MinisterioMembro.role em vez de MinisterioLider)
2. Ajustar EscalaService (validar permissão via MinistryGuard)
3. Atualizar DTOs e Swagger

## Fase 5 — Telas (Frontend)

1. Remover select de usuários para líder
2. Adicionar gestão de participantes do ministério com role
3. Aplicar visibilidade condicional baseada nas permissões já definidas

## Fase 6 — Testes e2e

1. Testar fluxo completo por role
2. Validar restrições de liderança
3. Validar autonomia de escalas por ministério

---

# Resultado Final

| Conceito | Entidade |
|----------|----------|
| Pessoa da igreja | Membro |
| Acesso ao sistema | User |
| Função no ministério | MinisterioMembro.role |
| Permissão no sistema | User.role |

Essa separação elimina ambiguidades e permite crescimento do produto sem necessidade de nova remodelagem estrutural.
