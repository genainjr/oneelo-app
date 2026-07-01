# Domain Rename Option A - Physical Database Rename With Prisma Compatibility

Status: concluido para preparacao de PR

Objetivo: manter somente a evolucao estrutural do banco de dados para nomenclatura em ingles, preservando o contrato Prisma e o codigo da aplicacao como estavam em `development`, para reduzir risco antes de producao.

Contexto:

- A tentativa de propagar PT-BR -> EN para todo o sistema aumentou o risco e quebrou telas do frontend.
- O projeto ainda nao esta em producao, entao a estrutura fisica do banco pode ser recriada.
- O ponto mais caro de alterar depois da producao e o banco fisico.
- A estrategia escolhida e manter tabelas e colunas fisicas em ingles, mas expor models e campos Prisma compativeis com o codigo atual usando `@map` e `@@map`.

---

## Decisao Arquitetural

Usar Prisma como camada de compatibilidade temporaria e intencional:

- Banco fisico em ingles:
  - tabelas como `tb_member`, `tb_ministry`, `tb_schedule`
  - colunas como `name`, `mobile_phone`, `birth_date`, `created_at`
- Contrato Prisma compativel com o codigo atual:
  - models como `Membro`, `Ministerio`, `Escala`
  - campos como `nome`, `whatsapp`, `dataNascimento`
  - mapeamento via `@map` e `@@map`

Esta decisao prioriza:

1. estabilidade para colocar em producao;
2. banco preparado para evolucao futura;
3. menor volume de mudanca no backend e frontend;
4. reversao das alteracoes funcionais e visuais nao relacionadas.

---

## Escopo Mantido

- [ ] `apps/api/prisma/schema.prisma`
- [ ] `apps/api/prisma/migrations/**`
- [ ] `apps/api/prisma/migrations/migration_lock.toml`
- [ ] `apps/api/prisma/seed.ts`, somente se compativel com o contrato Prisma preservado
- [ ] `ai-context/database/models.md`, se refletir a decisao final
- [ ] este plano em `ai-context/plans/domain-rename-option-a-prisma-map-plan.md`

## Escopo A Reverter

- [ ] `apps/api/src/**`
- [ ] `apps/api/test/**`
- [ ] `apps/web/src/**`
- [ ] `.claude/settings.local.json`
- [ ] `ESTRUTURA_MONOREPO.md`
- [ ] planos antigos de rename completo, se nao forem mais uteis para a PR
- [ ] alteracoes de layout, ODS, hooks, types, components, controllers, services, DTOs, guards e interceptors que nao sejam necessarias para o Prisma compat.

---

## Checklist De Execucao

### Etapa 1 - Preservar Estado Atual

- [x] Criar branch backup do estado atual: `backup/domain-rename-full-attempt`
- [x] Confirmar que nenhum trabalho local do usuario sera descartado sem intencao
- [x] Registrar arquivos alterados antes da limpeza

### Etapa 2 - Limpar Branch Para Escopo De Banco

- [x] Reverter alteracoes de `apps/api/src/**` para `development`
- [x] Reverter alteracoes de `apps/api/test/**` para `development`
- [x] Reverter alteracoes de `apps/web/src/**` para `development`
- [x] Reverter `.claude/settings.local.json`
- [x] Restaurar `ESTRUTURA_MONOREPO.md`
- [x] Manter somente Prisma, migrations, seed e documentacao autorizada

### Etapa 3 - Ajustar `schema.prisma` Para Compatibilidade

- [x] Restaurar nomes Prisma esperados pelo codigo atual
  - [x] `Membro`
  - [x] `Tag`
  - [x] `Ministerio`
  - [x] `MinisterioFuncao`
  - [x] `MinisterioMembro`
  - [x] `MinisterioMembroFuncao`
  - [x] `Escala`
  - [x] `EscalaDia`
  - [x] `EscalaDiaFuncaoOculta`
  - [x] `EscalaItem`
  - [x] `Evento`
  - [x] `AuditLog`
- [x] Aplicar `@@map` para tabelas fisicas em ingles
- [x] Aplicar `@map` para colunas fisicas em ingles
- [x] Garantir que enums Prisma usados pelo codigo atual continuem compativeis
- [x] Garantir que relacoes Prisma mantenham os nomes esperados pelo codigo atual
- [x] Evitar alterar regras de negocio, indexes ou constraints alem do necessario para o novo naming fisico

### Etapa 4 - Revisar Migration Inicial

