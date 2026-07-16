# Plano - Login social com OAuth

Status geral: concluido - validacao tecnica final aprovada
Ultima atualizacao: 2026-07-14

Backlog de origem: `ai-context/backlog/social-oauth-login.md`

## Objetivo

Criar uma base de login social/OAuth para o OneElo, com Google como primeiro provedor funcional e Apple considerado no desenho desde o inicio.

Ao final da primeira entrega, o sistema deve permitir que um usuario interno existente entre com Google sem perder:

- o mesmo `User`;
- o mesmo `tenantId`;
- as mesmas regras de RBAC;
- o mesmo modelo de sessao por JWT em cookie HTTP-only;
- a possibilidade futura de adicionar Apple ou outros provedores sem remodelar a base.

## Resultado esperado ao final do plano

- Usuario interno existente pode vincular uma conta Google no primeiro login social, com confirmacao explicita antes de gravar o vinculo.
- Usuario com vinculo ativo pode fazer login pelo Google.
- Login social emite o mesmo cookie `access_token` usado pelo login por senha.
- Usuario pode desvincular Google, desde que ainda tenha uma forma valida de acesso.
- Backend registra auditoria de login social.
- O modelo de dados suporta Apple como proximo provedor sem nova remodelagem estrutural.
- A tela de login mostra a opcao de login com Google de forma segura e coerente com o fluxo atual.
- Permissoes de Google Agenda ficam fora do login social e preparadas para uma integracao futura separada.

## Estado atual do codigo

Ja existe:

- `POST /auth/login` com e-mail/senha.
- JWT em cookie HTTP-only `access_token`.
- `User.email` unico global.
- `User.tenantId` opcional para suportar `SUPER_ADMIN`, mas login tenant bloqueia `SUPER_ADMIN`.
- `AuthService.login()` validando usuario ativo, tenant ativo e senha.
- `AuthController.login()` aplicando rate limit e cookie de sessao.
- `GET /auth/me` como fonte do usuario autenticado.
- Tela `/login` com redirect seguro por role.
- Auditoria para `LOGIN` e `LOGOUT`.

Ainda nao existe:

- tabela de identidade externa/social login;
- endpoints de inicio/callback OAuth;
- fluxo de primeiro login social com confirmacao de vinculacao;
- fluxo de consulta/desvinculacao;
- configuracao OAuth do Google;
- tratamento de `state`/CSRF para OAuth;
- contrato para Apple.

## Decisoes fechadas

### 1. Modelo deve ser generico, nao acoplado ao Google

Google sera a primeira implementacao funcional, mas a tabela e os servicos devem nascer com `provider`.

### 2. Vinculo pertence ao `User`

Autenticacao e login pertencem ao `User`, nao ao `Membro`.

`Membro` continua sendo a pessoa da igreja e pode seguir vinculado a `User` pelo modelo atual.

### 3. Login social nao cria usuario automaticamente no MVP

O OneElo e multi-tenant e o usuario operacional deve continuar sendo criado/gerido pela administracao do tenant.

Regra do MVP:

- se houver vinculo `provider + providerUserId`, autenticar o usuario interno correspondente;
- se nao houver vinculo, mas o e-mail verificado corresponder a um `User` interno unico e ativo, iniciar fluxo controlado de primeiro vinculo com confirmacao explicita do usuario;
- se nao houver usuario interno correspondente, se houver ambiguidade ou se o e-mail nao for verificado, bloquear com mensagem amigavel;
- nao criar `User` automaticamente a partir de uma conta Google/Apple.

### 4. Emitir a mesma sessao atual

O callback OAuth deve emitir o mesmo JWT/cookie HTTP-only usado pelo login com senha.

### 5. Apple deve caber no modelo desde o inicio

Mesmo fora da primeira entrega funcional, o desenho deve suportar:

- `provider = APPLE`;
- identificador estavel por `sub`;
- e-mail possivelmente disponivel apenas no primeiro login;
- e-mail privado relay;
- client secret JWT assinado.

### 6. Google Agenda deve ser uma integracao separada

Login com Google e permissao para Google Agenda nao devem ser misturados.

