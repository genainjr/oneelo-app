# Plano - Fortalecimento PWA e Push Notifications

Status geral: etapa 5 em andamento - escala publicada validada e lembrete 24h interno implementado tecnicamente
Ultima atualizacao: 2026-07-13

## Objetivo

Evoluir o One Elo de um atalho instalavel para uma experiencia PWA mais proxima de aplicativo, com base tecnica para notificacoes push por usuario e dispositivo.

A feature deve permitir, em fases:

- registrar Service Worker do app;
- oferecer fallback offline seguro;
- guiar instalacao do app no celular quando o PWA ainda nao estiver instalado;
- permitir que usuarios ativem/desativem notificacoes no proprio dispositivo;
- salvar subscriptions push vinculadas a tenant e usuario;
- preparar recebimento e abertura de notificacoes;
- em etapa posterior, disparar notificacoes a partir de eventos de negocio como escala publicada e pendencias de confirmacao.

## Decisoes Fechadas

### 1. PWA antes de app wrapper

Seguir primeiro com fortalecimento do PWA.

Motivo:

- menor custo operacional;
- melhor aproveitamento do app web existente;
- reduz a necessidade imediata de Play Store/App Store;
- cria base reutilizavel caso um wrapper nativo seja adotado depois.

### 2. Nao cachear telas autenticadas

O Service Worker nao deve cachear `/dashboard`, paineis ou telas com dados do usuario.

Motivo:

- evitar exposicao de dados autenticados em cache;
- evitar tela desatualizada em contexto multiusuario/dispositivo;
- manter o fallback offline apenas como pagina informativa.

### 3. Push subscriptions por usuario/dispositivo

Subscriptions devem ser salvas no backend com:

- `tenantId`;
- `userId`;
- `endpoint`;
- chaves `p256dh` e `auth`;
- `userAgent`;
- status ativo/inativo.

Motivo:

- um usuario pode ter varios dispositivos;
- um dispositivo pode trocar endpoint;
- subscriptions precisam ser desativadas sem apagar historico operacional basico.

### 4. Envio automatico fora da etapa 1

A etapa inicial prepara o cadastro/remoção de subscriptions e o recebimento no Service Worker.

O envio automatico por eventos de negocio fica para a proxima etapa.

Motivo:

- separar infraestrutura de push da regra de negocio;
- permitir validar permissao, subscription e instalacao PWA antes de criar jobs/disparadores;
- reduzir risco de notificacoes incorretas em producao.

### 5. Instalacao guiada do PWA

O sistema deve orientar o usuario a instalar o One Elo no celular quando fizer sentido.

Regras:

- Android/Chrome: usar o evento `beforeinstallprompt` para exibir botao "Instalar app" e abrir o prompt nativo.
- iOS/Safari: exibir instrucao curta para usar compartilhar e "Adicionar a Tela de Inicio".
- App ja instalado/standalone: nao exibir chamada de instalacao.
- Desktop: nao priorizar a chamada, exceto se o navegador oferecer instalacao PWA de forma nativa.

Motivo:

- o navegador nao permite instalar automaticamente sem acao do usuario;
- uma experiencia guiada reduz friccao e deixa o sistema mais parecido com app;
- evita banners invasivos ou pouco profissionais.

### 6. Sem notificacao para escala alterada no escopo inicial

Nao enviar notificacoes genericas quando uma escala ja publicada for alterada.

Motivo:

- alteracoes podem acontecer em lote e gerar excesso de notificacoes;
- nem toda alteracao e relevante para todos os membros;
- o primeiro uso deve ser simples, previsivel e com baixo risco de ruido.

O primeiro evento real de push deve ser a publicacao de escala para os membros escalados.

## Estado Atual do Codigo

Ja existe:

- manifest PWA com icones do One Elo;
- atalho mobile abrindo na entrada autenticada;
- layout autenticado compartilhado com header;
- backend NestJS com JWT em cookie HTTP-only;
- Prisma/PostgreSQL multi-tenant;
- `User`, `Tenant` e regras de autenticacao ja estabelecidas.

