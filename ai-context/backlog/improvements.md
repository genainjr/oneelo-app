# Backlog - Melhorias Gerais

---

### IMP-001 Adicionar campos email, phone e language ao Tenant

- **Status**: implementado
- **Prioridade**: alta
- **Categoria**: infraestrutura / homologacao
- **Contexto**: O Tenant possui campos de contato (`email`, `telefone`) e idioma padrao (`idioma`) adicionados ao schema Prisma, nos DTOs de criacao/edicao e no Super Admin.
- **Acao**: Concluido no schema e modulo Super Admin.
- **Impacto**: Informacoes de contato e configuracao de idioma disponiveis no Super Admin e na API.
- **Arquivos afetados**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/super-admin/`

---

### IMP-002 Landing Page publica no middleware

- **Status**: implementado
- **Prioridade**: alta
- **Categoria**: infraestrutura / homologacao
- **Contexto**: A landing page precisa ser publica em `/`. Validado em `apps/web/src/middleware.ts` com `/` incluso em `PUBLIC_PATHS`.
- **Acao**: Concluido e ativo em producao/desenvolvimento.
- **Impacto**: Visitantes acessam a landing sem autenticacao.
- **Arquivos afetados**:
  - `apps/web/src/middleware.ts`
  - `apps/web/src/app/page.tsx`

---

### IMP-003 Fluxo Git - branches devem partir de `development`

- **Status**: documentado
- **Prioridade**: media
- **Categoria**: DX
- **Contexto**: O fluxo padrao de trabalho deve partir sempre de `development` atualizado.
- **Acao**: Manter o workflow documentado em `ai-context/workflows/feature-development.md` e configurar protecao de branch no GitHub quando aplicavel.
- **Impacto**: Historico mais limpo e menor risco de features partirem de base incorreta.

---

### IMP-004 AuditLog registra IP do proxy em vez do IP real do cliente

- **Status**: implementado em `fix/member-audit-cookie-backlog`
- **Prioridade**: alta
- **Categoria**: seguranca
- **Contexto**: Duplicado funcional de `SEC-001`. Mantido aqui apenas como referencia historica.
- **Acao**: Resolvido por helper compartilhado que prioriza `x-forwarded-for`, depois `x-real-ip`, depois `req.ip`.
- **Impacto**: Logs de auditoria voltam a registrar o IP real quando headers de proxy estao presentes.
- **Arquivos afetados**:
  - `apps/api/src/common/utils/request-ip.ts`
  - `apps/api/src/modules/auth/auth.controller.ts`
  - `apps/api/src/common/interceptors/audit.interceptor.ts`

---

### IMP-005 Membro excluido continua vinculado e visivel em ministerios

- **Status**: implementado em `fix/member-audit-cookie-backlog`
- **Prioridade**: alta
- **Categoria**: consistencia de dados / UX
- **Contexto**: Ao excluir ou arquivar um membro que participa de um ministerio, o membro continuava aparecendo no gerenciamento de ministerios.
- **Acao**: Ao fazer soft delete do membro, remover vinculos em `MinisterioMembroFuncao` e `MinisterioMembro`. Nas consultas de ministerios, filtrar membros com `deletedAt = null` e `status = ATIVO`.
- **Impacto**: Evita inconsistencia visual e operacional no gerenciamento de ministerios.
- **Arquivos afetados**:
  - `apps/api/src/modules/membros/membros.service.ts`
  - `apps/api/src/modules/ministerios/ministerios.service.ts`

---

### IMP-006 Nome de exibicao do membro para escalas e impressoes

- **Status**: implementado
- **Prioridade**: media
- **Categoria**: UX / consistencia de dados
- **Contexto**: Adicionado campo opcional `nomeExibicao` no cadastro de membro (`Membro.nomeExibicao`) para exibicao em escalas, impressoes, Meu Perfil e buscas operacionais (`nomeExibicao || primeiroNome || nome`).
- **Acao**: Concluido no Prisma, API, modal de membros, Meu Perfil e componentes de impressao/escala.
- **Impacto**: Elimina ambiguidades em escalas e melhora legibilidade de impressoes.
- **Arquivos afetados**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/membros/`
  - `apps/web/src/components/app/membro-modal.tsx`
  - `apps/web/src/components/app/escala-shared.tsx`
  - `apps/web/src/components/app/membro-search-combobox.tsx`
  - `apps/web/src/app/(dashboard)/meu-perfil/page.tsx`

