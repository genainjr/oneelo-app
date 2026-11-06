# Plano - Otimização de Performance, Memória e Consumo de Recursos (Render Free & Frontend)

Status geral: planejado  
Data de criação: 2026-11-06  
Última atualização: 2026-11-06 (Revisado com blindagens de produção)  
Branch sugerida para implementação: `perf/otimizacao-recursos-api-web`  

## Planos e Referências Relacionados

- [Central de Notificações](central-notificacoes-plan.md)
- [Estabilidade de Memória da Exportação de Escalas](escala-export-memory-stability-plan.md)
- [Performance da Exportação de Escalas no Render Free](escala-export-performance-plan.md)
- [Resumo de Escalas e Dashboard](dashboard-basic-escalas-plan.md)

---

## 1. Objetivo da Entrega

Reduzir drasticamente o consumo ocioso de CPU, conexões de banco de dados (PostgreSQL), tráfego de rede e memória RAM residente (limite rígido de 512 MB no Render Free) tanto no backend (`apps/api`) quanto no frontend (`apps/web`), eliminando gargalos estruturais com **zero regressão funcional ou visual em produção**.

A entrega atua sobre **7 frentes de otimização blindadas para produção**:
1. **Ponto 1 — Fila de Push Event-Driven + Cron Espaçado:** Substituir o polling agressivo de banco a cada 15s (5.760 transações/dia) por acionamento imediato orientado a evento no enfileiramento, mantendo o `@Cron` apenas a cada 5 minutos como varredura de segurança.
2. **Ponto 2 — Centralização Segura da Sessão (`/api/auth/me`) no Frontend:** Evoluir o `AuthUserContext` com `loadingUser` e `refreshUser()`, fazendo as telas internas do dashboard consumirem o usuário em memória sem condições de corrida (race conditions) e sem chamadas duplicadas a `/api/auth/me`.
3. **Ponto 3 — Polling Inteligente no Sininho de Notificações (`visibilitychange`):** Pausar o polling de `/api/notifications/inbox` quando a aba estiver oculta (`document.hidden`), retomar ao focar a aba (com throttle) e ampliar o intervalo ativo de 60s para 180s.
4. **Ponto 4 — Limites Explícitos de Memória (Node.js e Sharp) Compatíveis com Chromium:** Configurar `--max-old-space-size=256` exclusivamente no processo principal do NestJS no `entrypoint.sh` (preservando ~250 MB livres para o Playwright Chromium exportar PDFs/PNGs sem estourar os 512 MB do Render Free) e restringir o `sharp` (`concurrency(1)` e `cache(false)`).
5. **Ponto 5 — Desativação do Swagger em Produção:** Condicionar a geração da árvore de metadados do `SwaggerModule` apenas para ambientes fora de produção (`NODE_ENV !== 'production'`), reduzindo o uso de RAM no boot.
6. **Ponto 6 — Dashboard via Endpoint Agregado Único (Com Paridade de Regra de Negócio):** Alinhar as queries de `DashboardService.getIndicadores` com as regras exatas hoje exibidas na UI (incluindo `eventosDoMes`, contagem mensal de escalas e pendências em escalas publicadas) e refatorar `use-dashboard.ts` para fazer **1 única chamada leve** em vez de 5 listagens completas.
7. **Ponto 7 — Endpoint Interno Assíncrono para Acionamento de Crons Críticos:** Criar rota protegida por chave secreta (`POST /api/internal/crons/lembretes`) que materializa os lembretes de forma idempotente no banco e dispara a fila de Push em background (`setImmediate`), respondendo imediatamente em `< 1s` para jamais sofrer timeout no `cron-job.org`.

---

## 2. Contexto, Diagnóstico e Blindagens de Produção

### Diagnóstico Técnico e Riscos Mitigados:
1. **`notification-queue-processor.service.ts` (Ponto 1):** O decorator `@Cron('*/15 * * * * *')` abre uma transação com `SELECT ... FOR UPDATE SKIP LOCKED` a cada 15 segundos ininterruptamente. Já `NotificationDispatchService.createNotification()` insere a notificação no banco, mas espera o próximo ciclo do cron para disparar o push.
2. **`dashboard-shell.tsx` vs Telas Filhas (Ponto 2 — Blindagem contra Race Condition e Stale State):**
   - O `DashboardShell` já provê `<AuthUserProvider>`, mas **12 páginas de `(dashboard)`** ainda chamam `api.get('/api/auth/me')` por conta própria.
   - **Armadilha mitigada:** Quando o `DashboardShell` busca `/api/auth/me` no cliente, `user` começa como `null` nos primeiros ~150ms. Se páginas como `minhas-escalas` ou `membros` não aguardarem `loadingUser === false`, ou se `escalas/visualizacao` não reagir à chegada de `user` (para mesclar `user.membro.ministerios`), usuários `BASIC` sofreriam redirecionamentos indevidos ou listas vazias. Além disso, alterações de perfil/logo/ministérios precisam acionar `refreshUser()` para não deixar o contexto obsoleto.
