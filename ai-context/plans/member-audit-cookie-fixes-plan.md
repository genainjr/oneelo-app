# Plano - Membro excluido, IP real e cookie seguro

> Status: concluido
> Ultima atualizacao: 2026-06-09

---

## Resumo

Este plano cobre os tres primeiros itens priorizados apos revisao do backlog:

1. `IMP-005`: membro excluido continua vinculado e visivel em ministerios.
2. `SEC-001` / `IMP-004`: auditoria registra IP do proxy em vez do IP real do cliente.
3. `SEC-002`: cookie em producao usa `sameSite: 'none'` desnecessariamente.

---

## Decisoes

- Excluir membro continua sendo soft delete em `Membro.deletedAt`.
- Ao excluir membro, vinculos ministeriais ativos devem ser removidos para nao aparecerem na gestao de ministerios.
- Historico de escalas antigas nao sera removido nesta correcao.
- IP real deve priorizar `x-forwarded-for`, depois `x-real-ip`, depois `req.ip`.
- Cookie de autenticacao em producao deve usar `sameSite: 'lax'` e `secure: true`.

---

## Etapas

- [x] 1. Registrar `IMP-005` no backlog de melhorias
- [x] 2. Criar helper compartilhado para resolver IP real do request
- [x] 3. Aplicar IP real em login/logout e mutacoes de usuarios
- [x] 4. Aplicar IP real no `AuditInterceptor`
- [x] 5. Aplicar IP real no fluxo Super Admin
- [x] 6. Alterar cookies de auth para `sameSite: 'lax'` em producao
- [x] 7. Limpar vinculos ministeriais ao excluir membro
- [x] 8. Filtrar membros ministeriais ativos em consultas de ministerios
- [x] 8.1. Filtrar vinculos ministeriais ativos no perfil do usuario
- [x] 8.2. Ordenar membros de ministerio e selecao de escala por nome
- [x] 8.3. Impedir selecao do mesmo membro em mais de uma funcao no mesmo dia da escala
- [x] 8.4. Exibir Meu Perfil tambem para ADMIN e STAFF na sidebar
- [x] 8.5. Permitir alteracao da propria senha no Meu Perfil
- [x] 8.6. Evitar refresh completo ao adicionar/remover membro na grade de escala
- [x] 8.7. Reutilizar componente de pesquisa de membro ao adicionar membro em ministerio
- [x] 8.8. Corrigir duplicacao da quantidade de membros no card de ministerio
- [x] 8.9. Exibir liderancas do ministerio em chips sem truncar nomes
- [x] 8.10. Padronizar liderancas em lista vertical com lider antes de co-lider
- [x] 8.11. Reposicionar quantidade de membros junto ao status do ministerio
- [x] 9. Rodar build da API
- [x] 10. Rodar build do Web
- [x] 11. Atualizar backlog/planos relacionados

---

## Arquivos previstos

| Arquivo | Acao |
|---|---|
| `ai-context/backlog/improvements.md` | Registrar `IMP-005` |
| `ai-context/backlog/security.md` | Marcar contexto atualizado de `SEC-001` e `SEC-002` |
| `apps/api/src/common/utils/request-ip.ts` | Novo helper de IP real |
| `apps/api/src/modules/auth/auth.controller.ts` | Usar helper e cookie `sameSite: 'lax'` |
| `apps/api/src/modules/auth/auth.service.ts` | Filtrar ministerios ativos no perfil do usuario |
| `apps/api/src/modules/auth/dto/change-password.dto.ts` | Validar troca de senha pelo usuario autenticado |
| `apps/api/src/modules/super-admin/super-admin.controller.ts` | Usar helper e cookie `sameSite: 'lax'` |
| `apps/api/src/common/interceptors/audit.interceptor.ts` | Usar helper de IP real |
| `apps/api/src/modules/membros/membros.service.ts` | Remover vinculos ministeriais no soft delete |
| `apps/api/src/modules/ministerios/ministerios.service.ts` | Filtrar membros ativos/nao excluidos |
| `apps/api/src/modules/escalas/escalas.service.ts` | Retornar item criado com membro/funcao para atualizacao local |
| `apps/web/src/hooks/use-escalas.ts` | Evitar refetch da lista ao adicionar/remover item da escala |
| `apps/web/src/app/(dashboard)/escalas/page.tsx` | Atualizar grade localmente ao adicionar/remover membro |
| `apps/web/src/app/(dashboard)/meu-perfil/page.tsx` | Formulario de alteracao da propria senha |
| `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Pesquisa no fluxo de adicionar membro ao ministerio |
| `apps/web/src/components/app/membro-search-combobox.tsx` | Componente compartilhado de busca/selecao de membro |
| `apps/web/src/components/app/sidebar.tsx` | Exibir Meu Perfil para ADMIN/STAFF |
| `ai-context/frontend/navigation-rules.md` | Atualizar matriz de navegacao do perfil |

---

## Criterios de aceite

- Membro removido deixa de aparecer no gerenciamento de ministerios.
- Vizinhos ministeriais (`MinisterioMembroFuncao` e `MinisterioMembro`) sao limpos sem apagar historico de escalas.
- Login, logout, auditoria automatica e Super Admin usam IP real quando headers de proxy estao presentes.
- Cookies de login comum e Super Admin usam `sameSite: 'lax'` tanto em dev quanto em producao, com `secure: true` em producao.
- ADMIN, STAFF e BASIC veem o atalho Meu Perfil na sidebar.
- Usuario autenticado consegue alterar a propria senha no Meu Perfil informando a senha atual.
- Adicionar/remover membro na grade de escala nao dispara refresh completo do detalhe/lista.
- Campo de adicionar membro ao ministerio permite pesquisar por nome antes de selecionar.
- Quantidade de membros no card de ministerio aparece uma unica vez.
- Card de ministerio mostra mais de uma lideranca sem cortar nomes.
- Liderancas no card aparecem sempre uma abaixo da outra, com lider antes de co-lider.
- Quantidade de membros no card aparece junto ao status, deixando a area inferior apenas para lideranca.
- `npm.cmd run build` passa em `apps/api`.
- `npm.cmd run build` passa em `apps/web`.
