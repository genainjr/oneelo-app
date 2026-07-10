# Backlog - Login com Google

### FT-008 Login com Google vinculado ao usuario interno
- **Prioridade**: alta
- **Fase**: 2
- **Categoria**: seguranca / autenticacao / UX
- **Contexto**: O sistema hoje autentica apenas com e-mail e senha, gerando JWT em cookie HTTP-only. A necessidade e permitir que o usuario criado por um administrador vincule a propria conta Google e use esse provedor para entrar sem perder o vinculo com o usuario interno do tenant.
- **Acao**: Implementar fluxo OAuth2 com Google no backend NestJS. Criar uma tabela de vinculo, como `member_integrations` ou equivalente, para armazenar `provider`, `providerUserId`, tokens e data de vinculo por usuario/membro. Adicionar callback de autenticacao que encontre o usuario interno existente, emita o mesmo JWT atual e respeite tenant/RBAC. No frontend, adicionar acao de vincular e desvincular Google no perfil ou nas configuracoes do usuario.
- **Impacto**: Reduz friccao no login, elimina dependencia de senha local para usuarios finais e prepara a base para outras integracoes OAuth no sistema.
- **Depende de**: Modelo de integracoes por membro/usuario, credenciais OAuth do Google, revisao do fluxo de login e recuperacao de conta.
- **Arquivos afetados previstos**:
  - `apps/api/src/modules/auth/`
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/integrations/` ou equivalente
  - `apps/web/src/app/(dashboard)/meu-perfil/`
  - `apps/web/src/app/(dashboard)/configuracoes/`
