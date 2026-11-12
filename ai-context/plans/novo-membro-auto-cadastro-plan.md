# Plano - Auto-Cadastro Público de Novos Membros e Visitantes com Triagem Pastoral (FT-018)

Status geral: planejado  
Data de criação: 2026-11-12  
Última atualização: 2026-11-12  
Branch sugerida para implementação: feature/novo-membro-auto-cadastro  

## Planos e Referências Relacionados

- [Backlog FT-018: Formulário Público e Auto-Cadastro](../backlog/novo-membro-auto-cadastro.md)
- [Backlog Geral de Funcionalidades](../backlog/README.md)
- [Plano de Importação de Membros via Planilha](importacao-membros-planilha-plan.md)
- [Plano de Ativação e Onboarding de Usuários](new-user-creation-and-onboarding-workflow.md)
- [Plano de Limites do Tenant e Quota de Membros](tenant-plan-limits-plan.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)

---

## 1. Objetivo da Entrega

Modernizar a recepção dominical das igrejas através de uma página pública responsiva e *mobile-first* (`/join/[slug]`), acessível por QR Code e link institucional configurados centralizadamente no painel de **Configurações da Igreja** (`/configuracoes`), permitindo que visitantes e novos membros realizem seu auto-cadastro pelo próprio smartphone, com triagem pastoral pela secretaria em `/membros` e governança completa do slug da igreja no painel administrativo.

A entrega contempla:
1. **Governança de Slug do Tenant no Super Admin:** Validação estrita do slug (kebab-case minúsculo) tanto na criação quanto na **edição** de tenants no painel Super Admin (`apps/web/src/app/(admin)/admin/page.tsx`), garantindo URLs públicas previsíveis e sem caracteres especiais.
2. **Central de Divulgação em Configurações da Igreja (`/configuracoes`):** Seção institucional dedicada para administradores visualizarem o link oficial da igreja (`https://oneelo.vercel.app/join/[slug]`), copiarem o endereço com 1 clique e gerarem/baixarem o **QR Code em alta resolução (PNG)** para projeção no telão do culto, totens e folhetos dominicais.
3. **Página Pública de Boas-Vindas (`/join/[slug]`):** Identidade visual da igreja (logo e nome) com alternância entre:
   - **Aba "Sou Visitante":** Formulário leve para acolhimento pastoral (Nome, WhatsApp, Data de Nascimento, E-mail opcional e observações). Sem criação de usuário e sem consumir quota do plano.
   - **Aba "Quero ser Membro":** Ficha eclesiástica completa (Nome, WhatsApp, E-mail obrigatório com helper *"Necessário para acessar o sistema da igreja"*, CPF opcional, Data de Nascimento, Sexo, Estado Civil, dados pastorais e consentimento LGPD).
4. **Fila de Triagem Pastoral (`/membros`):** Aba administrativa de operação diária (ADMIN e STAFF) com badge numérico de pendências, verificação de duplicidade reutilizando as regras canônicas do `MemberImportService` e visualização responsiva (tabela no desktop, cards no mobile).
5. **Fluxo Específico "Visitante que vira Membro":** Opção explícita de **"Vincular ao Cadastro Existente"** na triagem, promovendo o status de `VISITANTE` para `ATIVO` sem gerar duplicidade de cadastro.
6. **Efetivação Atômica com Criação de Acesso:**
   - Visitante aprovado → `Membro` com `status = VISITANTE`, sem conta `User` e sem consumir quota do plano.
   - Membro aprovado (novo ou vinculado) → `Membro` com `status = ATIVO` **e conta `User`** (`role = BASIC`, `status = PENDING`) com token de ativação de 72h. Se o membro não criar a senha de imediato, a conta permanece `PENDING` indefinidamente (o link pode ser regenerado pelo fluxo já existente).
   - Dados complementares da ficha (`igrejaAnterior`, `quemConvidou`, `batizadoAguas`) são concatenados de forma padronizada nas `observacoes` do membro.