3. **`notification-bell-inbox.tsx` (Ponto 3):** O `setInterval` de 60s não verifica `document.hidden`, gerando centenas de requisições por hora em abas em segundo plano.
4. **Concorrência de Memória Node.js vs Playwright Chromium em 512 MB (Pontos 4 e 5 — Blindagem contra OOM 137):**
   - A API executa o **Chromium headless** (`ChromiumRendererService`) dentro do mesmo container de 512 MB para exportar PDFs e PNGs de Escalas e da Agenda (consumindo ~180–220 MB durante a renderização).
   - **Armadilha mitigada:** Definir `ENV NODE_OPTIONS="--max-old-space-size=300"` globalmente no `Dockerfile` afetaria subprocessos (como Prisma/Playwright) e permitiria que o Node ocupasse ~350 MB de RSS, deixando menos de 160 MB para o Chromium e causando queda por OOM ao exportar PDF. Por isso, aplicaremos `--max-old-space-size=256` **diretamente no comando `exec node` do `entrypoint.sh`**, garantindo coleta de lixo preventiva no Node e reservando ~250 MB livres para o Chromium.
5. **Divergência de Contadores em `DashboardService.getIndicadores` vs `use-dashboard.ts` (Ponto 6 — Blindagem de Regra de Negócio):**
   - **Armadilha mitigada:** O hook atual `use-dashboard.ts` calcula:
     - Card **"Escalas do Mês"** (`escalasNaSemana`): total de registros `Escala` do `mes` e `ano` correntes; porém `DashboardService.getIndicadores()` antigo contava `escalaDia` apenas da semana corrente.
     - Card **"Pendências de Confirmação"**: total de `escalaItem` com `statusConfirmacao: PENDENTE` em escalas `PUBLICADA` (igual a `EscalasService.countPendencias`); porém `DashboardService.getIndicadores()` filtrava `data >= new Date()` com hora cheia, excluindo indevidamente escalas do próprio dia salvas com `00:00:00Z`.
   - Antes de apontar `use-dashboard.ts` para `GET /api/dashboard/indicadores`, alinharemos `DashboardService.getIndicadores` para refletir exatamente as mesmas regras em produção + o contador `eventosDoMes`.
6. **Timeout de 30s do `cron-job.org` (Ponto 7 — Blindagem de Execução Assíncrona):**
   - **Armadilha mitigada:** Se `POST /api/internal/crons/lembretes` aguardasse o disparo HTTP de todas as assinaturas Web Push antes de responder, o `cron-job.org` acusaria falha por timeout em igrejas maiores. O endpoint fará apenas a criação idempotente dos registros de notificação no banco e acionará `queueProcessor.triggerImmediateProcessing()` via `setImmediate`, respondendo `200 OK` rapidamente.

---

## 3. Decisões de Arquitetura e Engenharia

### 3.1 Acionamento Event-Driven da Fila de Notificações com `hasPendingTrigger` (Ponto 1)
- `NotificationQueueProcessorService` exporá `triggerImmediateProcessing(): void`, que agenda via `setImmediate(() => { void this.handleCron(); })` o processamento assíncrono sem bloquear a request HTTP do chamador.
- **Prevenção contra perda de gatilho concorrente:** Se `handleCron()` / `triggerImmediateProcessing()` for chamado enquanto `this.isProcessing === true` (ex: uma segunda notificação é criada enquanto um lote menor que 50 itens está sendo entregue via Web Push), uma flag `private hasPendingTrigger = false` será marcada como `true`. O laço principal `do { this.hasPendingTrigger = false; processedInBatch = await this.processBatch(); } while (processedInBatch === this.batchSize || this.hasPendingTrigger)` garante uma nova varredura imediata antes de liberar `this.isProcessing = false`, impedindo que notificações concorrentes aguardem os 5 minutos do cron.
- `NotificationDispatchService` receberá `@Optional() private readonly queueProcessor?: NotificationQueueProcessorService` e invocará `this.queueProcessor?.triggerImmediateProcessing()` sempre que criar ou reagendar uma notificação com `scheduledAt <= new Date()`.
- O `@Cron` de `NotificationQueueProcessorService` passará para `'0 */5 * * * *'` (a cada 5 minutos).

