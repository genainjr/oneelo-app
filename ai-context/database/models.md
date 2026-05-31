# Modelagem do Banco de Dados — Dicionário de Entidades

O banco de dados PostgreSQL utiliza o Prisma ORM para mapeamento das tabelas. Todas as entidades operacionais estão vinculadas a um `Tenant` para isolamento lógico dos dados.

---

## Enums Globais

| Enum | Valores Possíveis | Descrição |
|:---|:---|:---|
| **Plano** | `GRATUITO`, `BASICO`, `PROFISSIONAL` | Nível do plano de contratação do Tenant. |
| **StatusAssinatura** | `ATIVA`, `TRIAL`, `SUSPENSA`, `CANCELADA` | Estado financeiro/operacional do plano da igreja. |
| **Role** | `ADMIN_GERAL`, `PASTOR`, `LIDER_MINISTERIO`, `SECRETARIO`, `MEMBRO` | Perfil de permissão do usuário (RBAC). |
| **StatusMembro** | `ATIVO`, `INATIVO`, `VISITANTE`, `TRANSFERIDO` | Estado cadastral do membro da igreja. |
| **StatusEscala** | `RASCUNHO`, `PUBLICADA`, `ENCERRADA` | Estado do ciclo de vida de uma escala de serviço. |
| **StatusConfirmacao** | `PENDENTE`, `CONFIRMADO`, `RECUSADO` | Resposta do membro escalado sobre sua participação. |
| **StatusEvento** | `AGENDADO`, `REALIZADO`, `CANCELADO` | Estado operacional de um evento de calendário. |
| **AcaoAuditoria** | `CRIAR`, `ATUALIZAR`, `DELETAR`, `LOGIN`, `LOGOUT` | Ação registrada no histórico de auditoria. |

---

## Tabela de Entidades

### 1. Tenant
Representa uma igreja cadastrada no sistema. Funciona como raiz do isolamento multi-tenant.
- `id` (String/UUID, PK): Identificador único.
- `nome` (String): Nome da igreja.
- `slug` (String, Unique): Identificador URL amigável da igreja (ex: `igreja-central`).
- `plano` (Plano, Default: `GRATUITO`): Nível do plano.
- `statusAssinatura` (StatusAssinatura, Default: `TRIAL`): Situação da assinatura.
- `limiteMembros` (Int, Default: `50`): Quantidade máxima de membros ativos permitidos.
- `ativo` (Boolean, Default: `true`): Status da conta.
- `createdAt` / `updatedAt` (DateTime): Timestamps padrões.

### 2. User
Usuários com credenciais de login e perfil de acesso.
- `id` (String/UUID, PK): Identificador único.
- `tenantId` (String/UUID, FK -> Tenant): Vínculo com a igreja.
- `nome` (String): Nome completo.
- `email` (String): Endereço de email.
- `senhaHash` (String): Hash bcrypt da senha.
- `role` (Role, Default: `MEMBRO`): Nível de privilégio.
- `ativo` (Boolean, Default: `true`): Status de ativação do login.
- *Unique*: `[tenantId, email]` (o email deve ser único apenas dentro de cada igreja).

### 3. Membro
Lista de membros cadastrados da igreja. Utilizada para compor escalas e grupos.
- `id` (String/UUID, PK): Identificador único.
- `tenantId` (String/UUID, FK -> Tenant): Vínculo com a igreja.
- `nome` (String): Nome do membro.
- `whatsapp` (String, Opcional): Telefone de contato.
- `email` (String, Opcional): Email do membro.
- `dataNascimento` (DateTime, Opcional): Data de aniversário.
- `status` (StatusMembro, Default: `ATIVO`): Estado cadastral do membro.
- `observacoes` (String, Opcional): Anotações internas do secretário/pastor.
- `deletedAt` (DateTime, Opcional): Timestamp de exclusão lógica (Soft Delete).

### 4. Tag
Etiquetas customizadas criadas pela igreja para segmentação de membros.
- `id` (String/UUID, PK): Identificador único.
- `tenantId` (String/UUID, FK -> Tenant): Vínculo com a igreja.
- `nome` (String): Nome da etiqueta (ex: "Jovens", "Músicos").
- `corHex` (String, Default: `#6366f1`): Cor em formato hexadecimal para representação visual na UI.
- *Unique*: `[tenantId, nome]` (uma etiqueta com o mesmo nome não pode ser duplicada no mesmo tenant).