7. **Acolhimento no WhatsApp:** Modal pós-aprovação com a mensagem oficial de boas-vindas (reaproveitando `buildActivationWelcomeMessage`) e envio direto no WhatsApp (app no celular, WhatsApp Web no desktop).

---

## 2. Contexto e Diagnóstico

1. **Separação de Responsabilidades (Institucional vs. Operacional):**
   - O link público e o QR Code são ativos institucionais permanentes da igreja. Sua governança pertence à tela de **Configurações da Igreja (`/configuracoes`)**, ao lado da Logo e da Identidade Visual.
   - A tela de **Membros (`/membros`)** é de operação diária e deve focar na listagem de membros e na aba de moderação das fichas recebidas pela secretaria.
2. **Governança e Edição do Slug de Tenant:**
   - No backend, `CreateTenantDto` valida `slug` via `@Matches(/^[a-z0-9-]+$/)`.
   - Porém, `UpdateTenantDto` (`apps/api/src/modules/super-admin/dto/update-tenant.dto.ts`) **não possui o campo `slug`**, e a tela de edição do Super Admin (`EditTenantModal` em `apps/web/src/app/(admin)/admin/page.tsx`) não permite alterar ou corrigir o slug de igrejas cadastradas (inclusive corrigindo casos legados como o tenant piloto `"Resgatando Vidas"` para `"resgatando-vidas"`).
3. **Reaproveitamento das Normalizações e Motor de Duplicidade:**
   - O serviço `MemberImportService` (`apps/api/src/modules/membros/import/member-import.service.ts`) possui regras consolidadas e testadas:
     - `normalizePhone`: extração de dígitos, suporte a zero no DDD (`011...`), prefixo internacional `+55` e tratamento de tipos numéricos.
     - `normalizeCpf`: sanitização e recomposição do zero à esquerda (10 dígitos).
     - `normalizeName`: minúsculas, remoção de acentos NFD e espaços extras.
     - Detecção de duplicidade por documentos (CPF), contatos (E-mail, WhatsApp) e por **Nome Completo Exato**.
   - Essas regras serão compartilhadas através de helper dedicado, assegurando consistência entre importação e triagem de auto-cadastro.
4. **Cenário Crucial: Visitante que vira Membro:**
   - É o fluxo mais comum nas igrejas: a pessoa visita no primeiro domingo (cadastrada como `VISITANTE`), frequenta por semanas e depois envia a ficha de "Novo Membro".
   - O sistema deve reconhecer o visitante pré-existente e oferecer a ação "Vincular ao Cadastro Existente", evitando duplicidade e preservando o histórico.
5. **Limite de membros e Quota (`tenant-plan.ts`):** Apenas membros com status `ATIVO` contam contra a quota do plano da igreja. Promover um visitante para membro ativo valida a quota via `canAddMember`.
6. **Permissões de Criação de Acesso:** O STAFF passa a poder criar contas `User` exclusivamente através da aprovação de fichas de novos membros, sempre com `role = BASIC` e `status = PENDING`.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Governança de Slug no Super Admin
- Atualizar `UpdateTenantDto`: adicionar `slug?: string` com `@Matches(/^[a-z0-9-]+$/)`.
- Atualizar `SuperAdminService.updateTenant`: se o slug for alterado, checar unicidade no banco (`findUnique`) e lançar `ConflictException('Slug já está em uso.')` caso pertença a outro tenant.
- Atualizar `EditTenantModal` em `apps/web/src/app/(admin)/admin/page.tsx`: incluir o campo editável "Slug (URL)" com helper visual e validação de formato.

### 3.2. Central de Divulgação em Configurações do Tenant (`/configuracoes`)
- Criar o componente `JoinLinkCard` em `apps/web/src/components/app/join-link-card.tsx` e integrá-lo em `apps/web/src/app/(dashboard)/configuracoes/page.tsx`:
  - Exibe a URL pública gerada com base no slug do tenant.
  - Botão de copiar link com feedback visual.
  - Botão de abrir modal com prévia ampliada do QR Code e download em PNG (usando a biblioteca `qrcode` já instalada).
  - Orientações pastorais de uso (projeção no telão dominical, totens da recepção e folhetos).