Na primeira entrega de login social, os escopos devem ficar restritos a identidade basica, como `openid`, `email` e `profile`.

Permissoes de Google Agenda devem ser solicitadas futuramente por autorizacao incremental, no contexto da funcionalidade de calendario, e nao durante o login.

Motivo:

- evita consentimento invasivo no login;
- reduz risco de rejeicao/verificacao desnecessaria do OAuth app;
- permite explicar ao usuario por que o OneElo precisa criar eventos no calendario;
- separa autenticacao de integracoes operacionais.

## Escopo

Incluido:

- modelagem Prisma para provedores externos;
- migration da tabela de identidades externas;
- configuracao de ambiente para OAuth Google;
- modulo/service backend para OAuth/social login;
- endpoints de iniciar login Google e receber callback;
- fluxo de confirmacao de primeiro login para vincular Google a usuario interno existente;
- fluxo de consultar/desvincular Google no usuario autenticado;
- botao de login com Google na tela `/login`;
- area de provedores conectados em `/meu-perfil` ou `/configuracoes`, com acao de desvincular e, se mantido como caminho secundario, vincular manualmente;
- auditoria basica do login social;
- documentacao de validacao manual.

Fora do escopo inicial:

- login funcional com Apple;
- Google Calendar/Google Agenda funcional ou escopos de calendario no login social;
- sincronizacao de foto, contatos ou agenda;
- criacao automatica de usuarios sem convite/cadastro interno;
- multiplas contas do mesmo provedor no mesmo usuario;
- substituir login com senha.

## Plano de execucao

### Etapa 0 - Alinhamento e backlog

Status: concluida

- [X] Renomear o backlog para refletir login social/OAuth, nao apenas Google.
- [X] Registrar Google como primeiro provedor.
- [X] Registrar Apple como provedor futuro considerado no desenho.
- [X] Registrar decisao de vinculo com `User`.
- [X] Registrar que login social nao deve criar usuario automaticamente no MVP.
- [X] Registrar que Google Agenda sera integracao separada com consentimento incremental futuro.

Resultado:

- Backlog atualizado em `ai-context/backlog/social-oauth-login.md`.

### Etapa 1 - Contrato tecnico e modelagem

Status: concluida

- [X] Definir nome final do modelo Prisma: `UserAuthProvider`.
- [X] Definir enum de provider com valores iniciais `GOOGLE` e `APPLE`.
- [X] Definir campos obrigatorios e opcionais.
- [X] Definir se tokens serao armazenados nesta entrega.
- [X] Definir politica de criptografia se tokens forem armazenados.
- [X] Confirmar que os escopos do login social ficam restritos a identidade basica.
- [X] Definir a fronteira entre identidade social e futura integracao de calendario.
- [X] Registrar modelo futuro separado para permissao de Google Agenda: `UserIntegrationCredential`.
- [X] Definir indices unicos:
  - [X] `provider + providerUserId`;
  - [X] `userId + provider`.
- [X] Definir comportamento quando usuario tenta vincular Google ja vinculado a outro `User`.
- [X] Definir que e-mail verificado pode iniciar o primeiro vinculo controlado, sem exigir login previo com senha.

Contrato fechado:

#### Modelo Prisma principal

Nome do modelo: `UserAuthProvider`.

Mapa sugerido no banco: `tb_user_auth_provider`.

Enum sugerido: `AuthProvider`.

Valores iniciais:

- `GOOGLE`;
- `APPLE`.

Campos:

- `id`: `String @id @default(uuid())`;
- `userId`: `String @map("user_id")`;
- `provider`: `AuthProvider`;
- `providerUserId`: `String @map("provider_user_id")`;
- `email`: `String?`;
- `emailVerified`: `Boolean @default(false) @map("email_verified")`;
- `displayName`: `String? @map("display_name")`;
- `avatarUrl`: `String? @map("avatar_url")`;
- `ativo`: `Boolean @default(true) @map("is_active")`;
- `linkedAt`: `DateTime @default(now()) @map("linked_at")`;
- `lastLoginAt`: `DateTime? @map("last_login_at")`;
- `revokedAt`: `DateTime? @map("revoked_at")`;
- `createdAt`: `DateTime @default(now()) @map("created_at")`;
- `updatedAt`: `DateTime @updatedAt @map("updated_at")`.