### 3.2 Evolução do `AuthUserContext` e Consumo Seguro nas Telas (Ponto 2)
- `AuthUserContext` (`apps/web/src/contexts/auth-user-context.tsx`) e `DashboardShell` passarão a fornecer:
  - `user: AuthUser | null`
  - `setUser: Dispatch<SetStateAction<AuthUser | null>>`
  - `loadingUser: boolean` (`false` se `initialUser` já veio preenchido no SSR; `true` enquanto o fetch inicial de `/api/auth/me` no cliente estiver em andamento)
  - `refreshUser: () => Promise<AuthUser | null>` (para revalidar a sessão sob demanda quando perfil, logo do tenant ou liderança de ministério forem alterados).
- Nas 12 páginas de `(dashboard)`:
  - Redirecionamentos baseados em role (`membros/page.tsx`, `minhas-escalas/page.tsx`) só executarão quando `loadingUser === false`.
  - Cálculos que dependem de `user.membro.ministerios` (`escalas/visualizacao/page.tsx`, `agenda/page.tsx`, `personal-panel/page.tsx`) usarão `useMemo` ou listarão `user` nas dependências do `useEffect`.

### 3.3 Polling Inteligente com `visibilitychange` (Ponto 3)
- Em `NotificationBellInbox`:
  - Intervalo periódico alterado de `60_000` (1 min) para `180_000` (3 min).
  - O callback do intervalo verifica `if (document.hidden) return;`.
  - Listener de `visibilitychange` dispara `loadInbox(true)` quando `document.visibilityState === 'visible'` e o tempo desde a última leitura (`lastFetchedAtRef`) for `>= 30_000` ms.

### 3.4 Blindagem de Memória Node.js + Sharp e Swagger Condicional (Pontos 4 e 5)
- Em `apps/api/entrypoint.sh`:
  - Iniciar o processo principal com `exec node --max-old-space-size=256 dist/src/main.js` (ou `dist/main.js`), mantendo os subprocessos livres de flags globais e preservando ~250 MB de folga nos 512 MB do Render Free para quando o Chromium for aberto pelo serviço de exportação.
- Em `apps/api/src/main.ts`:
  - Configurar `sharp.cache(false)` e `sharp.concurrency(1)` no bootstrap;
  - Condicionar `DocumentBuilder`, `SwaggerModule.createDocument` e `SwaggerModule.setup` a `if (isDevelopment)`.

### 3.5 Unificação, Fuso Operacional e Paridade de Indicadores do Dashboard (Ponto 6)
- Em `DashboardService.getIndicadores(tenantId)`:
  - **Resolução de data em fuso brasileiro (`America/Sao_Paulo`):** Extrair `mesAtual`, `anoAtual`, `inicioDoMes` e `fimDoMes` considerando explicitamente o timezone `America/Sao_Paulo` (evitando que o container Linux em `UTC` vire o mês 3 horas antes no último dia do mês às 21h BRT);
  - `totalMembrosAtivos`: `membro.count({ where: { tenantId, status: ATIVO } })`;
  - `ministeriosAtivos`: `ministerio.count({ where: { tenantId, ativo: true } })`;
  - `escalasDoMes` (retornado também como `escalasDaSemana` para retrocompatibilidade): `escala.count({ where: { tenantId, mes: mesAtual, ano: anoAtual } })`;
  - `eventosDoMes`: `evento.count({ where: { tenantId, dataInicio: { gte: inicioDoMes, lte: fimDoMes } } })`;
  - `pendenciasConfirmacao`: `escalaItem.count({ where: { statusConfirmacao: PENDENTE, escalaDia: { escala: { tenantId, status: PUBLICADA } } } })` (paridade exata com `EscalasService.countPendencias`);
  - `aniversariantesMes`: `SELECT COUNT(*) ... EXTRACT(MONTH FROM "dataNascimento") = ${mesAtual}`.
- Em `apps/web/src/hooks/use-dashboard.ts`:
  - Substituir as 5 chamadas por `api.get('/api/dashboard/indicadores')`.