- [x] Manter uma unica migration inicial, se esse continuar sendo o caminho escolhido
- [x] Garantir tabelas fisicas com padrao `tb_*`
- [x] Garantir colunas em `snake_case`
- [x] Garantir foreign keys explicitas
- [x] Garantir indices e constraints equivalentes ao comportamento anterior
- [x] Validar que migration e `schema.prisma` estao consistentes

### Etapa 5 - Ajustar Seed

- [x] Fazer o seed usar o contrato Prisma preservado
- [x] Remover uso de models/campos Prisma em ingles se o codigo voltou ao contrato antigo
- [x] Manter dados iniciais equivalentes aos existentes
- [x] Rodar seed em banco recriado

### Etapa 6 - Validacao Tecnica

- [x] `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma`
- [x] `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma`
- [x] Reset/migrate controlado do banco local
- [x] `npm.cmd run db:seed`
- [x] `npx.cmd tsc -p apps/api/tsconfig.json --noEmit` avaliado; nao aplicavel como gate desta PR porque inclui testes e2e com erros de tipagem pre-existentes fora do runtime
- [x] `npx.cmd tsc -p apps/web/tsconfig.json --noEmit`
- [x] `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit`
- [x] Build API
- [x] Build Web

### Etapa 7 - Smoke Test Funcional

- [x] Login de admin
- [x] Login de usuario comum, se houver seed para isso; nao aplicavel porque o seed atual cria apenas admin e super admin
- [x] Dashboard abre
- [x] Membros abre
- [x] Ministerios abre
- [x] Escalas abre
- [x] Visualizacao de escalas abre
- [x] Agenda abre
- [x] Configuracoes abre
- [x] Criacao/edicao basica continua funcionando nos modulos principais

### Etapa 8 - Preparar PR

- [x] Conferir `git diff --name-status development`
- [x] Garantir que a PR nao contem layout/UI
- [x] Garantir que a PR nao contem alteracoes backend/frontend fora de compatibilidade Prisma/seed
- [x] Documentar que o banco fisico foi renomeado para ingles
- [x] Documentar que o contrato Prisma foi mantido por compatibilidade operacional
- [x] Informar que uma futura fase pode remover `@map`/`@@map` e propagar nomes em ingles no codigo, quando houver janela segura

---

## Critérios De Aceite

- [x] Sistema volta a rodar como em `development`
- [x] Login funciona
- [x] Telas principais nao quebram
- [x] Banco fisico esta em ingles
- [x] Codigo runtime permanece essencialmente igual ao de `development`
- [x] Prisma Client expoe models/campos compativeis com o codigo atual
- [x] PR fica pequena o bastante para revisao objetiva
- [x] Nao ha mudancas de layout
- [x] Nao ha mudancas de regras de negocio
- [x] Nao ha mudancas de permissao/RBAC

---

## Resultado Da Etapa 8

Revisao contra `development` concluida.

Arquivos com alteracao esperada:

- `ai-context/database/models.md`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `ai-context/plans/domain-rename-option-a-prisma-map-plan.md`

Arquivos/areas conferidos sem diff:

- `apps/web/src/**`
- `apps/api/src/**`
- `apps/api/test/**`
- `.claude/settings.local.json`
- `ESTRUTURA_MONOREPO.md`

Conclusao: a branch esta limitada a estrutura de banco, contrato Prisma compativel e documentacao. Nao ha alteracao de layout, frontend runtime, backend runtime, regras de negocio ou RBAC.

---

## Riscos E Controles

Risco: `schema.prisma` fisico em ingles quebrar o codigo antigo.

Controle: preservar nomes Prisma antigos e mapear o banco via `@map`/`@@map`.

Risco: seed ficar escrito contra o novo contrato em ingles.

Controle: ajustar seed para usar o contrato Prisma preservado.

Risco: migration inicial perder constraints antigas.

Controle: comparar constraints, indices e unique keys contra o schema anterior antes de validar.

Risco: entrar alteracao de UI na PR.

Controle: revisar `git diff --name-status development` e reverter `apps/web/src/**` para `development`.

---

## Resultado Esperado

Uma PR de baixo risco contendo apenas:

- estrutura fisica do banco em ingles;
- Prisma mapeando contrato antigo para banco novo;
- migration inicial limpa;
- seed compativel;
- documentacao minima da decisao.

O sistema deve se comportar como antes para o usuario e para o codigo runtime.