### 3.3. Modelo de Dados (Prisma)
- Novo modelo `SolicitacaoCadastroMembro` → tabela `tb_member_registration_request`:
  - `id` (uuid), `tenantId` (FK `tb_tenant`, `onDelete: Cascade`).
  - `tipo`: enum `TipoSolicitacaoCadastro` (`VISITANTE` | `MEMBRO`) → `@@map("member_registration_type")`.
  - `status`: enum `StatusSolicitacaoCadastro` (`PENDENTE` | `APROVADO` | `REJEITADO`) → `@@map("member_registration_status")`.
  - Postulante: `nome`, `telefone` (E.164), `cpf` (opcional, apenas dígitos no banco), `email` (obrigatório para `MEMBRO`, opcional para `VISITANTE`), `dataNascimento`, `sexo` (`SexoMembro?`), `estadoCivil` (`EstadoCivil?`), `batizadoAguas` (`Boolean?`), `igrejaAnterior`, `quemConvidou`, `observacoes`.
  - LGPD: `consentimentoEm` (DateTime obrigatório), `ipAddress` (opcional).
  - Controle: `membroId` (criado ou vinculado), `userId` (conta criada), `rejectionReason`, `processedAt`, `processedByUserId`, `createdAt`, `updatedAt`.
  - Índices: `@@index([tenantId, status])`, `@@index([tenantId, telefone])`, `@@index([tenantId, cpf])`, `@@index([tenantId, email])`.

### 3.4. Motor de Duplicidade (Reaproveitamento de `MemberImportService`)
- Criar helper unificado `apps/api/src/modules/membros/member-deduplication.helper.ts` baseado na lógica de `MemberImportService`:
  - `cleanPhone(phone)`: extrai apenas dígitos, trata zero no DDD (`011...`) e DDI `+55`.
  - `cleanCpf(cpf)`: extrai dígitos e recompõe zero à esquerda se tiver 10 dígitos.
  - `normalizeEmail(email)`: minúsculo e sem espaços.
  - `normalizeName(nome)`: NFD sem diacríticos e minúsculo.
  - A consulta na triagem mapeia membros existentes (`ATIVO`, `VISITANTE`, `INATIVO`) e outras fichas `PENDENTE`, retornando:
    - `membroExistenteId`: ID do membro coincidente.
    - `membroExistenteNome`: Nome cadastrado.
    - `membroExistenteStatus`: Status atual (`VISITANTE`, `ATIVO`, `INATIVO`).
    - `motivoDuplicidade`: `'TELEFONE'` | `'CPF'` | `'EMAIL'` | `'NOME_EXATO'` | `'FICHA_PENDENTE'`.
  - **Login com Google preservado:** A autenticação social com Google vincula contas de forma independente através da tabela `tb_user_auth_provider` (`providerUserId` do Google), continuando 100% operacional sem qualquer quebra.

### 3.5. Fluxo de Aprovação: Novo Membro vs. Vincular Visitante
Na transação atômica (`prisma.$transaction`):
1. **Se for Visitante:** cria `Membro` (`status = VISITANTE`). Sem criar `User`. Sem validar quota de membros.
2. **Se for Novo Membro (sem vínculo prévio):**
   - Valida quota via `canAddMember(tenant, totalAtivos)`.
   - Verifica conflito de `User.email` global e `User.telefoneLogin`.
   - Cria `Membro` (`status = ATIVO`, `whatsapp` normalizado).
   - Formata dados adicionais (`igrejaAnterior`, `quemConvidou`, `batizadoAguas`) e salva em `Membro.observacoes`.
   - Cria `User` (`role = BASIC`, `status = PENDING`) com token de ativação de 72h.