Relacao:

- `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`.

Indices e restricoes:

- `@@unique([provider, providerUserId])`;
- `@@unique([userId, provider])`;
- `@@index([userId])`;
- `@@index([email])`;
- `@@map("tb_user_auth_provider")`.

Tambem sera necessario adicionar `authProviders UserAuthProvider[]` em `User`.

#### Tokens nesta entrega

Tokens OAuth de Google nao serao armazenados na entrega de login social.

Uso permitido nesta entrega:

- trocar `code` por tokens durante o callback;
- validar identidade/perfil;
- descartar `access_token`, `refresh_token` e `id_token` apos resolver o usuario interno.

Motivo:

- login social precisa apenas comprovar identidade;
- armazenar refresh token sem necessidade aumenta risco e escopo de seguranca;
- Google Agenda sera uma integracao separada no futuro.

Consequencia:

- nao ha criptografia de tokens nesta entrega porque nenhum token OAuth persistente sera armazenado;
- se no futuro for necessario armazenar tokens, isso deve ocorrer em tabela separada de integracoes, com criptografia.

#### Escopos de login social

Escopos permitidos para login social:

- `openid`;
- `email`;
- `profile`.

Escopos proibidos nesta entrega:

- qualquer escopo de Google Calendar/Google Agenda;
- qualquer escopo que autorize Drive, Gmail, contatos ou dados nao necessarios ao login.

#### Fronteira com Google Agenda

Google Agenda sera uma integracao operacional separada do login social.

Modelo futuro recomendado: `UserIntegrationCredential`.

Campos futuros previstos:

- `id`;
- `userId`;
- `provider`;
- `integrationType`, com valor futuro como `GOOGLE_CALENDAR`;
- `scopes`;
- `accessTokenEncrypted`;
- `refreshTokenEncrypted`;
- `accessTokenExpiresAt`;
- `revokedAt`;
- `lastSyncedAt`;
- `createdAt`;
- `updatedAt`.

Esse modelo futuro deve ser usado apenas quando o usuario ativar a integracao de calendario, com consentimento incremental contextual.

#### Regra de vinculacao e login

Primeiro login social sem vinculo:

- pressupoe que o administrador ja criou o `User` interno no tenant, mesmo que com senha padrao;
- o usuario nao precisa usar a senha padrao antes para conseguir iniciar o primeiro vinculo pelo Google;
- se nao existir `UserAuthProvider` ativo para `provider + providerUserId`, validar o perfil retornado pelo provedor;
- se o e-mail for verificado e corresponder a um `User` interno unico, ativo e permitido pelas regras atuais do OneElo, iniciar uma confirmacao explicita de vinculacao;
- a confirmacao deve deixar claro qual conta Google/Apple sera vinculada e qual usuario/e-mail OneElo sera usado;
- antes da confirmacao, nao emitir sessao final do OneElo;
- apos a confirmacao, criar `UserAuthProvider`, registrar auditoria e emitir o mesmo JWT/cookie HTTP-only do login atual;
- se o usuario cancelar, expirar a confirmacao ou abandonar o fluxo, nao criar vinculo;
- se nao existir usuario interno correspondente, se houver ambiguidade, se o usuario estiver inativo, se o tenant estiver inativo ou se o e-mail nao for verificado, bloquear com mensagem amigavel;
- nao criar `User` automaticamente a partir de uma conta Google/Apple.

Login social com vinculo existente:

- se existir `UserAuthProvider` ativo para `provider + providerUserId`, autenticar o `User` interno relacionado;
- se o vinculo existir, mas `User.ativo = false`, bloquear;
- se o vinculo existir, mas `Tenant.ativo = false`, bloquear;
- se o usuario for `SUPER_ADMIN`, manter fora do login social tenant nesta entrega, salvo decisao futura explicita.

Confirmacao pendente de primeiro vinculo:

- deve ser curta e de uso unico;
- deve armazenar apenas os dados minimos para confirmar a intencao do usuario, como `provider`, `providerUserId`, e-mail verificado e `userId` interno resolvido;
- nao deve persistir tokens OAuth do provedor;
- pode usar cookie HTTP-only temporario assinado ou outro mecanismo server-side equivalente;
- deve ser invalidada apos sucesso, cancelamento ou expiracao.

E-mail verificado:

- deve ser validado no callback do Google;
- pode iniciar o fluxo controlado de primeiro vinculo;
- pode ser armazenado como informacao auxiliar;
- nao deve ser usado sozinho para autenticar silenciosamente, criar `User` ou conceder acesso sem confirmacao explicita.

Conflitos:

- se `provider + providerUserId` ja estiver vinculado a outro `User`, bloquear a vinculacao;
- se o `User` interno resolvido ja tiver `userId + provider` ativo com outro `providerUserId`, bloquear e informar que esse provedor ja esta vinculado a outra conta;
- se houver registro inativo do mesmo `userId + provider`, permitir reativacao apenas apos validar novamente o provedor e garantir que nao conflita com outro `User`.

Resultado:

- Contrato de dados fechado antes da migration.
- Regras de primeiro login, conflito e seguranca fechadas antes de codificar endpoints.
- Login social preparado para futura integracao com Google Agenda sem misturar escopos de calendario.

### Etapa 2 - Fundacao backend

Status: concluida

- [X] Criar modelo Prisma e migration.
- [X] Criar modulo/service para identidade externa ou integracoes de autenticacao.
- [X] Criar configuracao de ambiente:
  - [X] `GOOGLE_OAUTH_CLIENT_ID`;
  - [X] `GOOGLE_OAUTH_CLIENT_SECRET`;
  - [X] `GOOGLE_OAUTH_CALLBACK_URL`;
  - [X] origem frontend permitida para redirect pos-login, se necessario.
- [X] Implementar utilitario para montar URL de autorizacao Google.
- [X] Implementar geracao e validacao de `state`.
- [X] Implementar troca de `code` por tokens no callback.
- [X] Validar perfil Google e `email_verified`.
- [X] Resolver `User` interno a partir do vinculo existente.
- [X] Quando nao houver vinculo, resolver `User` interno por e-mail verificado unico e ativo.
- [X] Criar mecanismo temporario e seguro para confirmacao pendente de primeiro vinculo.
- [X] Criar endpoints para confirmar e cancelar o primeiro vinculo.
- [X] Reutilizar a emissao atual de JWT/cookie.
- [X] Registrar auditoria de login social.

Resultado esperado:

- Backend consegue autenticar usuario ja vinculado via Google.
- Backend consegue iniciar confirmacao explicita quando o primeiro login Google corresponde a um `User` interno existente.
- Sessao resultante e indistinguivel da sessao do login por senha para o restante do app.

Implementado:

- Modelo `UserAuthProvider` e enum `AuthProvider`.
- Migration `20260714120000_add_user_auth_providers`.
- Service `SocialAuthService`.
- Rotas backend:
  - `GET /api/auth/oauth/google/start`;
  - `GET /api/auth/oauth/google/callback`;
  - `GET /api/auth/oauth/google/pending-link`;
  - `POST /api/auth/oauth/google/confirm-link`;
  - `POST /api/auth/oauth/google/cancel-link`.
- Cookies temporarios HTTP-only para `state` e confirmacao pendente.
- Emissao do cookie `access_token` apos login social ou confirmacao de primeiro vinculo.
- Auditoria de login social e criacao de vinculo.
- `.env.example` da API atualizado com variaveis Google OAuth.

Validado:

- `npx.cmd prisma validate --schema prisma/schema.prisma`;
- `npx.cmd prisma generate --schema prisma/schema.prisma`;
- `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`;
- `npm.cmd run build -w apps/api`.

### Etapa 3 - Gestao de provedores e desvinculacao

Status: concluida