### 3.6 Endpoint Interno Assíncrono para Crons Críticos (Ponto 7)
- Rota `POST /api/internal/crons/lembretes` em `NotificationsController`:
  - Decorada com `@Public()` e `@HttpCode(HttpStatus.OK)`;
  - Valida o header `x-internal-cron-key` via `crypto.timingSafeEqual` contra `INTERNAL_CRON_API_KEY`;
  - Executa a materialização idempotente dos lembretes solicitados (`job?: 'all' | 'birthdays' | 'confirmations-24h' | 'schedule-day' | 'queue'`), aciona `queueProcessor.triggerImmediateProcessing()` em background e retorna imediatamente o resumo da operação.

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma etapa, atualize o checklist (`[x]`), apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Limites de Memória (Node.js 256MB e Sharp) e Desativação do Swagger em Produção (Pontos 4 e 5)
Status: concluído

- [x] Atualizar `apps/api/src/main.ts`:
  - Importar `sharp` e aplicar `sharp.cache(false)` e `sharp.concurrency(1)` no bootstrap;
  - Condicionar a criação e exposição do Swagger (`SwaggerModule.createDocument` e `SwaggerModule.setup`) a `if (isDevelopment)`.
- [x] Atualizar `apps/api/entrypoint.sh`:
  - Adicionar `--max-old-space-size=256` diretamente no comando `exec node` de inicialização da API, preservando margem de RAM para o Chromium de exportação PDF/PNG nos 512 MB do Render Free.
- Critério de validação da etapa: Build da API (`npm run build -w apps/api`) e testes existentes passando sem erros.

### Etapa 1 - Otimização da Fila de Push: Event-Driven + Cron Espaçado (Ponto 1)
Status: concluído

- [x] Atualizar `apps/api/src/modules/notifications/services/notification-queue-processor.service.ts`:
  - Alterar o decorator `@Cron('*/15 * * * * *')` para `@Cron('0 */5 * * * *')` (a cada 5 minutos);
  - Adicionar método `triggerImmediateProcessing(): void` que dispara `handleCron()` de forma assíncrona (`setImmediate`);
  - Implementar flag `private hasPendingTrigger = false` para garantir que notificações enfileiradas durante o envio de um lote em andamento (`this.isProcessing === true`) sejam processadas imediatamente na iteração seguinte do laço `do ... while`.
- [x] Atualizar `apps/api/src/modules/notifications/services/notification-dispatch.service.ts`:
  - Injetar `@Optional() private readonly queueProcessor?: NotificationQueueProcessorService`;
  - Ao final de `createNotification`, `rescheduleNotification` e `retryFailedRecipients`, se `scheduledAt <= new Date()`, invocar `this.queueProcessor?.triggerImmediateProcessing()`.
- [x] Atualizar/criar testes unitários em `notification-queue-processor.service.spec.ts` (incluindo teste de gatilho concorrente com `hasPendingTrigger`) e `notification-dispatch.service.spec.ts`.
- Critério de validação da etapa: Testes unitários do módulo de notificações passando 100% (`npm test -w apps/api -- notification`).

### Etapa 2 - Endpoint Interno Assíncrono para Acionamento de Crons Críticos (Ponto 7)
Status: planejado

- [ ] Documentar variável `INTERNAL_CRON_API_KEY` no `.env.example` de `apps/api`.
- [ ] Criar endpoint `POST /api/internal/crons/lembretes` em `NotificationsController`:
  - Decorado com `@Public()` e `@HttpCode(200)`;
  - Validar header `x-internal-cron-key` com `crypto.timingSafeEqual` contra `ConfigService.get('INTERNAL_CRON_API_KEY')` (retornando `401 Unauthorized` se ausente, inválido ou não configurado);
  - Suportar filtro opcional `job` (`all` | `birthdays` | `confirmations-24h` | `schedule-day` | `queue`), materializando as notificações de forma idempotente e disparando `triggerImmediateProcessing()` em background para resposta rápida ao `cron-job.org`.
- [ ] Criar testes unitários em `notifications.service.spec.ts` / controller validando autenticação da chave secreta (`401` vs `200`) e execução idempotente dos jobs.
- Critério de validação da etapa: Testes unitários do módulo de notificações passando 100%.

### Etapa 3 - Otimização do Dashboard via Endpoint Agregado Único com Paridade de Negócio (Ponto 6)
Status: planejado

- [ ] Atualizar `apps/api/src/modules/dashboard/dashboard.service.ts`:
  - Calcular `mesAtual`, `anoAtual`, `inicioDoMes` e `fimDoMes` no timezone `America/Sao_Paulo` para não virar o mês adiantado no servidor UTC;
  - Alinhar `getIndicadores(tenantId)` com as regras de negócio da UI: incluir `eventosDoMes` (contagem no mês corrente), `escalasDoMes` (contagem de `Escala` no mês/ano corrente, mantendo `escalasDaSemana` por compatibilidade) e ajustar `pendenciasConfirmacao` para a mesma regra de `EscalasService.countPendencias`.