Implementado nesta etapa:

- Service Worker publico;
- pagina offline estatica;
- utilitario frontend de push;
- botao de ativacao/desativacao no header autenticado;
- endpoints backend para chave publica VAPID e subscriptions;
- modelo Prisma `PushSubscription`;
- migration SQL da tabela de subscriptions;
- variaveis de ambiente exemplo para VAPID.
- script para gerar chaves VAPID;
- experiencia guiada de instalacao PWA;
- envio tecnico de notificacao de teste via Web Push;
- tratamento de endpoints expirados no envio.

Ainda falta:

- validar recebimento real de push em HTTPS/nuvem;
- definir regras de negocio por tipo de notificacao.

## Escopo

Incluido na etapa 1:

- criar `PushSubscription` no Prisma;
- criar migration `20260712120000_add_push_subscriptions`;
- criar modulo `NotificationsModule`;
- expor `GET /api/notifications/public-key`;
- expor `POST /api/notifications/subscriptions`;
- expor `DELETE /api/notifications/subscriptions`;
- criar Service Worker em `apps/web/public/sw.js`;
- criar fallback offline em `apps/web/public/offline.html`;
- criar helper frontend de Push API;
- criar botao de notificacoes no header;
- atualizar manifest com `id` e `scope`;
- documentar instalacao guiada como etapa planejada;
- atualizar `.env.example`;
- registrar validacoes.

Fora do escopo da etapa 1:

- implementacao da experiencia guiada de instalacao;
- envio automatico de push;
- biblioteca de envio Web Push no backend;
- jobs de lembrete;
- notificacoes por WhatsApp/e-mail;
- preferencias granulares por tipo de notificacao;
- publicacao em lojas;
- wrapper com Capacitor/TWA.

## Modelo de Dados Implementado

```prisma
model PushSubscription {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  userId    String   @map("user_id")
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?  @map("user_agent")
  ativo     Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([userId])
  @@index([tenantId, userId, ativo])
  @@map("tb_push_subscription")
}
```

## Regras de Negocio

### Subscription

- usuario autenticado pode registrar uma subscription do proprio dispositivo;
- subscription fica vinculada ao tenant do JWT;
- subscription fica vinculada ao usuario do JWT;
- `endpoint` e unico;
- novo registro com endpoint existente reativa e atualiza a subscription;
- usuario autenticado pode desativar apenas subscription vinculada ao seu usuario/tenant.

### Permissao de notificacao

- permissao do navegador deve ser solicitada apenas por acao explicita do usuario;
- se o navegador negar a permissao, a UI deve indicar que notificacoes estao bloqueadas;
- se o servidor nao tiver chave publica VAPID, a UI deve impedir ativacao e informar indisponibilidade.

### Offline

- navegacao offline deve cair em pagina estatica sem dados sensiveis;
- assets basicos de icone podem ser cacheados;
- dados autenticados nao devem ser cacheados nesta etapa.

## Impacto no Backend

Arquivos afetados:

- `apps/api/prisma/schema.prisma`;
- `apps/api/prisma/migrations/20260712120000_add_push_subscriptions/migration.sql`;
- `apps/api/src/app.module.ts`;
- `apps/api/src/modules/notifications/notifications.module.ts`;
- `apps/api/src/modules/notifications/notifications.controller.ts`;
- `apps/api/src/modules/notifications/notifications.service.ts`;
- `apps/api/src/modules/notifications/dto/push-subscription.dto.ts`;
- `apps/api/.env.example`.

Endpoints:

```txt
GET    /api/notifications/public-key
POST   /api/notifications/subscriptions
DELETE /api/notifications/subscriptions
POST   /api/notifications/test
```

## Impacto no Frontend

Arquivos afetados:

- `apps/web/public/sw.js`;
- `apps/web/public/offline.html`;
- `apps/web/src/lib/push-notifications.ts`;
- `apps/web/src/components/app/push-notification-button.tsx`;
- `apps/web/src/components/app/header.tsx`;
- `apps/web/src/app/manifest.ts`.

Comportamento:

- header autenticado passa a exibir controle de notificacoes;
- o controle registra o Service Worker;
- o controle solicita permissao explicitamente;
- ao ativar, salva a subscription no backend;
- ao desativar, marca a subscription como inativa no backend e remove do navegador.

Impacto previsto em etapa posterior:

- criar componente de instalacao guiada;
- detectar `beforeinstallprompt`;
- detectar modo standalone;
- detectar iOS/Safari para instrucao manual;
- posicionar a chamada em local discreto no app autenticado.

## Variaveis de Ambiente

Adicionar no backend:

```env
WEB_PUSH_PUBLIC_KEY=...
WEB_PUSH_PRIVATE_KEY=...
```

Observacao:

- `WEB_PUSH_PRIVATE_KEY` e usada pelo backend para envio de notificacoes.
- Sem `WEB_PUSH_PUBLIC_KEY`, o frontend nao consegue criar subscription.
- Sem `WEB_PUSH_PRIVATE_KEY`, o backend nao consegue enviar notificacoes.

## Plano de Execucao

### Etapa 1 - Fundacao PWA e Subscription

Status: concluida

Objetivo:

- criar base tecnica para PWA/push;
- registrar subscriptions por usuario/dispositivo;
- disponibilizar controle de ativacao no frontend;
- garantir fallback offline seguro.

Entregas:

- [x] Prisma model e migration.
- [x] Modulo backend de notifications.
- [x] Endpoint de chave publica VAPID.
- [x] Endpoint para registrar subscription.
- [x] Endpoint para desativar subscription.
- [x] Service Worker publico.
- [x] Pagina offline segura.
- [x] Botao de notificacoes no header autenticado.
- [x] Helper frontend de Push API.
- [x] Manifest atualizado.
- [x] `.env.example` atualizado.

Validacoes:

- [x] `prisma generate`.
- [x] `prisma validate`.
- [x] Typecheck backend.
- [x] Typecheck frontend.

### Etapa 2 - Experiencia Guiada de Instalacao PWA

Status: concluida tecnicamente - pendente apenas validacao manual em dispositivo real

Objetivo:

- ajudar o usuario a instalar/adicionar o One Elo na tela inicial;
- usar prompt nativo quando o navegador permitir;
- orientar iOS/Safari com instrucoes curtas;
- ocultar a chamada quando o app ja estiver instalado.

Saida esperada:

- Android/Chrome exibe botao de instalacao quando elegivel.
- iOS/Safari exibe orientacao manual.
- App em modo standalone nao exibe a chamada.
- Experiencia visual fica discreta e integrada ao layout.

Checklist:

- [x] Criar helper para detectar suporte a instalacao PWA.
- [x] Capturar e armazenar evento `beforeinstallprompt`.
- [x] Detectar modo standalone/display-mode.
- [x] Detectar iOS/Safari para instrucao manual.
- [x] Criar componente visual discreto de instalacao.
- [x] Permitir dispensar a chamada e persistir a decisao no dispositivo.
- [x] Integrar componente ao layout autenticado.
- [x] Validar typecheck do frontend.
- [x] Registrar orientacoes de teste manual em Android/Chrome e iOS/Safari.

### Etapa 3 - Configuracao e Teste em Dispositivo Real

Status: concluida localmente - pendente apenas validacao em ambiente HTTPS/nuvem

Objetivo:

- gerar chaves VAPID reais;
- configurar ambiente local/homologacao;
- aplicar migration no banco alvo;
- testar fluxo em Android/Chrome;
- testar comportamento em iOS/Safari quando aplicavel.

Saida esperada:

- Usuario consegue ativar notificacoes em dispositivo real.
- Subscription aparece salva no banco.
- Usuario consegue desativar notificacoes.
- Fallback offline abre sem expor dados autenticados.