- [X] Criar endpoint para listar provedores vinculados do usuario atual.
- [X] Criar endpoint para desvincular provedor.
- [X] Bloquear desvinculacao quando usuario ficaria sem forma valida de acesso.
- [X] Registrar auditoria de vinculacao/desvinculacao.
- [X] Avaliar se ainda sera mantida uma acao autenticada de vincular Google no perfil como caminho secundario.
- [X] Se houver vinculacao autenticada no perfil, reutilizar validacao de `state`, callback seguro e regras de conflito do primeiro login.

Resultado esperado:

- Usuario consegue ver e remover provedores conectados com seguranca.
- Caminho principal de primeiro vinculo acontece no primeiro login social, nao obrigatoriamente dentro do perfil.

Implementado:

- `GET /api/auth/me/auth-providers` lista provedores ativos conectados ao usuario atual.
- `DELETE /api/auth/me/auth-providers/:provider` desvincula provedor ativo do usuario atual.
- Desvinculacao faz soft revoke do vinculo (`is_active = false`, `revoked_at` preenchido), preservando historico e permitindo reativacao futura do mesmo provedor validado.
- Desvinculacao bloqueia quando o usuario ficaria sem outra forma valida de acesso.
- Auditoria registrada em `tb_audit_log` com entidade `user_auth_provider`.
- Decisao: nao implementar vinculacao autenticada pelo perfil nesta etapa. O caminho principal permanece o primeiro login social com confirmacao explicita. Se esse caminho secundario for retomado, deve reutilizar `state`, callback seguro e regras de conflito ja definidas.

Validado:

- `npx.cmd prisma validate --schema prisma/schema.prisma`;
- `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`;
- `npm.cmd run build -w apps/api`.

### Etapa 4 - Frontend

Status: concluida

- [X] Adicionar botao "Entrar com Google" em `/login`.
- [X] Preservar redirect seguro existente apos login.
- [X] Criar tela/modal de confirmacao de primeiro vinculo quando a conta Google corresponder a um usuario interno existente.
- [X] Exibir erro amigavel quando a conta Google nao puder ser vinculada.
- [X] Adicionar area em `/meu-perfil` para provedores conectados.
- [X] Permitir desvincular Google quando for seguro.
- [X] Decidir se vincular Google pelo perfil entra nesta etapa. Decisao: nao entra; fica como caminho secundario futuro.
- [X] Atualizar textos/i18n se aplicavel.
- [X] Garantir leitura mobile.

Resultado esperado:

- Usuario consegue iniciar login social, confirmar primeiro vinculo e entrar sem conhecer detalhes tecnicos do OAuth.

Implementado:

- Botao "Entrar com Google" em `/login`, preservando redirect seguro quando existir.
- Utilitario compartilhado para redirect pos-login seguro.
- Pagina publica `/login/social-link` para confirmacao explicita do primeiro vinculo.
- Confirmacao cria sessao usando o cookie atual e redireciona para o destino correto por perfil.
- Cancelamento da confirmacao remove o cookie temporario e volta para `/login`.
- Area "Login conectado" em `/meu-perfil`.
- Listagem de provedores conectados.
- Acao de desvincular provedor, respeitando o bloqueio retornado pelo backend quando o usuario ficaria sem acesso.
- Textos do botao de login Google adicionados em `pt-BR`, `pt-PT` e `en-US`.
- Decisao: vinculacao autenticada pelo perfil nao foi implementada como caminho ativo nesta etapa. O caminho principal segue sendo primeiro login social com confirmacao.