3. **Se for Vincular a Visitante Existente (`vincularMembroId`):**
   - Valida que o membro pertence ao tenant e não possui `User` vinculado.
   - Valida quota via `canAddMember` (pois `VISITANTE` passa a ser `ATIVO`).
   - Atualiza `Membro`: `status = ATIVO`, preenche campos vazios com os dados informados na ficha e anexa o bloco formatado em `observacoes` preservando o conteúdo anterior:
     ```
     [Auto-cadastro em DD/MM/AAAA]
     Igreja anterior: <valor>
     Convidado por: <valor>
     Batizado nas águas: Sim | Não
     Observações: <texto da ficha>
     ```
   - Cria `User` (`role = BASIC`, `status = PENDING`) com token de ativação de 72h.
4. Em ambos os casos de membro: marca a ficha como `APROVADO` e retorna `{ membro, user, activationLink }` para disparo imediato do WhatsApp.

### 3.6. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Bloqueio por rate-limit no Wi-Fi da igreja (mesmo IP) | Alta | Alto | Limite de 30/min por IP + idempotência por `tenantId + telefone` + honeypot invisível. |
| Cadastros duplicados (visitante virando membro) | Alta | Médio | Detecção pelo motor do `MemberImportService` e ação explícita "Vincular ao Cadastro Existente". |
| Conflito de `User.email` global | Média | Médio | Validação prévia na aprovação com mensagem amigável antes de falhar a transação. |
| Ultrapassagem da quota do plano | Baixa | Alto | `canAddMember` executado dentro da transação atômica (tanto para novo membro quanto para visitante promovido a ativo). |
| Slug de tenant com formato inválido ou colisão | Baixa | Médio | Validação regex `@Matches(/^[a-z0-9-]+$/)` em criação e edição, com checagem de unicidade. |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Governança de Slug de Tenant e Schema Prisma
Status: planejado

- [ ] Atualizar DTO de atualização de tenant (`apps/api/src/modules/super-admin/dto/update-tenant.dto.ts`):
  - [ ] Adicionar campo opcional `slug?: string` com validação `@Matches(/^[a-z0-9-]+$/)`
- [ ] Atualizar serviço do Super Admin (`apps/api/src/modules/super-admin/super-admin.service.ts`):
  - [ ] Validar unicidade do novo slug em `updateTenant` lançando `ConflictException` se já em uso por outro tenant
  - [ ] Persistir alteração do slug no banco e registrar no audit log
- [ ] Atualizar modal de edição de tenant no frontend (`apps/web/src/app/(admin)/admin/page.tsx`):
  - [ ] Incluir campo "Slug (URL)" no `EditTenantModal` com validação de formato e placeholder
- [ ] Atualizar schema Prisma (`apps/api/prisma/schema.prisma`):
  - [ ] Declarar enum `TipoSolicitacaoCadastro` (`VISITANTE`, `MEMBRO`) com `@@map("member_registration_type")`
  - [ ] Declarar enum `StatusSolicitacaoCadastro` (`PENDENTE`, `APROVADO`, `REJEITADO`) com `@@map("member_registration_status")`
  - [ ] Criar modelo `SolicitacaoCadastroMembro` mapeado para `tb_member_registration_request` com campos LGPD e índices
  - [ ] Adicionar relação reversa no modelo `Tenant`
- [ ] Executar migração do Prisma (`npx prisma migrate dev --name member_registration_request_and_slug`):
  - [ ] Validar integridade da migração gerada e compilação do client (`npx prisma generate`)
- [ ] Critério de validação da etapa: Testes do Super Admin passando, edição de slug funcionando na API e tabela criada no banco de dados.

### Etapa 1 - Endpoints Públicos de Submissão e Consulta (Backend)
Status: planejado

