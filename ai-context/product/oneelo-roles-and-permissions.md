# Papéis e Permissões (RBAC)

A arquitetura de autorização do OneElo é dividida entre regras **Globais** (`User.role`) e regras **Contextuais/Ministeriais** (`MinisterioMembro.role`). O backend atua como a fonte absoluta da verdade.

## Papéis Principais

### Super Admin (`SUPER_ADMIN`)
Permissões globais da provedora do software (Lookup Labs).
* Acesso restrito ao painel da infraestrutura.
* Pode criar, bloquear e faturar tenants (igrejas).
* Não tem acesso de leitura aos dados operacionais transacionais das igrejas sem um escopo intencional.

### Admin (`ADMIN`)
Permissões completas da instância (tenant).
* É o gestor geral da igreja. Pode ver e modificar tudo.
* Pode criar usuários, gerir configurações de tenant e visualizar todos os módulos livremente.

### Colaborador (`STAFF`)
Equipe de backoffice e operação geral da igreja (Secretaria, Tesouraria, etc).
* Possui forte poder de manipulação de entidades (criar membros, ministérios, eventos, escalas).
* Costuma ter restrições leves em configurações globais ou exclusão permanente (dependendo do módulo).

### Liderança Ministerial (`BASIC` + `LEADER`/`ASSISTANT_LEADER`)
Permissão híbrida e limitada. Trata-se de um usuário base, porém com escopo elevado em seu departamento.
* Pode gerenciar apenas os ministérios onde atua como líder ou co-líder.
* Pode adicionar/remover participantes do seu ministério, definir funções e gerir escalas da sua equipe.
* Não pode visualizar informações globais que não lhe competem ou interferir em lideranças alheias.

### Membro (`BASIC`)
Permissões estritamente básicas.
* Pode visualizar a Agenda, seu próprio Perfil e a aba "Minhas Escalas".
* Não tem permissão de criação, edição ou exclusão no sistema.

---

## Matriz de Permissões Resumida

| Módulo / Ação | SUPER_ADMIN | ADMIN | STAFF | Colaborador (Líder Ministerial) | Membro (Basic) |
|---|---|---|---|---|---|
| **Gestão de Tenants** | Todos | Nenhum | Nenhum | Nenhum | Nenhum |
| **Acessar Dashboard** | Não | Sim | Sim | Sim (Limitado) | Sim (Básico) |
| **Membros (Ver Todos)** | Não | Sim | Sim | Não | Não |
| **Membros (Criar/Editar)**| Não | Sim | Sim | Não | Não |
| **Ministérios (Criar)** | Não | Sim | Sim | Não | Não |
| **Ministério X (Gerir)** | Não | Sim | Sim | Sim (Apenas se Líder de X) | Não |
| **Escalas X (Gerir)** | Não | Sim | Sim | Sim (Apenas se Líder de X) | Não |
| **Agenda (Ver/Criar)** | Não | Sim / Sim | Sim / Sim | Sim / Não | Sim / Não |

---

## Permissões específicas do Financeiro

O módulo financeiro usa uma camada própria por tenant, separada de `User.role`.

Papéis financeiros iniciais:

- `FINANCE_VIEWER`: acessa a área financeira em leitura.
- `FINANCE_OPERATOR`: reservado para lançamentos financeiros quando o fluxo existir.
- `FINANCE_APPROVER`: reservado para aprovações financeiras quando o fluxo existir.
- `FINANCE_MANAGER`: gerencia permissões financeiras e configurações do módulo.

Regras:

- `ADMIN` global não recebe acesso financeiro automaticamente.
- Novo tenant nasce com o usuário administrador inicial como `FINANCE_MANAGER`.
- Tenant existente sem `FINANCE_MANAGER` permite bootstrap inicial por `ADMIN`.
- Depois do primeiro `FINANCE_MANAGER`, a gestão das permissões financeiras passa a ser exclusiva do próprio `FINANCE_MANAGER`.
- A UI pode ocultar menu e ações, mas a autorização real deve permanecer no backend.

---

## Melhorias Futuras Identificadas
* **Granularidade Horizontal:** Criar suporte a permissões isoladas por módulos extras (ex: um papel "Tesoureiro" que vê finanças mas não escalas).
* **Controle de Visibilidade de Exportação:** Refinar se líderes podem exportar a base inteira dos seus ministérios ou se requerem aprovação.
* **Perfis Customizáveis:** Permitir que o tenant (Admin) crie papéis sob-medida agrupando blocos lógicos de permissão.