---

### IMP-007 Autoaplicar filtros na visualizacao de membros

- **Status**: pendente
- **Prioridade**: media
- **Categoria**: UX
- **Contexto**: A tela `/membros/visualizacao` ainda depende do botao `FILTRAR`, o que gera friccao na busca e abre margem para a primeira carga do dashboard chegar sem `aniversarioMes` aplicado antes da resposta inicial da API.
- **Acao**: Tornar os filtros de `nome`, `status`, `ministerio`, `aniversarioMes`, `ordenacao` e `semTelefone` reativos ao `onChange`, com debounce curto apenas para `nome`. Inicializar a tela a partir dos parametros da URL antes da primeira busca para evitar corrida entre carregamento inicial e aplicacao do filtro do dashboard. Remover o submit manual da tela ou mantê-lo apenas como fallback temporario.
- **Impacto**: Resultados mais estaveis e imediatos, menos cliques para o usuario, e eliminacao do bug intermitente em que aniversariantes podiam abrir sem o mes corretamente aplicado.
- **Arquivos afetados previstos**:
  - `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx`
  - `apps/web/src/hooks/use-membros-visualizacao.ts`
  - `apps/web/src/components/app/filter-shell.tsx`
  - `apps/web/src/hooks/use-filter-state.ts`
  - `apps/web/src/app/(dashboard)/dashboard/page.tsx`

---

### IMP-008 Limite de membros deve respeitar o plano contratado do tenant

- **Status**: pendente
- **Prioridade**: alta
- **Categoria**: billing / tenant management / consistencia de regras
- **Contexto**: O bloqueio de criacao de membros hoje usa apenas `tenant.limiteMembros`. Isso faz com que tenants em `PROFISSIONAL` ainda possam ser bloqueados se o limite numerico nao for ajustado manualmente, mesmo quando o plano contratado deveria permitir membros ilimitados.
- **Acao**: Definir uma regra oficial para derivar o limite a partir do plano do tenant. Recomendacao inicial: `GRATUITO = 50`, `BASICO = 200`, `PROFISSIONAL = ilimitado`. Ajustar o backend para validar a criacao de membros com base nessa regra, mantendo o campo `limiteMembros` apenas como override manual ou migração de transicao, se necessario.
- **Impacto**: Evita bloqueios indevidos em tenants profissionais, reduz operacao manual no Super Admin e prepara o sistema para precificacao coerente com os planos exibidos.
- **Arquivos afetados previstos**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/membros/membros.service.ts`
  - `apps/api/src/modules/super-admin/super-admin.service.ts`
  - `apps/api/src/modules/super-admin/dto/create-tenant.dto.ts`
  - `apps/api/src/modules/super-admin/dto/update-tenant.dto.ts`
  - `apps/web/src/app/(dashboard)/admin/`

---

### IMP-009 Visualizacoes read-only para ministerios e agenda

- **Status**: implementado
- **Prioridade**: media
- **Categoria**: UX / ODS / navegacao
- **Contexto**: Criadas telas de visualizacao read-only dedicadas em `/agenda/visualizacao` e `/ministerios/visualizacao` seguindo o padrao ODS de `/membros/visualizacao` e `/escalas/visualizacao`.
- **Acao**: Concluido no frontend com PageHeader, FilterShell, EntityCard, EmptyState, StatCard e cards expansivos.
- **Impacto**: Consulta clara e separada do fluxo CRUD, alinhada ao padrao OneElo Design System.
- **Arquivos afetados**:
  - `apps/web/src/app/(dashboard)/agenda/visualizacao/page.tsx`
  - `apps/web/src/app/(dashboard)/ministerios/visualizacao/page.tsx`