- [ ] Criar DTO de submissão (`apps/api/src/modules/membros/dto/submit-member-registration.dto.ts`):
  - [ ] Validações `class-validator` para tipo, nome, telefone, cpf (opcional, 11 dígitos), email (obrigatório se tipo `MEMBRO`, opcional se `VISITANTE`), consentimento LGPD e honeypot
  - [ ] Normalização de telefone celular no padrão E.164 e higienização de CPF (somente dígitos com recomposição de zero)
- [ ] Criar serviço público (`apps/api/src/modules/membros/solicitacoes-cadastro.service.ts`):
  - [ ] Método `getPublicTenantInfo(slug)` retornando nome, slug e logoUrl (404 se inativo/inexistente)
  - [ ] Método `submitRegistration(slug, dto, ip)` com descarte silencioso de honeypot e idempotência por telefone pendente
  - [ ] Disparo de notificação in-app para administradores e staff do tenant via `NotificationsService` com link `/membros?tab=fichas`
- [ ] Criar controller público (`apps/api/src/modules/membros/public-solicitacoes.controller.ts`):
  - [ ] Anotação `@Public()` e `@UseGuards(ThrottlerGuard)`
  - [ ] Endpoint `GET /api/public/tenants/:slug`
  - [ ] Endpoint `POST /api/public/tenants/:slug/members/submit` com `@Throttle({ default: { limit: 30, ttl: 60000 } })`
- [ ] Registrar componentes no módulo `apps/api/src/modules/membros/membros.module.ts`
- [ ] Criar testes unitários em `apps/api/src/modules/membros/solicitacoes-cadastro.service.spec.ts`:
  - [ ] Submissão de visitante com sucesso (sem e-mail)
  - [ ] Submissão de membro com e-mail obrigatório e CPF opcional
  - [ ] Rejeição de membro sem e-mail com mensagem de validação
  - [ ] Honeypot ignorado silenciosamente
  - [ ] Idempotência por telefone atualizando ficha pendente
  - [ ] Disparo de notificação para administradores do tenant
- [ ] Critério de validação da etapa: Testes do serviço de submissão pública passando 100%.

### Etapa 2 - Motor de Duplicidade, Triagem e Aprovação com Vínculo (Backend)
Status: planejado

- [ ] Criar helper de duplicidade `apps/api/src/modules/membros/member-deduplication.helper.ts`:
  - [ ] Reutilizar as funções canônicas de `MemberImportService` (`normalizePhone`, `normalizeCpf`, `normalizeName`)
  - [ ] Implementar detecção de duplicidade por telefone limpo, CPF, e-mail e nome completo exato
- [ ] Refatorar `apps/api/src/modules/auth/auth.service.ts`:
  - [ ] Extrair método `createPendingBasicUserInTx(tx, params)` para uso transacional
  - [ ] Garantir compatibilidade total do método existente `createUser` sem regressões
- [ ] Implementar métodos administrativos em `solicitacoes-cadastro.service.ts`:
  - [ ] `listSolicitacoes(tenantId, status)` com dados de duplicidade enriquecidos (indicando se membro existente é `VISITANTE`)
  - [ ] `countPendentes(tenantId)`
  - [ ] `aprovarSolicitacao(tenantId, id, actor, { vincularMembroId? }, ip)`:
    - [ ] Fluxo Visitante: cria `Membro` `VISITANTE` sem usuário
    - [ ] Fluxo Novo Membro: valida quota, valida unicidade de e-mail/telefone, cria `Membro` `ATIVO` e `User` `BASIC`/`PENDING`
    - [ ] Fluxo Vincular Visitante: valida membro, valida quota, promove `VISITANTE` para `ATIVO`, atualiza campos vazios, anexa observações e cria `User` `BASIC`/`PENDING`
    - [ ] Concatenação formatada em `observacoes`
    - [ ] Atualização da ficha para `APROVADO` e gravação de logs de auditoria
  - [ ] `rejeitarSolicitacao(tenantId, id, actor, motivo?)`
