# Plano - Correcoes de UX, perfil, escalas, agenda e logs

Status geral: etapas 1, 2, 3, 4, 5, 6 e 7 concluidas
Ultima atualizacao: 2026-07-15

Branch de trabalho: `plan/ui-profile-schedule-agenda-fixes`

## Objetivo

Corrigir os pontos identificados em `Configurações`, PWA/atalho, `Meu Perfil`, `Escalas`, `Minhas Escalas`, `Personal Panel` e `Agenda`, mantendo entregas pequenas, validaveis e com risco controlado.

Este plano esta ordenado por dificuldade tecnica e quantidade de pontos afetados:

1. ajustes visuais isolados;
2. correcoes de data sem backend;
3. correcoes de data com backend;
4. regras de negocio de escala;
5. paginacao/contagem de logs;
6. edicao de dados pessoais.

## Mapa de pontos, dificuldade e impacto

| Ponto | Area afetada | Dificuldade | Etapa |
|---|---|---:|---:|
| Remover foto duplicada no Meu Perfil | Web, `Meu Perfil` | Baixa | 1 |
| Logo do atalho com muita borda branca | Assets PWA, manifest/metadados | Baixa | 1 |
| Escala do dia aparece em Historico | Web, `Minhas Escalas` | Baixa-media | 2 |
| Indicador de Proxima Escala ignora escala do dia | Web, `Personal Panel` | Baixa-media | 2 |
| Agenda iniciar por semana em vez de mes | Web, `/agenda` e `/agenda/visualizacao` | Media | 3 |
| Filtro final da agenda exclui ultimo dia | API eventos e consumidores do filtro | Media | 3 |
| Voltar status da escala quando PUBLICADA/ENCERRADA | API escalas e UI de gerenciamento | Media | 4 |
| Aba de logs so mostra quantidade ao clicar e limita 200 | API audit logs e UI Configuracoes | Media-alta | 5 |
| Usuario alterar Nome Completo, Nome de Impressao e Telefone | API auth/membros, `Meu Perfil`, auth context | Alta | 6 |

## Decisoes iniciais

- Nao criar migrations para esta entrega, salvo se a implementacao revelar necessidade real.
- Para datas exibidas/comparadas no frontend, usar comparacao por data civil (`yyyy-MM-dd`) para evitar deslocamento por timezone.
- Para filtro final de agenda, a regra correta e incluir o dia inteiro selecionado pelo usuario.
- Para voltar status de escala, a regra deve ser explicita no backend; o frontend apenas reflete as transicoes permitidas.
- Para logs, preferir contrato paginado em vez de buscar tudo no frontend.
- Para edicao de perfil, limitar inicialmente a:
  - Nome Completo: `User.nome` e, se houver membro vinculado, `Membro.nome`;
  - Nome de Impressao: `Membro.nomeExibicao`;
  - Telefone: `Membro.whatsapp`.

## Etapas

### Etapa 0 - Diagnostico e preparacao

Status: concluida

- [x] Atualizar `development` local com `origin/development`.
- [x] Criar branch de trabalho a partir de `development`.
- [x] Identificar arquivos e causas provaveis de cada ponto.
- [x] Criar este plano com etapas ordenadas por dificuldade e impacto.

Arquivos/areas analisados:

- `apps/web/src/app/(dashboard)/configuracoes/page.tsx`;
- `apps/api/src/modules/auth/auth.service.ts`;
- `apps/web/src/app/(dashboard)/meu-perfil/page.tsx`;
- `apps/api/src/modules/auth/auth.controller.ts`;
- `apps/api/src/modules/auth/auth.service.ts`;
- `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx`;
- `apps/web/src/app/(dashboard)/personal-panel/page.tsx`;
- `apps/api/src/modules/escalas/escalas.service.ts`;
- `apps/web/src/app/(dashboard)/escalas/page.tsx`;
- `apps/web/src/app/(dashboard)/agenda/page.tsx`;
- `apps/web/src/app/(dashboard)/agenda/visualizacao/page.tsx`;
- `apps/api/src/modules/eventos/eventos.service.ts`;
- `apps/web/src/app/manifest.ts`;
- `apps/web/src/app/layout.tsx`;
- `apps/web/public/icon-192.png`;
- `apps/web/public/icon-512.png`;
- `apps/web/public/apple-touch-icon.png`;
- `apps/web/public/maskable-icon-512.png`.