Validado:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`;
- `npm.cmd run build -w apps/web`.

### Etapa 5 - Apple readiness

Status: concluida

- [X] Confirmar que o modelo usa `providerUserId`, nao e-mail, como identificador principal.
- [X] Confirmar que o e-mail e opcional para provedores futuros quando necessario.
- [X] Documentar variaveis futuras de Apple:
  - [X] `APPLE_CLIENT_ID`;
  - [X] `APPLE_TEAM_ID`;
  - [X] `APPLE_KEY_ID`;
  - [X] `APPLE_PRIVATE_KEY`;
  - [X] `APPLE_CALLBACK_URL`.
- [X] Garantir que nenhum fluxo compartilhado tenha regra fixa em `GOOGLE`.

Resultado esperado:

- Apple pode entrar como proxima entrega sem refatorar a tabela principal.

Resultado da revisao:

- `UserAuthProvider.providerUserId` e o identificador principal do usuario no provedor.
- `UserAuthProvider.email` e opcional.
- `UserAuthProvider.emailVerified` existe como informacao auxiliar.
- Restricoes continuam genericas:
  - `@@unique([provider, providerUserId])`;
  - `@@unique([userId, provider])`.
- O enum `AuthProvider` ja contem:
  - `GOOGLE`;
  - `APPLE`.
- Frontend ja tipa provedores como `GOOGLE | APPLE`.
- A listagem/desvinculacao de provedores no perfil usa provider generico.
- Mensagens compartilhadas do backend e da tela de confirmacao usam o provider real, nao texto fixo de Google.
- Rotas e botao de login continuam Google-specific nesta entrega porque apenas Google e funcional agora.

Variaveis futuras para Sign in with Apple:

- `APPLE_CLIENT_ID`: identificador do Service ID/app configurado no Apple Developer, usado como `client_id`.
- `APPLE_TEAM_ID`: identificador do time Apple Developer.
- `APPLE_KEY_ID`: identificador da chave privada criada no Apple Developer.
- `APPLE_PRIVATE_KEY`: conteudo da chave privada `.p8`, preferencialmente armazenado como secret seguro no backend.
- `APPLE_CALLBACK_URL`: callback publico autorizado para o login Apple, equivalente ao callback Google.

Regras para a futura implementacao Apple:

- usar `sub` do `id_token` da Apple como `providerUserId`;
- nao depender de e-mail para login recorrente;
- tratar e-mail como opcional, pois a Apple pode enviar e-mail/nome apenas no primeiro consentimento;
- aceitar e-mail relay privado da Apple como dado auxiliar, nao como identidade principal;
- gerar `client_secret` JWT no backend usando `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY`;
- reutilizar a mesma regra de primeiro vinculo: e-mail verificado pode iniciar confirmacao, mas nao cria `User` automaticamente;
- manter Apple fora desta entrega funcional ate decisao explicita de produto.

Validado:

- Revisao do schema Prisma confirmou modelo provider-first.
- Revisao do frontend confirmou tipo `AuthProvider = 'GOOGLE' | 'APPLE'`.
- Revisao do backend confirmou listagem/desvinculacao genericas por provider.

### Etapa 6 - Validacao tecnica

Status: concluida

- [X] Rodar validacao Prisma.
- [X] Rodar typecheck do backend.
- [X] Rodar typecheck do frontend.
- [X] Validar login por senha continua funcionando.
- [X] Validar login Google com usuario vinculado.
- [X] Validar primeiro login Google sem vinculo, com e-mail verificado correspondente, criando vinculo apenas apos confirmacao.
- [X] Validar tentativa de primeiro login Google sem usuario interno correspondente.
- [X] Validar tentativa de primeiro login Google com usuario inativo, tenant inativo ou e-mail nao verificado.
- [X] Validar desvinculacao.
- [X] Validar bloqueio de desvinculacao insegura.
- [X] Validar cookie, redirect e `/auth/me`.

Comandos previstos:

```txt
npx.cmd prisma validate --schema apps/api/prisma/schema.prisma
npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false
npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false
```

Validacao tecnica automatizada executada em 2026-07-14:

- `npx.cmd prisma validate --schema prisma/schema.prisma`;
- `npx.cmd prisma migrate status --schema prisma/schema.prisma`;
- `npx.cmd prisma migrate deploy --schema prisma/schema.prisma`;
- `npx.cmd prisma generate --schema prisma/schema.prisma`;
- `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`;
- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`;
- `npm.cmd run build -w apps/api`;
- `npm.cmd run build -w apps/web`.

Resultado:

- Schema Prisma valido.
- Banco local atualizado com a migration `20260714120000_add_user_auth_providers`.
- Typecheck do backend aprovado.
- Typecheck do frontend aprovado.
- Build da API aprovado.
- Build do Web aprovado.
- A pasta local vazia `20260713120000_add_schedule_confirmation_reminder_sent_at` foi removida do workspace porque bloqueava o `migrate deploy` e nao continha `migration.sql`.
- Durante a validacao manual do login por senha, foi identificado `429 Too Many Requests` por limite muito baixo no endpoint `/auth/login`; o limite especifico do login por senha foi ajustado de 5 para 20 tentativas por minuto e o frontend passou a exibir mensagem propria para esse caso.
- Durante a validacao manual do Google OAuth, login com usuario existente, primeiro vinculo e desvinculacao foram validados.
- A tentativa com conta Google sem usuario interno correspondente retornava JSON `401` diretamente no callback. O callback agora captura o erro, limpa cookies temporarios e redireciona para `/login/social-link` com tela de erro no mesmo padrao visual da confirmacao de vinculo.

Observacao:

- `npx.cmd prisma generate --schema prisma/schema.prisma` encontrou `EPERM` na primeira tentativa por lock temporario do Windows, mas passou na tentativa final e o Prisma Client completo foi gerado.
- Apos o ajuste do `429`, os typechecks de backend e frontend foram executados novamente com sucesso:
  - `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`;
  - `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`.
- Apos o ajuste do erro no callback OAuth, as validacoes abaixo foram executadas com sucesso:
  - `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`;
  - `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`;
  - `npm.cmd run build -w apps/web`.
- Validacao final executada em 2026-07-14 com sucesso:
  - `npx.cmd prisma validate --schema prisma/schema.prisma`;
  - `npx.cmd prisma migrate status --schema prisma/schema.prisma`;
  - `npx.cmd prisma generate --schema prisma/schema.prisma`;
  - `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`;
  - `npx.cmd tsc -p apps/web/tsconfig.json --noEmit --pretty false`;
  - `npm.cmd run build -w apps/api`;
  - `npm.cmd run build -w apps/web`.
- Para liberar o lock do Prisma Client no Windows, os processos locais Node do projeto foram parados antes do `prisma generate`.
- O build do Web manteve apenas avisos existentes de workspace root/multiplos lockfiles e convencao `middleware` depreciada, sem falha de build.

Validacoes manuais pendentes:

- Nenhuma pendencia manual obrigatoria para fechar a entrega local.

Validacoes manuais confirmadas em 2026-07-14:

- Login por senha no navegador continua funcionando.
- Login Google com usuario vinculado continua funcionando.
- Primeiro vinculo, remocao do vinculo e novo login Google funcionam.
- Conta Google sem cadastro no OneElo exibe retorno amigavel.
- Usuario inativo nao consegue logar.
- Usuario de tenant inativo nao consegue logar.
- Cookie, redirect e `/auth/me` foram considerados validados pelo acesso bem-sucedido ao sistema apos login Google.
- Bloqueio de desvinculacao insegura validado tecnicamente em `SocialAuthService.unlinkProvider`: se o usuario nao tiver `senhaHash` e nao restar outro provedor ativo, a API bloqueia a remocao com `ForbiddenException`.

### Etapa 7 - Documentacao e handoff

Status: concluida

- [X] Atualizar `.env.example` com variaveis Google usando placeholders, sem secrets reais.
- [X] Registrar instrucoes para configurar credenciais no Google Cloud.
- [X] Registrar URLs de callback por ambiente.
- [X] Atualizar este plano com resultados e decisoes finais.
- [X] Registrar pendencias para Apple.

Resultado esperado:

- Feature pronta para validacao manual e configuracao em nuvem.

Instrucoes de configuracao Google Cloud:

- Criar credencial OAuth do tipo Web application.
- Configurar as URIs de redirecionamento autorizadas apontando para o frontend, pois o cookie de sessao deve ser gravado no dominio do app web.
- Local:
  - `http://localhost:3001/api/auth/oauth/google/callback`
- Producao:
  - `https://DOMINIO_DO_APP/api/auth/oauth/google/callback`
- Configurar no backend:
  - `GOOGLE_OAUTH_CLIENT_ID`;
  - `GOOGLE_OAUTH_CLIENT_SECRET`;
  - `GOOGLE_OAUTH_CALLBACK_URL`.