Checklist:

- [x] Adicionar script para gerar chaves VAPID reais.
- [x] Gerar chaves VAPID reais para o ambiente local.
- [x] Configurar ambiente local com `WEB_PUSH_PUBLIC_KEY`.
- [x] Configurar ambiente local com `WEB_PUSH_PRIVATE_KEY`.
- [x] Aplicar migration no banco local.
- [x] Testar instalacao PWA em desktop/Chrome.
- [x] Testar fluxo iOS/Safari local ate instalacao guiada.
- [x] Testar ativacao de notificacoes em navegador local com suporte.
- [ ] Testar desativacao de notificacoes em dispositivo real.
- [x] Confirmar subscription persistida no banco local.

Comando para gerar chaves:

```bash
npm.cmd run push:keys -w apps/api
```

As chaves geradas devem ser copiadas para o ambiente da API:

```env
WEB_PUSH_PUBLIC_KEY=...
WEB_PUSH_PRIVATE_KEY=...
```

Cuidados:

- nao commitar chaves reais;
- usar HTTPS para teste real de push/PWA fora de `localhost`;
- para teste local via celular, usar `NEXT_ALLOWED_DEV_ORIGINS` em vez de IP hardcoded no codigo;
- repetir a geracao apenas se quiser rotacionar as chaves.

### Etapa 4 - Envio Manual/Teste Tecnico de Push

Status: implementada tecnicamente - aguardando teste de recebimento real

Objetivo:

- adicionar dependencia ou implementacao de envio Web Push no backend;
- criar service interno de envio;
- criar endpoint administrativo/temporario ou script controlado para disparo de teste;
- validar recebimento no Service Worker.

Saida esperada:

- Backend consegue enviar uma notificacao de teste para subscriptions ativas do usuario.

Checklist:

- [x] Adicionar dependencia/implementacao de envio Web Push.
- [x] Criar service interno de envio.
- [x] Usar VAPID public/private key no sender.
- [x] Criar disparo controlado de teste.
- [x] Enviar notificacao para subscriptions ativas do usuario.
- [x] Tratar erro de endpoint invalido.
- [ ] Validar clique abrindo rota esperada no PWA.

Endpoint de teste:

```txt
POST /api/notifications/test
```

Body sugerido:

```json
{
  "title": "One Elo",
  "body": "Notificacao de teste enviada pelo One Elo.",
  "url": "/dashboard"
}
```

Retorno esperado:

```json
{
  "sent": 1,
  "failed": 0,
  "total": 1
}
```

Observacao:

- o endpoint envia somente para subscriptions ativas do usuario autenticado no tenant atual;
- endpoints expirados com retorno 404/410 sao desativados automaticamente;
- o recebimento real deve ser validado em ambiente com HTTPS, especialmente em dispositivos moveis.

### Etapa 5 - Notificacoes de Escalas

Status: validada para o evento inicial

Objetivo:

- disparar notificacoes para eventos reais de escala.
- iniciar com eventos de baixo ruido e alta utilidade.

Candidatos:

- escala publicada para membros escalados;
- lembrete de confirmacao pendente 24h antes da escala;
- lembrete no dia da escala;
- aviso para lider quando membro recusar.

Fora do escopo inicial:

- notificacao generica para escala alterada;
- notificacao para cada edicao de item/dia/funcao;
- notificacao para membros sem usuario vinculado ou sem subscription ativa.

Saida esperada:

- Membro escalado com usuario vinculado e subscription ativa recebe notificacao quando a escala for publicada.
- Membro com confirmacao pendente recebe lembrete no dia anterior a escala, se tiver usuario vinculado e subscription ativa.
- Membro escalado recebe lembrete no dia da escala, se nao tiver recusado e tiver usuario vinculado/subscription ativa.
- A notificacao leva o membro para `/minhas-escalas`.
- Nao ha disparo para escala em rascunho.
- Nao ha disparo para escala apenas editada.

