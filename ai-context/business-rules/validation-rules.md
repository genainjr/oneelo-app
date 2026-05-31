# Regras de Negócio e Validações do SaaS

Este documento detalha as regras de negócio operacionais, controle de permissões (RBAC) e restrições de validação de dados aplicadas no **SaaS de Gestão para Igrejas**.

---

## 1. Matriz de Permissões (RBAC)

As permissões do sistema são verificadas na camada de entrada do backend via `RolesGuard` e filtradas na camada de serviço (`MembrosService`, `EscalasService`, etc.) para verificar propriedade dos registros:

| Recurso / Ação | Admin Geral | Pastor | Líder de Ministério | Secretário | Membro |
|:---|:---:|:---:|:---:|:---:|:---:|
| **CRUD Membros** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Visualizar Membros** | ✅ | ✅ | ⚠️ Apenas do seu ministério | ✅ | ❌ |
| **CRUD Ministérios** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CRUD Escalas** | ✅ | ✅ | ⚠️ Apenas do seu ministério | ❌ | ❌ |
| **Visualizar Escalas** | ✅ | ✅ | ⚠️ Apenas do seu ministério | ✅ | ⚠️ Apenas as suas |
| **Confirmar Presença** | ✅ | ✅ | ✅ | ✅ | ⚠️ Apenas as suas |
| **CRUD Eventos** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Audit Logs** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Gestão de Usuários** | ✅ | ❌ | ❌ | ❌ | ❌ |

### Regra Específica: Líder de Ministério
O perfil `LIDER_MINISTERIO` tem acesso limitado de escrita e leitura de escalas e membros.
- A validação é aplicada no backend interceptando a requisição e checando se o ID do ministério da escala está contido na lista de ministérios liderados pelo usuário (`User.ministeriosLiderados`).
- Caso tente atualizar uma escala de outro ministério, a API retorna `403 Forbidden`.

---

## 2. Limitação de Membros Ativos por Plano

Para fins de monetização e controle de uso do SaaS, a inserção de membros é limitada pelo plano do Tenant:

- **Regra**:
  `totalAtivos < limiteMembros`
- **Fluxo de Validação**:
  1. O backend busca o `limiteMembros` do Tenant logado.
  2. Executa a contagem (`count`) de membros cujo status no tenant seja ativo (com o filtro implícito `deletedAt: null`).
  3. Se a quantidade atual de membros for igual ou superior ao limite do plano, a rota retorna `403 Forbidden` com a mensagem descritiva:
     *"Limite de membros (X) atingido para o plano Y. Faça um upgrade."*
- **Exceção**: Apenas o cadastro de novos membros é bloqueado; atualizações em membros existentes não passam por essa checagem de quota.

---

## 3. Regra de Soft Delete e Inatividade de Membros

A exclusão física de registros de membros é proibida para preservar históricos de relatórios.

- **Exclusão Lógica**: O campo `deletedAt` recebe a data e hora atual.
- **Leitura**: O cliente Prisma estendido injeta automaticamente a cláusula `deletedAt: null` em todas as buscas de membros.
- **Validação de Atualização**: Ao tentar atualizar ou visualizar um membro que possua `deletedAt != null`, a API retorna `404 Not Found` (como se o registro não existisse), impedindo modificações em dados legados ou excluídos.

---

## 4. Validação Estrutural e Sanitização (DTOs)

Todas as requisições de escrita que chegam à API são validadas na camada de DTOs via `ValidationPipe` global:

### Entidade: Membro
- **nome**: Obrigatório, string sem espaços vazios extras (`TRIM` aplicado automaticamente).
- **email**: Opcional. Se fornecido, deve obedecer ao formato de e-mail padrão.
- **whatsapp**: Opcional, deve conter apenas números e caracteres válidos de telefone (máximo 15 dígitos).
- **status**: Obrigatório, deve corresponder a um valor válido do enum (`ATIVO`, `INATIVO`, `VISITANTE`, `TRANSFERIDO`).

### Entidade: User
- **email**: Obrigatório, formato de e-mail válido, único por tenant.
- **senhaHash**: A senha de entrada enviada pelo cliente deve possuir no mínimo 6 caracteres e é criptografada com `bcryptjs` no service antes de ser persistida.
- **role**: Obrigatório, correspondendo aos valores válidos de `Role`.

### Entidade: Escala
- **data**: Obrigatória, tipo DateTime válido, deve ser preferencialmente no futuro em relação à data de criação (ou no mesmo dia).
- **ministerioId**: Deve apontar para um ministério ativo e existente do mesmo tenant.

### Entidade: EscalaItem
- **funcao**: Obrigatória, string não nula (ex: "Bateria", "Recepção").
- **membroId**: O membro designado deve estar ativo e pertencer ao mesmo tenant da escala.
- **Unicidade**: A combinação de `[escalaId, membroId]` é única no banco de dados. Caso tente cadastrar o mesmo membro mais de uma vez em uma mesma escala, a aplicação retorna erro de conflito `409 Conflict` ou `400 Bad Request`.