- [ ] Criar/atualizar testes unitários de `DashboardService` (`dashboard.service.spec.ts`) validando todos os contadores retornados e a resolução em fuso brasileiro.
- [ ] Refatorar `apps/web/src/hooks/use-dashboard.ts`:
  - Substituir as 5 chamadas paralelas (`Promise.allSettled`) por 1 única chamada a `GET /api/dashboard/indicadores`.
- Critério de validação da etapa: Testes unitários de `DashboardService` passando 100% e página `/dashboard` carregando os 6 indicadores em 1 única requisição HTTP.

### Etapa 4 - Centralização Segura da Sessão (`/api/auth/me`) e Polling Inteligente no Sininho (Pontos 2 e 3)
Status: planejado

- [ ] Evoluir `apps/web/src/contexts/auth-user-context.tsx` e `apps/web/src/components/app/dashboard-shell.tsx`:
  - Incluir `loadingUser: boolean` e `refreshUser: () => Promise<AuthUser | null>` no contexto (com valores padrão seguros para não quebrar testes isolados).
- [ ] Refatorar as 12 telas de `apps/web/src/app/(dashboard)/` para consumirem `useAuthUser()` sem race conditions:
  - `dashboard/page.tsx`
  - `personal-panel/page.tsx`
  - `agenda/page.tsx`
  - `agenda/visualizacao/page.tsx`
  - `escalas/page.tsx`
  - `escalas/visualizacao/page.tsx` (garantindo reatividade quando `user` carregar após `minList`)
  - `minhas-escalas/page.tsx` (aguardando `!loadingUser` antes de redirecionar `BASIC`)
  - `membros/page.tsx` (aguardando `!loadingUser` antes de redirecionar `BASIC`)
  - `ministerios/page.tsx` (acionando `refreshUser` ao alterar vínculos de liderança)
  - `financeiro/visualizacao/page.tsx`
  - `configuracoes/page.tsx` (acionando `refreshUser` ao atualizar dados/logo da igreja)
  - `meu-perfil/page.tsx` (sincronizando alterações de perfil com `setUser`/`refreshUser`).
- [ ] Atualizar `apps/web/src/components/app/notification-bell-inbox.tsx`:
  - Alterar intervalo do polling de `60000` (60s) para `180000` (180s);
  - Pausar ciclos quando `document.hidden === true`;
  - Adicionar listener `visibilitychange` com throttle de 30s para atualizar ao voltar à aba.
- Critério de validação da etapa: Navegação fluida entre todas as telas sem chamadas repetidas a `/api/auth/me`, sem redirecionamentos falsos no mount e com polling do sininho pausando em segundo plano.

### Etapa 5 - Validação de Não-Regressão, Testes Automatizados e Build Final
Status: planejado

- [ ] Executar suíte completa de testes unitários no backend (`apps/api`) e no frontend (`apps/web`).
- [ ] Executar build de produção completo (`npm.cmd run build`) em `apps/api` e `apps/web`.
- [ ] Revisar status do Git e atualizar checklist final do plano.
- Critério de validação da etapa: Todos os testes e builds passando 100% sem erros de TypeScript ou regressões.

---

## 5. Critérios de Aceite Gerais

1. **Redução de Transações Ociosas no Banco:** O processador de fila de push dispara instantaneamente no enfileiramento (`setImmediate`) e usa cron de 5 minutos apenas como fallback.
2. **Eliminação de Fetch Duplicado de Sessão sem Race Conditions:** As páginas do dashboard leem `{ user, loadingUser, refreshUser }` do `AuthUserContext` sem repetir `GET /api/auth/me` na navegação e mantendo sincronia quando dados do usuário/tenant mudam.
3. **Polling Consciente de Visibilidade:** Abas em segundo plano (`document.hidden`) não geram tráfego de `/api/notifications/inbox`.
4. **Proteção contra OOM (512 MB) Compatível com Exportação PDF/PNG:** API configurada com `--max-old-space-size=256` no processo principal, `sharp.concurrency(1)`, `sharp.cache(false)` e sem compilação do Swagger em produção, preservando janela de memória para o Chromium.
5. **Carregamento Instantâneo e Fiel do Dashboard:** `use-dashboard.ts` realiza apenas 1 chamada agregada a `/api/dashboard/indicadores`, exibindo exatamente os mesmos contadores de negócio.
6. **Acionamento Externo Rápido e Confiável de Crons:** Endpoint `/api/internal/crons/lembretes` autenticado por chave secreta, 100% idempotente e imune a timeouts do `cron-job.org`.