### 5. MembroTag
Tabela associativa que mapeia a relação N:N entre Membros e Tags.
- `membroId` (String/UUID, FK -> Membro)
- `tagId` (String/UUID, FK -> Tag)
- *Composite PK*: `[membroId, tagId]`

### 6. Ministerio
Grupos ou áreas de atuação na igreja (ex: Louvor, Mídia, Infantil).
- `id` (String/UUID, PK): Identificador único.
- `tenantId` (String/UUID, FK -> Tenant): Vínculo com a igreja.
- `nome` (String): Nome do ministério.
- `descricao` (String, Opcional): Detalhes sobre o grupo.
- `ativo` (Boolean, Default: `true`): Situação do grupo.

### 7. MinisterioLider
Tabela associativa que mapeia a liderança (Users) de cada Ministério (N:N).
- `ministerioId` (String/UUID, FK -> Ministerio)
- `userId` (String/UUID, FK -> User)
- *Composite PK*: `[ministerioId, userId]`

### 8. MinisterioMembro
Tabela associativa que lista os integrantes (Membros) de cada Ministério (N:N).
- `ministerioId` (String/UUID, FK -> Ministerio)
- `membroId` (String/UUID, FK -> Membro)
- *Composite PK*: `[ministerioId, membroId]`

### 9. Escala
Escalas de serviço geradas por ministério.
- `id` (String/UUID, PK): Identificador único.
- `tenantId` (String/UUID, FK -> Tenant): Vínculo com a igreja.
- `ministerioId` (String/UUID, FK -> Ministerio): Ministério responsável pela escala.
- `titulo` (String): Título identificador (ex: "Culto de Celebração - Domingo Manhã").
- `data` (DateTime): Data e hora em que a escala ocorre.
- `status` (StatusEscala, Default: `RASCUNHO`): Estado atual.
- `observacoes` (String, Opcional): Instruções para a equipe escalada.

### 10. EscalaItem
Linhas individuais de designação de uma escala. Associa um membro a uma função específica.
- `id` (String/UUID, PK): Identificador único.
- `escalaId` (String/UUID, FK -> Escala): Escala à qual pertence.
- `membroId` (String/UUID, FK -> Membro): Membro escalado.
- `userId` (String/UUID, FK -> User, Opcional): Usuário responsável pela escalação deste item.
- `funcao` (String): Papel desempenhado (ex: "Guitarra", "Câmera 1", "Professor").
- `statusConfirmacao` (StatusConfirmacao, Default: `PENDENTE`): Confirmação do membro.
- `observacoes` (String, Opcional): Detalhes específicos da função para este membro.
- *Unique*: `[escalaId, membroId]` (o mesmo membro não pode ser escalado em duas funções diferentes na mesma escala).

### 11. Evento
Eventos do calendário litúrgico e de agenda da igreja.
- `id` (String/UUID, PK): Identificador único.
- `tenantId` (String/UUID, FK -> Tenant): Vínculo com a igreja.
- `titulo` (String): Nome do evento (ex: "Conferência de Mulheres").
- `descricao` (String, Opcional): Descrição e detalhes.
- `dataInicio` (DateTime): Início do evento.
- `dataFim` (DateTime, Opcional): Fim do evento.
- `local` (String, Opcional): Local físico ou link do evento.
- `status` (StatusEvento, Default: `AGENDADO`): Estado atual.

### 12. AuditLog
Registros históricos de mutações no sistema para auditoria e segurança.
- `id` (String/UUID, PK): Identificador único.
- `tenantId` (String/UUID, FK -> Tenant): Vínculo com a igreja onde ocorreu o evento.
- `userId` (String/UUID, FK -> User, Opcional): Autor da alteração.
- `entidade` (String): Nome da entidade modificada (ex: `membros`, `escalas`).
- `entidadeId` (String): Identificador único do registro modificado.
- `acao` (AcaoAuditoria): Tipo de alteração (CRIAR, ATUALIZAR, etc).
- `payloadBefore` (Json, Opcional): Estado do registro antes da modificação (nulo em criações).
- `payloadAfter` (Json, Opcional): Estado final do registro modificado (nulo em exclusões físicas).
- `ipAddress` (String, Opcional): Endereço IP do cliente.
- `createdAt` (DateTime): Data e hora da auditoria.