Checklist:

- [x] Definir que escala alterada fica fora do escopo inicial.
- [x] Definir payload da notificacao de escala publicada.
- [x] Implementar notificacao quando escala muda de `RASCUNHO` para `PUBLICADA`.
- [x] Enviar para os membros escalados, sem filtrar por status de confirmacao na publicacao.
- [x] Enviar somente para membros com usuario vinculado.
- [x] Enviar somente para usuarios com subscription ativa.
- [x] Validar recebimento real da notificacao de escala publicada no navegador.
- [x] Implementar lembrete de confirmacao pendente 24h antes da escala.
- [x] Criar job interno da API para executar o lembrete diariamente.
- [x] Implementar lembrete no dia da escala as 09:00.
- [ ] Implementar aviso para lider quando membro recusar.
- [ ] Evitar duplicidade em edicoes sucessivas.
- [ ] Garantir isolamento por tenant.
- [ ] Validar usuarios destinatarios por contexto.

Implementacao inicial:

- `EscalasService.update` dispara notificacao apenas na transicao `RASCUNHO` -> `PUBLICADA`.
- O destinatario e resolvido por `Membro -> User`, nao por `EscalaItem.userId`, para evitar enviar para quem criou a escala.
- Na publicacao, nao ha filtro por `statusConfirmacao`, porque os membros ainda nao tiveram oportunidade de confirmar.
- O envio usa subscriptions ativas do tenant atual.
- A notificacao abre `/minhas-escalas?pendentesApenas=true`.
- Mensagem final: `Você foi escalado em {ministerio}.\nConfirme sua presença no One Elo.`
- Nao existe disparo para escala alterada.

Implementacao do lembrete 24h:

- A API usa `@nestjs/schedule` para executar o job internamente, sem cron externo.
- O job roda todos os dias as 08:00 e 13:00 no fuso `America/Sao_Paulo`.
- O job busca itens com `statusConfirmacao = PENDENTE`, escala `PUBLICADA` e data da escala no dia seguinte.
- O envio considera apenas membros com usuario vinculado e ativo.
- Nao ha campo de controle de envio no banco; se continuar pendente, o membro pode receber novamente no segundo horario.
- Mensagem do lembrete: `Sua confirmação ainda está pendente para amanhã em {ministerio}.\nConfirme sua presença no One Elo.`

Implementacao do lembrete no dia da escala:

- A API usa `@nestjs/schedule` para executar o job internamente, sem cron externo.
- O job roda todos os dias as 09:00 no fuso `America/Sao_Paulo`.
- O job busca itens da data atual em escala `PUBLICADA`.
- O envio considera itens com `statusConfirmacao` `PENDENTE` ou `CONFIRMADO`.
- Itens `RECUSADO` nao recebem lembrete do dia.
- O envio considera apenas membros com usuario vinculado e ativo.
- Mensagem: `Sua escala é hoje em {ministerio}.\nConfira os detalhes no One Elo.`

### Etapa 6 - Preferencias e Robustez

Status: pendente

Objetivo:

- permitir preferencias por tipo de notificacao;
- remover/desativar endpoints invalidos apos falha de envio;
- registrar auditoria ou log tecnico de envio;
- melhorar mensagens da UI.

Saida esperada:

- Push pronto para uso continuo em producao com menor risco operacional.

Checklist:

- [ ] Criar preferencias por tipo de notificacao.
- [ ] Desativar endpoints invalidos apos falha permanente.
- [ ] Registrar log tecnico de envio.
- [ ] Melhorar mensagens da UI.
- [ ] Revisar acessibilidade do controle de notificacoes.
- [ ] Documentar operacao e troubleshooting.

## Criterios de Aceite da Etapa 1

