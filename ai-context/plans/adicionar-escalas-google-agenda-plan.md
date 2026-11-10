# Plano - Adicionar Escalas e Eventos da Igreja ao Google Agenda e Calendários (FT-002 Expandido)

Status geral: concluído  
Data de criação: 2026-11-05  
Última atualização: 2026-11-09  
Branch sugerida para implementação: `feature/adicionar-escalas-eventos-calendario`  

## Planos e Referências Relacionados

- [Detalhamento do Roadmap FT-002](../backlog/features-roadmap.md)
- [Painel Pessoal do Usuário BASIC](painel-pessoal-basic-plan.md)
- [Agenda, Tipos de Evento e Visibilidade](agenda-eventos-publico-plan.md)
- [Central de Notificações](central-notificacoes-plan.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [ODS - Padrão de Visualização](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)

---

## 1. Objetivo da Entrega

Permitir que tanto **voluntários escalados** quanto **membros comuns da igreja** incluam seus compromissos (escalas ministeriais e eventos gerais/ministeriais da igreja) diretamente no **Google Agenda** (e demais aplicativos de calendário, como Apple Calendar e Outlook) com zero atrito, além de permitir que a liderança **dispare notificações de eventos específicos** convidando os membros a adicionarem o evento na agenda com 1 toque.

A solução cobre quatro pilares integrados:
1. **Escalas Ministeriais (Unitária e em Lote):** Ação direta nos cards de `/minhas-escalas` e `/personal-panel` (via URL Template do Google Agenda) e exportação consolidada do mês via arquivo `.ics`.
2. **Eventos da Igreja para Membros Comuns (Unitária e em Lote):** Qualquer membro comum (mesmo sem ministério) pode adicionar cultos, conferências, retiros e programações da igreja à sua agenda pessoal diretamente pela tela de visualização da agenda (`/agenda/visualizacao`) e pelo Painel Pessoal (`/personal-panel`), individualmente ou em lote (`.ics`).
3. **Notificações de Eventos Específicos e Escalas (Push + Inbox In-App):**
   - **Disparo sob demanda pela liderança:** Na gestão de agenda (`/agenda`), administradores e líderes podem disparar uma notificação ("Divulgar / Convidar para Agenda") de um evento específico para os membros elegíveis (toda a igreja para eventos `GERAL` ou membros do ministério para eventos `MINISTERIO`).
   - **Atalho direto nas notificações:** Tanto as notificações disparadas sob demanda quanto os lembretes automáticos (de escalas e de eventos) trazem o atalho **"Adicionar à Agenda"** no Inbox In-App (`NotificationBellInbox`) e via deep-link ao clicar no Push Notification.
4. **Gestão de Remoção Desacoplada e Autônoma:** Remoção manual pelo próprio usuário no seu aplicativo de calendário, sem necessidade de OAuth bidirecional invasivo na conta Google pessoal do membro.

---

## 2. Contexto e Diagnóstico

### Diagnóstico Técnico:
- **Escalas (`GET /api/escalas/minhas`):** Já retorna `escalaDia.data`, `escalaDia.evento` (`dataInicio`, `dataFim`, `local`, `titulo`), `escala.ministerio.nome` e `funcao.nome`.
- **Eventos da Igreja (`GET /api/eventos`):** Já respeita a visibilidade por perfil (`buildVisibilityWhere` em `EventosService`): membros comuns (`BASIC` sem liderança) visualizam todos os eventos `GERAL` e `MINISTERIO` da igreja em `/agenda/visualizacao` e no card de próximos eventos em `/personal-panel`.
- **Infraestrutura de Notificações (`NotificationDispatchService`):** O backend já conta com fila persistente, Inbox In-App (`/api/notifications/inbox`) e disparo Web Push com controle de público (`ALL_MEMBERS`, `MINISTRY`, `SPECIFIC_USERS`) e `urlDestino`.
- **Lacuna suprida por esta entrega:**
  - Botão universal e intuitivo para o membro salvar escalas e eventos gerais da igreja no seu calendário pessoal;
  - Na tela `/agenda`, botão direto para notificar e divulgar aos membros elegíveis com 1 clique o convite para adicionar na agenda;
  - As notificações no `NotificationBellInbox` exibem badge/ação destacada "Adicionar à Agenda" (`CalendarPlus`) em vez de link genérico.

---

## 3. Decisões de Arquitetura e Engenharia

### 3.1 Geração de Link Unitário (Google Calendar URL Template)
O utilitário `calendar-url-builder.ts` é agnóstico e atende tanto Escalas quanto Eventos da Igreja através da interface unificada `CalendarEventParams`:
- **Base URL:** `https://calendar.google.com/calendar/render?action=TEMPLATE`
- **Mapeamento para Escala (`mapEscalaToCalendarEvent`):**
  - `text`: `[Nome do Ministério] Nome do Evento/Culto - Função` (ex: `[Louvor] Culto de Celebração - Bateria`);
  - `details`: Função escalada, Ministério, Observações e link para `/minhas-escalas`;
  - `location`: Local do evento associado (se houver).
- **Mapeamento para Evento da Igreja (`mapEventoToCalendarEvent`):**
  - `text`: `Título do Evento` (ou `[Ministério] Título do Evento` quando for evento restrito de ministério);
  - `details`: Descrição do evento, ministérios participantes e link para `/agenda/visualizacao`;
  - `location`: Campo `local` do evento.

### 3.2 Resolução Determinística de Datas e Fusos Horários (Prevenção de Bug UTC-3)
No PostgreSQL e nas APIs do OneElo, datas civis sem horário são persistidas como `00:00:00.000Z`. Converter `00:00:00Z` diretamente para hora UTC faria o Google Calendar exibir o compromisso no Brasil (UTC-3) às 21h00 da noite **anterior**.  
Para evitar esse bug, a formatação de `dates` segue a seguinte hierarquia determinística:
1. **Com `dataInicio` e `dataFim` com horário explícito:** Formata ambos em UTC (`YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ`).
2. **Com `dataInicio` com horário, mas sem `dataFim`:** Calcula término com duração padrão de 2 horas e formata em UTC (`YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ`).
3. **Sem horário explícito (apenas data civil):** Formata como **Evento de Dia Inteiro** no padrão Google/iCalendar (`YYYYMMDD/YYYYMMDD`, onde a data final é o dia seguinte exclusivo), garantindo que o compromisso permaneça no dia civil exato sem sofrer deslocamento de fuso.

### 3.3 Geração em Lote (Universal iCalendar `.ics` RFC 5545 e Mobile PWA)
Como navegadores bloqueiam a abertura simultânea de múltiplas abas (`window.open` em loop é barrado como pop-up):
- Tanto em `/minhas-escalas` ("Adicionar todas as escalas") quanto em `/agenda/visualizacao` ("Adicionar eventos ao Calendário"), a ação em lote gera e baixa um arquivo `.ics` em memória via `Blob` com MIME type `text/calendar;charset=utf-8`.
- Compatibilidade Mobile PWA / iOS Safari / Android: disparo via elemento `<a download="...">`, acionando a folha nativa do sistema operacional para importar todos os eventos de uma só vez.

### 3.4 Disparo de Notificação para Evento Específico e Deep-Linking
1. **Endpoint de Divulgação de Evento (`POST /api/eventos/:id/notificar-agenda`):**
   - Permissão: `ADMIN` pode disparar para qualquer evento `AGENDADO`; usuário `BASIC` líder/auxiliar pode disparar para eventos `MINISTERIO` ou `REUNIAO_INTERNA` dos ministérios que lidera.
   - Público-alvo automático conforme o tipo do evento:
     - `EventoTipo.GERAL` → `NotificationAudienceType.ALL_MEMBERS` (todos os membros ativos da igreja);
     - `EventoTipo.MINISTERIO` ou `REUNIAO_INTERNA` → `NotificationAudienceType.MINISTRY` (membros ativos dos ministérios vinculados ao evento).
   - Conteúdo da notificação:
     - Título: `📅 Salve na agenda: {titulo do evento}`
     - Mensagem: `{titulo} acontecerá em {data às hora}{local}. Toque para adicionar à sua agenda!`
     - `urlDestino`: `/agenda/visualizacao?addCalendarEvento={evento.id}`
2. **Deep-Linking Automático no Frontend:**
   - Em `/minhas-escalas?addCalendar=<escalaItemId>`: ao carregar os itens, localiza a escala correspondente, aciona a abertura/modal de inclusão no Google Agenda e limpa o query param da URL.
   - Em `/agenda/visualizacao?addCalendarEvento=<eventoId>`: ao carregar o evento (ou buscar via `GET /api/eventos/:id` caso esteja fora do filtro de semana atual), aciona a abertura/modal de inclusão no Google Agenda e limpa o query param da URL.
3. **Atalho Visual no `NotificationBellInbox`:**
   - Notificações cujo `urlDestino` contenha `addCalendar=` ou `addCalendarEvento=` exibem um botão de ação rápida destacado **"Adicionar à Agenda"** (com ícone `CalendarPlus`), além de marcar a notificação como lida ao clicar.

### 3.5 Experiência de Remoção e Cancelamento
- A remoção no app de calendário do usuário é manual e autônoma (sem OAuth invasivo).
- Em `/minhas-escalas` (ao recusar escala) e nas notificações de cancelamento de evento, o sistema orienta amigavelmente o usuário a remover o compromisso caso já o tenha salvo na agenda pessoal.

---

## 4. Etapas de Desenvolvimento

### Etapa 0 - Helper Utilitário de Calendário e Datas (`calendar-url-builder.ts`)
Status: concluído

- [x] Criar `apps/web/src/lib/calendar-url-builder.ts`
- [x] Definir interface `CalendarEventParams` e funções mapeadoras
  - [x] `mapEscalaToCalendarEvent(item: MinhaEscalaItem): CalendarEventParams`
  - [x] `mapEventoToCalendarEvent(evento: Evento): CalendarEventParams`
- [x] Implementar formatador de datas com suporte a horários UTC e a eventos de dia inteiro (All-Day, prevenindo desvios de fuso UTC-3)
- [x] Implementar gerador de URL do Google Agenda (`buildGoogleCalendarUrl(params: CalendarEventParams): string`)
- [x] Implementar gerador de URL do Microsoft Outlook Web (`buildOutlookCalendarUrl(params: CalendarEventParams): string`)
- [x] Implementar gerador de conteúdo iCalendar RFC 5545 (`buildIcsContent(events: CalendarEventParams[]): string`) com escape de caracteres especiais
- [x] Implementar função utilitária de download (`downloadIcsFile(filename: string, events: CalendarEventParams[]): void`) com MIME type `text/calendar;charset=utf-8` para Apple Calendário (iOS / macOS) e arquivos universais
- [x] Criar testes unitários em `apps/web/src/lib/calendar-url-builder.spec.ts` cobrindo mapeamento de escalas, mapeamento de eventos gerais/ministeriais, horários explícitos, duração fallback de 2h, eventos All-Day sem desvio UTC-3, deeplink do Outlook e geração `.ics`
- [x] Critério de validação da etapa: Testes unitários do builder implementados e validados com 100% de cobertura nos cenários descritos.

### Etapa 1 - Extensão de Tipos e Componente Multi-Provedor `AddToCalendarButton`
Status: concluído

- [x] Atualizar interface `MinhaEscalaItem` em `apps/web/src/types/index.ts` para expor formalmente a propriedade `evento` já retornada pela API (`id`, `titulo`, `dataInicio`, `dataFim`, `local`, `status`, `tipo`)
- [x] Criar componente reutilizável `AddToCalendarButton` em `apps/web/src/components/app/add-to-calendar-button.tsx`
  - [x] Suporte multi-provedor com menu popover dropdown acessível (Google Agenda, Apple Calendário e Microsoft Outlook)
  - [x] No Apple Calendário (iOS / Mac), aciona o fluxo nativo iCal que abre a folha nativa do sistema operacional para adicionar o evento à agenda configurada no dispositivo
  - [x] Variantes visuais compactas e responsivas compatíveis com cards de listagem e headers do ODS (`CalendarPlus` do Lucide)
  - [x] Acessibilidade completa (`aria-haspopup`, `role="menu"`, foco por teclado, fechamento com `Escape` ou clique fora)
- [x] Criar modal `CalendarDeepLinkModal` para abertura quando acionado via notificação push ou in-app, oferecendo as 3 opções de provedores de forma intuitiva
- [x] Critério de validação da etapa: Componente tipado sem erros de TypeScript e validado com parâmetros de escala e de evento.

### Etapa 2 - Integração em Escalas (`/minhas-escalas`)
Status: concluído

- [x] Atualizar `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx`
  - [x] Adicionar `AddToCalendarButton` no rodapé de cada card de escala futura ou pendente
  - [x] Adicionar no cabeçalho da seção "Próximas" a ação em lote "Adicionar todas ao Calendário" (`.ics` consolidado `minhas-escalas-oneelo.ics`) quando houver escalas futuras
  - [x] Implementar tratamento do deep-link `?addCalendar=<escalaItemId>` vindo de notificações, abrindo a inclusão da escala no calendário e limpando o parâmetro da URL
  - [x] Exibir aviso amigável pós-recusa lembrando o membro de remover o evento da sua agenda pessoal caso já o tivesse adicionado
- [x] Critério de validação da etapa: Fluxo unitário, download `.ics` em lote e deep-link `?addCalendar=` funcionando em `/minhas-escalas`.

### Etapa 3 - Integração em Eventos para Membros Comuns (`/agenda/visualizacao` e `/personal-panel`)
Status: concluído

- [x] Atualizar `apps/web/src/app/(dashboard)/agenda/visualizacao/page.tsx` (acessível a todos os membros da igreja)
  - [x] Em cada card de evento com `status === 'AGENDADO'`, exibir o botão `AddToCalendarButton` ("Adicionar à Agenda")
  - [x] No cabeçalho da página (ao lado do botão de compartilhar), adicionar botão de ação em lote para baixar o `.ics` dos eventos agendados filtrados (`agenda-eventos-oneelo.ics`)
  - [x] Implementar tratamento do deep-link `?addCalendarEvento=<eventoId>`: buscar o evento na lista (ou via `GET /api/eventos/:id` caso não esteja no filtro da semana corrente), disparar a adição ao calendário e limpar o parâmetro da URL
- [x] Atualizar `apps/web/src/app/(dashboard)/personal-panel/page.tsx`
  - [x] Disponibilizar atalho rápido "Adicionar à Agenda" para a **Próxima Escala** (quando houver)
  - [x] Disponibilizar atalho rápido "Adicionar à Agenda" para o **Próximo Evento** da igreja (visível para todos os membros comuns)
- [x] Critério de validação da etapa: Membro comum (inclusive perfil `BASIC` sem ministério) conseguindo adicionar qualquer evento agendado da igreja individualmente ou em lote em `/agenda/visualizacao` e pelo `/personal-panel`, além do funcionamento do deep-link `?addCalendarEvento=`.

### Etapa 4 - Disparo de Notificação para Evento Específico e Atalhos no Inbox/Push
Status: concluído

- [x] Implementar backend em `apps/api/src/modules/eventos/eventos.service.ts` com método `notificarAgendaEvento(tenantId: string, eventoId: string, user: JwtPayload)`
- [x] Implementar backend em `apps/api/src/modules/eventos/eventos.controller.ts` com rota `POST /api/eventos/:id/notificar-agenda`
- [x] Validar autorização via `canManageEvent` (Admin pode notificar qualquer evento agendado; líder `BASIC` pode notificar eventos dos ministérios que lidera) e garantir que o evento esteja com status `AGENDADO`
- [x] Disparar notificação via `NotificationDispatchService` para o público correspondente ao tipo do evento (`ALL_MEMBERS` para `GERAL`; `MINISTRY` para `MINISTERIO`/`REUNIAO_INTERNA`) com `urlDestino: '/agenda/visualizacao?addCalendarEvento=<eventoId>'`
- [x] Atualizar lembretes automáticos em `apps/api/src/modules/eventos/eventos.service.ts` (`scheduleEventReminder`) para usar `urlDestino: '/agenda/visualizacao?addCalendarEvento=<eventoId>'`
- [x] Atualizar lembretes de escala em `apps/api/src/modules/notifications/notifications.service.ts` para carregar o deep-link `?addCalendar=<escalaItemId>`
- [x] Criar testes unitários em `apps/api/src/modules/eventos/eventos.service.spec.ts` validando o disparo, RBAC e `urlDestino`
- [x] Criar testes unitários em `apps/api/src/modules/eventos/eventos.controller.spec.ts` validando o endpoint de notificação
- [x] Atualizar frontend em `apps/web/src/app/(dashboard)/agenda/page.tsx`: adicionar nos cards de eventos `AGENDADO` (quando `canManage` for verdadeiro) o botão de ação "Notificar / Convidar para Agenda" com modal de confirmação e feedback de sucesso/erro
- [x] Atualizar frontend em `apps/web/src/components/app/notification-bell-inbox.tsx`: identificar notificações com `addCalendar` ou `addCalendarEvento` e renderizar o botão de ação rápida destacado "Adicionar à Agenda"
- [x] Critério de validação da etapa: Testes unitários do backend passando 100%, disparo de notificação de evento específico funcionando em `/agenda` e atalho "Adicionar à Agenda" visível e funcional no `NotificationBellInbox` e via Push.

### Etapa 5 - Validação de Não-Regressão, Teste Mobile/PWA e Build Final
Status: concluído

- [x] Validar download e importação do `.ics` (de escalas e de eventos da igreja) no Google Calendar Desktop e mobile (Android / iOS Safari / PWA)
- [x] Validar responsividade dos novos botões nos cards de `/minhas-escalas`, `/agenda/visualizacao`, `/agenda`, `/personal-panel` e `NotificationBellInbox`
- [x] Executar suíte de testes automatizados no backend (`apps/api`)
- [x] Executar typecheck e build completo do frontend (`npm run build -w apps/web`)
- [x] Executar build de produção do backend (`npm run build -w apps/api`)
- [x] Critério de validação da etapa: Todos os testes e builds de produção (`api` e `web`) passando 100% sem erros de TypeScript ou regressões.

---

## 5. Critérios de Aceite Gerais

- [x] **Escalas e Eventos Unificados:** Voluntários podem adicionar suas escalas e **qualquer membro comum** pode adicionar os eventos da igreja (cultos, conferências, programações) ao Google Agenda com 1 clique ou baixar o pacote `.ics` do período.
- [x] **Disparo de Notificação de Evento Específico:** Administradores e líderes podem disparar uma notificação convidando os membros a adicionarem um evento específico à agenda diretamente pela tela `/agenda`.
- [x] **Atalhos nas Notificações (Push e Inbox In-App):** As notificações de escalas e de eventos trazem o atalho direto "Adicionar à Agenda" no `NotificationBellInbox` e abrem automaticamente o fluxo de adição via deep-link quando acionadas pelo Push Notification.
- [x] **Resolução de Fuso Confiável:** Eventos com horário usam UTC exato e compromissos apenas com data civil são gerados como dia inteiro (All-Day), sem deslocamento indevido para as 21h da véspera no fuso UTC-3.
- [x] **Zero Dependência de OAuth:** Nenhuma permissão invasiva na conta Google pessoal do membro é exigida.
- [x] **Autonomia de Remoção:** Processo de remoção autônomo pelo usuário no seu calendário, acompanhado de avisos amigáveis no portal em caso de recusa ou cancelamento.
- [x] **Aderência ao Design System:** Todos os botões, modais de confirmação e badges seguem estritamente os padrões do OneElo Design System (ODS).