### Etapa 1 - Ajustes visuais isolados

Status: concluida e validada manualmente

Dificuldade: baixa

Pontos cobertos:

- Remover foto duplicada no `Meu Perfil`.
- Reduzir borda branca da logo do atalho/PWA.

Tarefas:

- [x] Remover o avatar/foto pequeno do header do `Meu Perfil`, mantendo o `ImageUploadPanel` como fonte visual unica para foto.
- [x] Manter nome/e-mail do usuario no header do perfil sem duplicar imagem.
- [x] Regenerar assets:
  - [x] `apps/web/public/icon-192.png`;
  - [x] `apps/web/public/icon-512.png`;
  - [x] `apps/web/public/apple-touch-icon.png`;
  - [x] `apps/web/public/maskable-icon-512.png`.
- [x] Conferir se `manifest.ts` e `layout.tsx` continuam apontando para os assets corretos.

Validacao:

- [x] Abrir `Meu Perfil` e confirmar que a foto aparece uma unica vez.
- [x] Instalar/atualizar atalho em desktop/mobile e validar visualmente o icone.
- [x] `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`.
- [x] `npm.cmd run build -w apps/web`.

### Etapa 2 - Datas de escala do dia no membro

Status: concluida e validada manualmente

Dificuldade: baixa-media

Pontos cobertos:

- A escala do dia esta sendo mostrada em `Historico`.
- Indicador de `Proxima Escala` nao mostra a escala do dia.

Tarefas:

- [x] Criar ou reutilizar helper de data civil para comparar `yyyy-MM-dd`, sem horario.
- [x] Aplicar helper em `Minhas Escalas` para separar:
  - [x] pendentes;
  - [x] proximas;
  - [x] historico.
- [x] Aplicar helper no `Personal Panel` para `Proxima Escala`.
- [x] Verificar se `Proximos Eventos` no `Personal Panel` tambem deve usar o mesmo helper por consistencia.

Decisao: `Proximos Eventos` foi mantido com comparacao por horario nesta etapa, porque eventos usam `dataInicio` com hora; os filtros de agenda foram tratados na etapa 3.

Validacao:

- [x] Simular/usar escala com data de hoje e confirmar que aparece em `Proximas`, nao em `Historico`.
- [x] Confirmar que `Proxima Escala` mostra a escala de hoje antes da proxima data futura.
- [x] `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`.
- [x] `npm.cmd run build -w apps/web`.

### Etapa 3 - Filtros de agenda por semana e data final inclusiva

Status: concluida e validada manualmente

Dificuldade: media

Pontos cobertos:

- Filtro inicial de agenda esta fixo por mes.
- Data final da agenda nao inclui corretamente o ultimo dia.

Tarefas:

- [x] Trocar filtro inicial de `/agenda` para semana atual.
- [x] Trocar filtro inicial de `/agenda/visualizacao` para semana atual.
- [x] Definir semana como segunda a domingo.
- [x] Corrigir `eventos.service.ts` para tratar `dataFim` como dia inteiro:
  - [x] solucao adotada: `dataInicio < proximoDia(dataFim)`;
  - alternativa `dataInicio <= fimDoDia(dataFim)` nao aplicada por nao ser necessaria.
- [x] Verificar se `use-dashboard.ts` se beneficia da mesma correcao sem mudar seu escopo mensal atual.

Decisao: `use-dashboard.ts` manteve o escopo mensal. Como ele usa `/api/eventos?dataInicio=...&dataFim=...`, passa a receber o ultimo dia corretamente pela correcao centralizada no backend.

Validacao:

- [x] Criar/usar evento no ultimo dia do filtro e confirmar que aparece sem precisar somar um dia.
- [x] Confirmar que `/agenda` abre com a semana atual de segunda a domingo.
- [x] Confirmar que `/agenda/visualizacao` abre com a semana atual de segunda a domingo.
- [x] `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`.
- [x] `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`.
- [x] `npm.cmd run build -w apps/api`.
- [x] `npm.cmd run build -w apps/web`.

### Etapa 4 - Retorno de status da escala

Status: concluida e validada manualmente

Dificuldade: media

Ponto coberto:

- Permitir voltar `STATUS` da escala quando estiver como `ENCERRADA` ou `PUBLICADA`.

Tarefas:

- [x] Atualizar regra backend de transicao em `EscalasService.update`.
- [x] Permitir transicoes minimas:
  - [x] `PUBLICADA -> RASCUNHO`;
  - [x] `ENCERRADA -> PUBLICADA`.
- [x] Avaliar se `ENCERRADA -> RASCUNHO` deve ser direto ou se deve passar por `PUBLICADA`.
- [x] Ajustar botoes da tela de gerenciamento de escalas para exibir acoes de retorno.
- [x] Confirmar que alteracoes de membros/dias continuam bloqueadas quando `ENCERRADA`.
- [x] Evitar notificacao duplicada ao republicar uma escala voltada para rascunho, salvo decisao explicita de notificar novamente.

Decisoes:

- `ENCERRADA -> RASCUNHO` nao foi liberado direto. O retorno deve passar por `ENCERRADA -> PUBLICADA -> RASCUNHO`, mantendo o fluxo de transicoes explicito.
- A grade de escala encerrada fica sem acoes de edicao; a acao disponivel e `Reabrir escala`.
- A notificacao de escala publicada fica restrita a primeira publicacao tecnica detectada por `createdAt`/`updatedAt`, sem criar campo novo no banco.

Validacao:

- [x] `RASCUNHO -> PUBLICADA` continua funcionando.
- [x] `PUBLICADA -> RASCUNHO` funciona.
- [x] `PUBLICADA -> ENCERRADA` continua funcionando.
- [x] `ENCERRADA -> PUBLICADA` funciona.
- [x] Validar comportamento de notificacao ao republicar.
- [x] `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`.
- [x] `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`.
- [x] `npm.cmd run build -w apps/api`.
- [x] `npm.cmd run build -w apps/web`.

### Etapa 5 - Logs de auditoria em Configuracoes

Status: concluida - aguardando revalidacao do scroll da paginacao

Dificuldade: media-alta

Ponto coberto:

- A aba de logs so aparece com quantidade ao clicar e so mostra ate 200.

Tarefas:

- [x] Alterar endpoint `GET /api/auth/audit-logs` para aceitar paginacao:
  - [x] `page`;
  - [x] `limit`;
  - [x] retorno com `items` e `total`.
- [x] Preservar compatibilidade ou migrar o frontend no mesmo commit.
- [x] Carregar total de logs sem exigir que a aba seja aberta, ou carregar metadado leve ao abrir a pagina de Configuracoes.
- [x] Atualizar `configuracoes/page.tsx` para paginação server-side da aba de auditoria.
- [x] Manter paginacao client-side de usuarios separada, sem misturar com logs.
- [x] Adicionar filtros de logs por operador, operacao e recurso.
- [x] Traduzir recursos tecnicos da auditoria, incluindo `user_auth_provider`.
- [x] Identificar operador `SUPER_ADMIN` como operador de plataforma na visualizacao.
- [x] Registrar ativacao/desativacao de notificacoes push na auditoria sem expor endpoint ou chaves da subscription.
- [x] Corrigir scroll para o topo ao trocar pagina no `DataTable` com paginacao server-side.

Validacao:

- [x] A aba de logs mostra quantidade antes do clique ou logo no carregamento inicial definido.
- [x] Logs acima de 200 ficam acessiveis por paginacao.
- [x] Troca de pagina busca registros corretos.
- [x] Filtro por recurso `Vinculo de login social` lista eventos de `user_auth_provider`.
- [x] Filtro por recurso `Notificacoes` lista ativacoes/desativacoes de push.
- [x] Filtro por operador lista usuarios do tenant e a opcao de plataforma/Super Admin.
- [x] Logs gerados por `SUPER_ADMIN` aparecem como acao de plataforma, sem sugerir operador comum do tenant.
- [x] Troca de pagina rola a visualizacao para o topo.
- [x] CRUD de membros rola para o topo dos filtros/listagem ao paginar.
- [x] Visualizacao de membros rola para o topo dos filtros/listagem ao paginar.
- [x] `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`.
- [x] `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`.

### Etapa 6 - Edicao de dados pessoais no Meu Perfil

Status: concluida e validada manualmente

Dificuldade: alta

Ponto coberto:

- Usuario pode alterar seus proprios dados em `Meu Perfil`: Nome Completo, Nome de Impressao e Telefone.

Tarefas:

- [x] Criar DTO para atualizacao do perfil proprio.
- [x] Criar endpoint autenticado, por exemplo `PATCH /api/auth/me/profile`.
- [x] Atualizar `AuthService` para alterar:
  - [x] `User.nome`;
  - [x] `Membro.nome`, quando houver membro vinculado;
  - [x] `Membro.nomeExibicao`;
  - [x] `Membro.whatsapp`.
- [x] Definir comportamento quando usuario nao tem membro vinculado:
  - [x] permitir apenas `User.nome`;
  - [x] bloquear campos de membro com mensagem clara.
- [x] Ajustar backend para ignorar campos de membro vazios/nulos quando usuario sem membro vinculado altera apenas `User.nome`.
- [x] Registrar auditoria da alteracao.
- [x] Criar formulario no `Meu Perfil` seguindo ODS:
  - [x] estado de loading;
  - [x] feedback de sucesso/erro;
  - [x] atualizacao do contexto de usuario/layout apos salvar.
- [x] Garantir que email, role, tenant, ministerios e status nao sejam editaveis por esse fluxo.

Validacao:

- [x] Usuario altera Nome Completo e o sidebar/header reflete o novo nome.
- [x] Usuario altera Nome de Impressao e esse valor aparece onde ja existe regra de exibicao.
- [x] Usuario altera Telefone e o valor persiste.
- [x] Usuario sem membro vinculado nao quebra a tela.
- [x] `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`.
- [x] `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`.
- [x] `npm.cmd run build -w apps/api`.
- [x] `npm.cmd run build -w apps/web`.

### Etapa 7 - Validacao final e handoff

Status: concluida

Dificuldade: baixa

Tarefas:

- [x] Rodar validacao final completa.
- [x] Atualizar este plano com resultados.
- [x] Revisar `git diff --check`.
- [x] Confirmar que `.agents/` permanece fora do commit.
- [x] Preparar resumo para commit/PR.

Resultados da validacao final:

- [x] `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma` passou com `DATABASE_URL` dummy.
- [x] `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma` passou apos parar processos `node` locais. Bloqueio anterior:
  - erro: `EPERM: operation not permitted, rename ... node_modules\\.prisma\\client\\query_engine-windows.dll.node.tmp...`;
  - processos `node` ativos relacionados a API/local dev encontrados: `npm run start:dev`, `nest start --watch` e `apps/api/dist/main`.
- [x] `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`.
- [x] `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`.
- [x] `npm.cmd run build -w apps/api`.
- [x] `npm.cmd run build -w apps/web`.
- [x] `git diff --check` sem erros, apenas warnings de CRLF ja existentes no Windows.

Comandos previstos:

```txt
npx.cmd prisma validate --schema apps/api/prisma/schema.prisma
npx.cmd prisma generate --schema apps/api/prisma/schema.prisma
npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false
npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false
npm.cmd run build -w apps/api
npm.cmd run build -w apps/web
git diff --check
```

## Ordem recomendada de execucao

1. Etapa 1 - visual isolado: menor risco e valida rapidamente duas reclamações visuais.
2. Etapa 2 - datas de escalas do membro: corrige dois sintomas com o mesmo helper.
3. Etapa 3 - agenda: corrige o padrao semanal e o bug de data final no mesmo fluxo.
4. Etapa 4 - status de escala: altera regra de negocio, mas em escopo contido.
5. Etapa 5 - logs: exige contrato paginado e ajuste de dados na UI.
6. Etapa 6 - perfil editavel: maior superficie, toca API, tela, contexto e auditoria.
7. Etapa 7 - validacao final.

## Riscos e pontos de atencao

- Comparacao de datas deve evitar regressao de timezone nas telas de Escalas e Agenda.
- Retorno de status de escala pode interagir com notificacoes; republicacao nao deve disparar mensagem duplicada sem decisao explicita.
- Logs paginados mudam contrato de API; fazer backend e frontend juntos.
- Edicao de perfil nao deve permitir troca de email, role, tenant ou status.
- Assets PWA podem ficar cacheados em dispositivos; validacao manual pode exigir remover/recriar atalho.