- Schema Prisma contem `PushSubscription`.
- Migration cria tabela `tb_push_subscription`.
- API retorna chave publica VAPID configurada.
- API salva subscription autenticada com tenant/user do JWT.
- API desativa subscription autenticada.
- Frontend registra Service Worker por acao do usuario.
- Frontend solicita permissao de notificacao apenas apos clique.
- Frontend salva subscription no backend.
- Frontend permite desativar subscription.
- Service Worker trata evento `push`.
- Service Worker trata clique em notificacao.
- Navegacao offline usa pagina estatica sem dados sensiveis.
- Plano contempla experiencia guiada de instalacao como etapa propria.
- Typecheck backend passa.
- Typecheck frontend passa.
- Prisma validate passa.

## Validacoes Executadas

```bash
npx.cmd prisma generate --schema apps/api/prisma/schema.prisma
npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false
npm.cmd install @nestjs/schedule --workspace apps/api
npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false
npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false
npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false
$env:DATABASE_URL='postgresql://dev:dev@localhost:5433/oneelo_saas'; npx.cmd prisma validate --schema apps/api/prisma/schema.prisma
node --check apps/api/scripts/generate-vapid-keys.mjs
npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false
npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false
npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false
npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false
npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false
npx.cmd prisma generate --schema apps/api/prisma/schema.prisma
npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false
```

Resultado:

- todas passaram.
- o comando `push:keys` foi adicionado para geracao de chaves VAPID, mas chaves reais nao foram impressas no plano nem devem ser commitadas.
- a subscription foi confirmada no banco local pelo usuario.
- o envio tecnico foi implementado via `web-push`; recebimento real fica para validacao em HTTPS/nuvem.
- a primeira notificacao de negocio da etapa 5 foi implementada e validada para publicacao de escala.
- o lembrete de confirmacao pendente 24h antes da escala foi implementado tecnicamente como job interno da API.
- o lembrete no dia da escala as 09:00 foi implementado tecnicamente como job interno da API.

Observacao:

- `prisma validate` precisou de `DATABASE_URL` temporaria e execucao com acesso a engine Prisma fora da rede restrita.

## Orientacoes de Teste Manual - Etapa 2

### Android/Chrome

1. Abrir o One Elo no Chrome mobile.
2. Fazer login.
3. Confirmar que o banner "Instalar app One Elo" aparece quando o navegador disparar `beforeinstallprompt`.
4. Clicar em "Instalar".
5. Confirmar que o prompt nativo de instalacao aparece.
6. Instalar o app.
7. Abrir pelo icone da tela inicial.
8. Confirmar que o banner nao aparece em modo standalone.

### iOS/Safari

1. Abrir o One Elo no Safari.
2. Fazer login.
3. Confirmar que aparece orientacao para usar Compartilhar e "Adicionar a Tela de Inicio".
4. Adicionar o app a tela inicial.
5. Abrir pelo icone.
6. Confirmar que a chamada de instalacao nao aparece em modo standalone.

### Dispensar chamada

1. Clicar no botao de fechar do banner.
2. Recarregar a pagina.
3. Confirmar que a chamada nao volta no mesmo dispositivo/navegador.

## Riscos e Cuidados

- iOS/Safari tem restricoes especificas para push em PWA instalado.
- iOS/Safari tambem exige fluxo manual de adicionar a tela inicial.
- Push depende de HTTPS em ambiente real.
- Usuario pode bloquear notificacoes no navegador, e isso nao pode ser revertido pelo app.
- Endpoints de push podem expirar; etapa de envio precisa desativar endpoints invalidos.
- Notificacoes de escala precisam respeitar tenant, usuario e contexto ministerial.
- Evitar cache de dados autenticados no Service Worker.
- Evitar envio duplicado quando uma escala for editada muitas vezes.

## Recomendacao de Proxima Etapa

Seguir para Etapa 2 antes de implementar disparos automaticos.

Motivo:

- melhorar a taxa de instalacao do PWA;
- preparar o usuario para ativar notificacoes em contexto de app instalado;
- confirmar que a subscription funciona em dispositivo real;
- validar chaves VAPID e HTTPS;
- reduzir risco de construir envio em cima de uma base nao testada no celular.