- [ ] Criar controller administrativo (`apps/api/src/modules/membros/solicitacoes-cadastro.controller.ts`):
  - [ ] Proteção `@Roles(Role.ADMIN, Role.STAFF)`
  - [ ] Endpoints `GET /api/membros/solicitacoes`, `GET /api/membros/solicitacoes/count`, `POST /api/membros/solicitacoes/:id/aprovar`, `POST /api/membros/solicitacoes/:id/rejeitar`
- [ ] Criar testes unitários em `apps/api/src/modules/membros/solicitacoes-triagem.service.spec.ts`:
  - [ ] Detecção de visitante existente por telefone limpo e por nome
  - [ ] Aprovação com vínculo promovendo visitante para ativo e gerando usuário
  - [ ] Bloqueio por limite de membros na promoção de visitante
  - [ ] Aprovação por usuário com perfil STAFF
  - [ ] Concatenação correta em `observacoes`
- [ ] Critério de validação da etapa: Testes unitários de triagem, duplicidade e aprovação atômica passando 100%.

### Etapa 3 - Página Pública Mobile-First e Divulgação em Configurações (Frontend)
Status: planejado

- [ ] Liberar rota pública em `apps/web/src/middleware.ts`:
  - [ ] Adicionar `/join` à lista `PUBLIC_PATHS`
- [ ] Criar layout e página pública (`apps/web/src/app/(public)/join/[slug]/`):
  - [ ] Layout neutro respeitando identidade visual da igreja (nome e logo)
  - [ ] Alternância rápida "Sou Visitante" (e-mail opcional) / "Quero ser Membro" (e-mail obrigatório com helper: *"Necessário para acessar o sistema da igreja"*)
  - [ ] Reuso do componente `InternationalPhoneInput`, máscara de CPF `000.000.000-00` e input de data `00/00/0000`
  - [ ] Checkbox de consentimento LGPD obrigatório
  - [ ] Campo armadilha invisível honeypot
  - [ ] Feedback acolhedor de confirmação após envio
- [ ] Adicionar traduções nos arquivos de locale em `apps/web/messages/`
- [ ] Criar card de divulgação e QR Code em `apps/web/src/components/app/join-link-card.tsx`:
  - [ ] Exibição da URL oficial `/join/[slug]`
  - [ ] Botão de copiar link com toast de confirmação
  - [ ] Modal com renderização do QR Code em alta resolução via biblioteca `qrcode` e botão de download PNG
- [ ] Integrar `JoinLinkCard` na página de Configurações da Igreja (`apps/web/src/app/(dashboard)/configuracoes/page.tsx`):
  - [ ] Inserir a seção institucional logo após a configuração de logo e PWA
- [ ] Critério de validação da etapa: Formulário `/join/[slug]` testado em mobile/desktop sem login e card com QR Code funcionando em `/configuracoes`.

### Etapa 4 - Tela de Triagem com Ação de Vínculo e Boas-Vindas no WhatsApp (Frontend)
Status: planejado

- [ ] Extrair helper de mensagem de boas-vindas (`apps/web/src/lib/activation-message.ts`):
  - [ ] Migrar `buildActivationWelcomeMessage` e `formatActivationExpiration`
  - [ ] Atualizar importações em `apps/web/src/app/(dashboard)/configuracoes/page.tsx`
- [ ] Criar modal de envio no WhatsApp (`apps/web/src/components/app/welcome-activation-modal.tsx`):
  - [ ] Mensagem pré-formatada com link de ativação de 72h
  - [ ] Botão de abertura direta do WhatsApp (`wa.me`) e botão de copiar
- [ ] Criar componente de triagem (`apps/web/src/components/app/solicitacoes-triagem-tab.tsx`):
  - [ ] Visão desktop (`DataTable`) e visão mobile (`EntityCard`)
  - [ ] Exibição de alertas de duplicidade com destaque para visitante pré-existente
  - [ ] Botão de ação "Vincular ao Cadastro Existente"
  - [ ] Confirmação de rejeição com motivo opcional
  - [ ] Abertura imediata do modal de WhatsApp ao aprovar membro