- Nao versionar valores reais de client secret. Se um secret real aparecer em arquivo versionavel, gerar um novo client secret no Google Cloud antes de publicar a feature.

Resultados finais da entrega:

- Login por senha preservado.
- Login social Google implementado como primeiro provedor.
- Primeiro vinculo Google exige e-mail verificado correspondente a um `User` interno ativo e confirmacao explicita.
- Login social nao cria usuarios automaticamente.
- Usuario sem cadastro interno, usuario inativo e tenant inativo ficam bloqueados.
- Tela de erro amigavel cobre falhas de OAuth abertas no navegador.
- Usuario autenticado consegue listar e desvincular provedor no perfil.
- Desvinculacao insegura fica bloqueada quando o usuario ficaria sem metodo valido de acesso.
- Tokens OAuth do Google nao sao persistidos nesta entrega.
- Modelo `UserAuthProvider` fica preparado para Apple sem nova remodelagem estrutural.

### Extensao: ativacao de usuario pendente com Google

Status: concluida e validada em 2026-07-16

O login social diario continua restrito a usuarios `ACTIVE`. A unica excecao para um usuario `PENDING` e o fluxo de ativacao iniciado por um link valido:

1. O administrador cria o usuario sem senha e recebe o link de ativacao.
2. A tela publica inicia `GET /api/auth/oauth/google/start?activationToken=...`.
3. O backend valida o token antes de redirecionar ao Google e o inclui no `state` assinado.
4. O callback exige e-mail Google verificado e igual ao e-mail do usuario pendente.
5. A tela `/login/social-link` mantem a confirmacao explicita antes de criar ou reativar `UserAuthProvider`.
6. A confirmacao ativa o usuario, limpa o token, cria a sessao e direciona para `/onboarding`.

Regras adicionais:

- Token expirado, substituido, reutilizado ou de usuario que nao seja mais `PENDING` e rejeitado.
- Identidade externa vinculada a outro usuario e conflito de provedor continuam bloqueados.
- Usuario ativado somente por Google pode criar sua primeira senha em Meu Perfil sem senha atual.
- `PENDING` e `DISABLED` recebem bloqueios coerentes tanto no login por senha quanto no login Google diario.
- Um usuario `ACTIVE` nunca pode ficar sem senha e sem ao menos um provedor social ativo.

Pendencias futuras para Apple:

- Criar credenciais no Apple Developer.
- Configurar `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` e `APPLE_CALLBACK_URL` quando a implementacao for priorizada.
- Implementar geracao do `client_secret` JWT no backend.
- Tratar particularidades do Apple, como e-mail privado/relay e nome retornado apenas no primeiro consentimento.
- Reutilizar a mesma regra de vinculo: nao criar usuario automaticamente e exigir correspondencia com usuario interno ativo.

## Riscos e pontos de atencao

- OAuth depende de URLs publicas/callback corretas por ambiente.
- Apple tem comportamento diferente do Google e nao deve ser tratado apenas como troca de endpoint.
- Login por e-mail verificado pode gerar ambiguidade em ambiente multi-tenant se a regra nao for explicita.
- Se tokens forem armazenados, precisam ser criptografados e ter politica de rotacao/revogacao.
- O fluxo nao deve permitir acesso a usuario inativo ou tenant inativo.
- `SUPER_ADMIN` deve permanecer fora do login tenant/social desta etapa, salvo decisao futura explicita.

## Criterios de aceite

- Usuario com Google vinculado consegue entrar no sistema.
- Usuario sem vinculo so ganha acesso apos e-mail verificado corresponder a `User` interno ativo e apos confirmacao explicita de primeiro vinculo.
- Usuario sem `User` interno correspondente nao ganha acesso.
- A sessao criada pelo Google respeita tenant e role.
- Login por senha continua funcionando.
- Usuario consegue ver o provedor vinculado no perfil/configuracoes.
- Usuario consegue desvincular Google quando ainda possui acesso por senha.
- Backend registra auditoria minima.
- O modelo de dados comporta Apple sem nova remodelagem estrutural.
