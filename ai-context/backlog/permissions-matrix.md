# Matriz de Permissões — Oneelo

Este documento define as permissões de cada role por recurso do sistema. Serve como referência para implementação dos Guards no NestJS e visibilidade condicional no frontend.

---

## Conceitos

- **User.role** (ADMIN, STAFF, BASIC): define o nível de acesso ao sistema
- **MinisterioMembro.role** (LEADER, ASSISTANT_LEADER, MEMBER): define a função dentro de um ministério específico
- Um usuário BASIC ganha poderes extras quando é LEADER ou ASSISTANT_LEADER em um ministério

---

## Matriz de Acesso

| Recurso | ADMIN | STAFF | BASIC (LEADER) | BASIC (ASSISTANT) | BASIC (MEMBER) |
|---------|-------|-------|-----------------|-------------------|----------------|
| Membros — Listar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Membros — Criar/Editar/Deletar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ministérios — CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ministério — Definir líder | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ministério — Adicionar membros | ✅ | ✅ | ✅ (seu) | ❌ | ❌ |
| Ministério — Remover membros | ✅ | ✅ | ✅ (exceto LEADERs) | ❌ | ❌ |
| Escalas — Criar/Editar (qualquer) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Escalas — Criar/Editar (seu ministério) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Escalas — Visualizar (seu ministério) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Escalas — Confirmar presença | — | — | ✅ | ✅ | ✅ |
| Usuários — CRUD | ✅ | ❌ | ❌ | ❌ | ❌ |
| Auditoria — Visualizar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dashboard — Visualizar | ✅ | ✅ | ✅ (seu ministério) | ✅ (seu ministério) | ❌ |

---

## Restrições Específicas

### Liderança
- LEADER **não pode** remover outro LEADER do mesmo ministério
- LEADER **não pode** se auto-atribuir role LEADER (promoção exclusiva de ADMIN/STAFF)
- LEADER pode liderar múltiplos ministérios com autonomia independente em cada

### Escalas
- LEADER e ASSISTANT_LEADER gerenciam escalas **apenas** do(s) seu(s) ministério(s)
- STAFF gerencia escalas de **qualquer** ministério (autonomia total)
- A confirmação de presença é do membro escalado, independente do role

### Gestão de Membros do Ministério
- LEADER pode adicionar/remover participantes (role MEMBER e ASSISTANT_LEADER)
- LEADER **não pode** remover outro LEADER
- ASSISTANT_LEADER não tem permissão de gestão de membros

---

## Como o Sistema Resolve Permissões

### Para rotas globais (Membros, Usuários, Auditoria)
Guard verifica `User.role` diretamente:
```
@Roles(Role.ADMIN, Role.STAFF)
```

### Para rotas de ministério (Escalas, Membros do Ministério)
Guard verifica User.role OU MinisterioMembro.role:
```
1. Se User.role === ADMIN ou STAFF → permitido
2. Senão, busca MinisterioMembro onde memberId = User.memberId AND ministerioId = rota
3. Se MinisterioMembro.role === LEADER ou ASSISTANT_LEADER → permitido
4. Senão → negado
```

---

## Referências

- [[decisions]] ADR #7 (Proxy Reverso) e ADR #8 (Separação Member x User)
- [[security]] SEC-001 e SEC-002