- [ ] Atualizar página de membros (`apps/web/src/app/(dashboard)/membros/page.tsx`):
  - [ ] Abas "Membros Cadastrados" e "Fichas Recebidas" com badge numérico de pendências
  - [ ] Suporte a query param `?tab=fichas` vindo de notificações
- [ ] Critério de validação da etapa: Triagem completa operando na aba de membros, aprovando novos e vinculando visitantes existentes com abertura do modal de WhatsApp.

### Etapa 5 - Validação Integrada, Documentação e Build Final
Status: planejado

- [ ] Executar bateria de testes automatizados do backend (`npm run test -w apps/api`)
- [ ] Executar typecheck e linting (`npm run lint -w apps/api` e `npm run lint -w apps/web`)
- [ ] Validar build de produção (`npm run build -w apps/api` e `npm run build -w apps/web`)
- [ ] Validação visual integrada de fluxos:
  - [ ] Edição do slug do tenant no Super Admin e acesso imediato na nova URL pública
  - [ ] Acesso à tela de `/configuracoes`, cópia do link institucional e download do QR Code
  - [ ] Cadastro de visitante via smartphone e aprovação na triagem
  - [ ] Envio posterior de ficha de membro pelo mesmo visitante, detecção de duplicidade e aprovação via "Vincular"
  - [ ] Ativação da conta pelo link de 72h e conferência dos dados no sistema
- [ ] Atualizar backlog e índices de documentação:
  - [ ] `ai-context/backlog/novo-membro-auto-cadastro.md`
  - [ ] `ai-context/backlog/README.md`
  - [ ] `ai-context/plans/README.md`
- [ ] Critério de validação da etapa: Builds passando com código 0 e todos os fluxos operacionais aprovados.

---

## 5. Critérios de Aceite Gerais

- [ ] O slug da igreja pode ser editado pelo Super Admin na tela de edição de tenants, com validação estrita de formato e unicidade.
- [ ] O link público e o QR Code em alta resolução estão disponíveis centralizadamente em `/configuracoes` para download e cópia pela liderança.
- [ ] O visitante ou novo membro consegue preencher e enviar sua ficha pelo smartphone através de `/join/[slug]` sem necessidade de login.
- [ ] A ficha de "Visitante" possui e-mail opcional; a ficha de "Quero ser Membro" possui e-mail obrigatório com helper: *"Necessário para acessar o sistema da igreja"*.
- [ ] A página pública adapta-se a dispositivos móveis e desktops, com consentimento LGPD, teclado semântico e seletor telefônico internacional.
- [ ] Rate-limit de 30/min por IP, idempotência por telefone e honeypot silencioso impedem abusos sem prejudicar a congregação no mesmo Wi-Fi.
- [ ] O motor de duplicidade reutiliza as normalizações canônicas de `MemberImportService` (telefone com/sem DDD e zero, CPF com zero recomposto, e-mail limpo e nome normalizado).
- [ ] A liderança (ADMIN e STAFF) visualiza fichas pendentes com badge numérico em `/membros` com suporte a desktop e mobile.
- [ ] Fichas de membros que já constam como visitantes possuem a opção clara de "Vincular ao Cadastro Existente", promovendo o cadastro de `VISITANTE` para `ATIVO` sem duplicar registros.
- [ ] Visitantes aprovados são cadastrados como `VISITANTE`, sem criação de usuário e sem consumir quota do plano.
- [ ] Todo membro aprovado (novo ou vinculado) recebe conta de usuário com role `BASIC`, status `PENDING` e link de ativação válido por 72h; a conta permanece `PENDING` indefinidamente caso a senha não seja criada de imediato.
- [ ] Igreja anterior, quem convidou e batismo são concatenados e persistidos de forma padronizada em `Membro.observacoes`.
- [ ] O modal pós-aprovação permite envio com 1 toque no WhatsApp e cópia do texto oficial de acolhimento.
- [ ] Nenhum erro de TypeScript ou quebra de build é introduzido no sistema.
