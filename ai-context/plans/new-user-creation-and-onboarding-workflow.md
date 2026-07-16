# Plano de Desenvolvimento - Novo Fluxo de Ativacao de Conta e Onboarding

Status geral: concluido - implementacao validada; rollout do onboarding temporariamente desabilitado por flag
Ultima atualizacao: 2026-07-16

Branch de trabalho: `feature/user-account-activation-onboarding`

## Objetivo

Substituir o processo atual em que o administrador define a senha inicial do usuario por um fluxo de ativacao de conta por link, mantendo os metodos atuais de autenticacao (Google e e-mail/senha), melhorando a seguranca do primeiro acesso e criando uma base incremental para onboarding, PWA e notificacoes.

Este plano deve ser lido como uma transicao sobre o codigo atual, nao como um fluxo ja existente.

---

## Estado Atual do Codigo

### Modelo atual

No Prisma, `User` possui hoje:

- `senhaHash` obrigatorio.
- `ativo` booleano para liberar ou bloquear acesso.
- `memberId` opcional para vinculo com `Membro`.
- `UserAuthProvider` para vinculos Google/Apple.

Nao existem hoje:

- `User.status`.
- `activationTokenHash`.
- `activationExpiresAt`.
- `activatedAt`.
- tela publica `/activate/{token}`.
- endpoints de ativacao de conta.
- estado persistido de onboarding.

### Fluxos atuais de criacao

Existem dois fluxos diferentes:

1. Super Admin cria um tenant e o primeiro usuario `ADMIN` informando senha.
2. Admin do tenant cria usuarios em Configuracoes informando senha.

O novo fluxo deve ser aplicado primeiro ao item 2.

Fora do escopo inicial:

- alterar a criacao do primeiro `ADMIN` durante o cadastro de tenant;
- automatizar envio por e-mail, WhatsApp, SMS ou filas.

### Login atual

O login por e-mail/senha:

- busca usuario por e-mail com `ativo = true`;
- rejeita `SUPER_ADMIN` no login tenant;
- valida `senhaHash` com bcrypt;
- cria sessao JWT em cookie HTTP-only.

O login com Google:

- ja existe;
- valida e-mail verificado;
- vincula `UserAuthProvider` quando encontra um usuario interno ativo com o mesmo e-mail;
- hoje nao atende usuario pendente, porque tambem depende de usuario ativo.

### PWA e notificacoes

Ja existem bases tecnicas para:

- detectar modo instalado e plataforma PWA;
- solicitar permissao de notificacoes;
- criar/remover push subscriptions;
- consultar chave publica VAPID.

O plano deve reaproveitar esses helpers em vez de recriar essa infraestrutura.

---

## Problema

O fluxo atual exige que o administrador crie uma senha inicial e a comunique ao usuario. Isso gera:

- conhecimento da senha por terceiro;
- compartilhamento inseguro por WhatsApp ou outros canais;
- baixa percepcao profissional no primeiro acesso;
- friccao para adocao de Google, PWA e notificacoes.

---

## Modelo Alvo

### User.status

Adicionar um novo enum de status de usuario:

```txt
PENDING
ACTIVE
DISABLED
```

Significados:

- `PENDING`: conta criada, ainda nao ativada. Nao pode fazer login diario.
- `ACTIVE`: conta ativada. Pode fazer login por metodos vinculados.
- `DISABLED`: conta bloqueada/desativada. Nao pode fazer login.

### Migracao de `ativo`

O campo `ativo` atual deve ser migrado de forma explicita.

Regra de migracao:

```txt
ativo = true  -> status = ACTIVE
ativo = false -> status = DISABLED
```

Decisao recomendada:

- manter `ativo` temporariamente durante a migracao, se isso reduzir risco;
- fazer o backend passar a usar `status` como fonte de verdade para login;
- remover ou descontinuar `ativo` em uma etapa posterior, apos estabilizacao.

### Senha opcional

Para suportar ativacao apenas com Google, `senhaHash` precisa deixar de ser obrigatorio no modelo de dados.

Regras:

- usuario `PENDING` pode ter `senhaHash = null`;
- usuario `ACTIVE` pode ter acesso por senha, por provedor social, ou ambos;
- nao permitir que um usuario `ACTIVE` fique sem nenhuma forma valida de acesso;
- desvincular provedor social continua proibido quando ele for o unico metodo de acesso.

### Campos de ativacao

Adicionar em `User`:

```txt
status
activationTokenHash
activationExpiresAt
activationCreatedAt
activatedAt
onboardingCompletedAt
```

Notas:

- nao salvar token bruto no banco;
- salvar apenas hash do token;
- token bruto aparece somente no link copiado pelo administrador;
- `onboardingCompletedAt` e suficiente para a primeira versao do onboarding.

Campos granulares como `pwaPromptSeenAt`, `pushPromptSeenAt` e `profileReviewedAt` ficam fora da primeira entrega, salvo necessidade futura.

---

## Novo Fluxo de Criacao de Usuario

### Escopo inicial

Fluxo aplicado ao painel do tenant em Configuracoes.

Campos do usuario:

- Membro vinculado opcional (`memberId`).
- Nome.
- E-mail.
- Perfil (`role`).

Nao solicitar senha na criacao.

Telefone, data de nascimento, foto e ministerios pertencem ao dominio de `Membro`/ministerios e devem ser tratados nas telas existentes ou na etapa de conferencia cadastral.

### Ao salvar

O backend deve:

1. validar e-mail unico;
2. validar `memberId`, quando informado;
3. criar `User` com `status = PENDING`;
4. criar token criptograficamente seguro;
5. salvar `activationTokenHash`;
6. preencher `activationExpiresAt` e `activationCreatedAt`;
7. retornar os dados do usuario e o link de ativacao uma unica vez.

Prazo inicial sugerido:

```txt
72 horas
```

---

## Link de Ativacao

Formato sugerido:

```txt
https://app.oneelo.com/activate/{token}
```

Em desenvolvimento, usar a origem do frontend configurada por ambiente.

O link deve abrir diretamente o fluxo de ativacao, nao a tela de login.

---

## Contratos de API Propostos

Os nomes exatos podem ser ajustados durante a implementacao, mas o plano deve cobrir estes contratos.

### Criar usuario pendente

```txt
POST /api/auth/users
```

Comportamento:

- cria usuario `PENDING`;
- nao recebe senha;
- retorna usuario e link de ativacao para copia imediata.

### Regenerar link de ativacao

```txt
POST /api/auth/users/:id/activation-link
```

Comportamento:

- permitido para `ADMIN` do tenant;
- permitido apenas para usuario do mesmo tenant;
- invalida token anterior ao substituir `activationTokenHash`;
- reinicia prazo de expiracao;
- retorna novo link de ativacao.

### Validar token

```txt
GET /api/auth/activation/:token
```

Comportamento:

- valida hash e expiracao;
- retorna dados minimos para tela de boas-vindas;
- nao cria sessao;
- nao retorna informacoes sensiveis.

### Ativar com senha

```txt
POST /api/auth/activation/:token/password
```

Payload:

```txt
senha
confirmarSenha
```

Comportamento:

- valida token;
- exige senha com minimo atual de 6 caracteres;
- salva `senhaHash`;
- muda `status` para `ACTIVE`;
- preenche `activatedAt`;
- limpa `activationTokenHash` e `activationExpiresAt`;
- cria sessao JWT;
- redireciona para onboarding.

### Ativar com Google

O fluxo social normal nao deve ser reutilizado de forma cega, porque hoje ele exige usuario ativo.

Contrato esperado:

```txt
GET /api/auth/oauth/google/start?activationToken=...
GET /api/auth/oauth/google/callback
GET /api/auth/oauth/google/pending-link
POST /api/auth/oauth/google/confirm-link
```

Comportamento:

- validar token de ativacao;
- autenticar com Google;
- exibir a confirmacao de vinculo ja usada pelo login social;
- exigir e-mail Google verificado;
- exigir que o e-mail Google seja igual ao e-mail cadastrado no usuario pendente;
- criar ou reativar `UserAuthProvider`;
- mudar `status` para `ACTIVE`;
- preencher `activatedAt`;
- limpar token de ativacao;
- criar sessao JWT;
- redirecionar para onboarding.

---

## Login Diario Depois da Ativacao

Depois que a conta estiver `ACTIVE`, o comportamento diario permanece:

- login por e-mail/senha quando houver `senhaHash`;
- login com Google quando houver `UserAuthProvider` ativo;
- redirecionamento por perfil usando a regra atual.

O login diario nao deve aceitar `PENDING`.

---

## Login com Conta Pendente

Se o usuario tentar login por e-mail/senha antes da ativacao:

- retornar `403`;
- usar um codigo de erro estavel, por exemplo `ACCOUNT_PENDING_ACTIVATION`;
- frontend exibe mensagem especifica.

Mensagem sugerida:

```txt
Sua conta ainda nao foi ativada.
Use o link de ativacao enviado pelo administrador.
```

Opcional:

- permitir que o usuario cole o link ou peca novo envio em fluxo futuro;
- fora do escopo inicial, pois ainda nao ha envio automatico.

---

## Tela Administrativa

Na listagem de usuarios:

- mostrar status `Pendente`, `Ativo` ou `Desativado`;
- manter acoes atuais de editar/desativar respeitando o novo status;
- para `PENDING`, mostrar acoes:
  - copiar link de ativacao, quando disponivel;
  - gerar novo link.

Apos criar usuario:

- exibir confirmacao;
- mostrar link de ativacao;
- oferecer botao de copiar link.

O administrador continua responsavel por enviar o link pelo canal que desejar.

Automacao de envio por e-mail/WhatsApp fica para fase posterior.

---

## Fluxo Publico de Ativacao

### Tela 1 - Boas-vindas

Exibir:

- nome do usuario;
- nome da igreja, se disponivel;
- explicacao curta do processo;
- botao `Continuar`.

### Tela 2 - Forma de acesso

Opcoes:

- Continuar com Google.
- Criar senha.

### Ativacao por senha

Campos:

- senha;
- confirmar senha.

Regras:

- minimo de 6 caracteres;
- confirmacao obrigatoria;
- ativar conta somente apos sucesso da API.

### Ativacao por Google

Regras:

- e-mail Google precisa estar verificado;
- e-mail Google precisa ser o mesmo e-mail cadastrado;
- se houver conflito com outro usuario/provedor, bloquear com mensagem clara.

### Link expirado ou invalido

Exibir:

```txt
Este link expirou ou nao e mais valido.
Solicite um novo link ao administrador da sua igreja.
```

---

## Onboarding Inicial

O onboarding comeca apos a ativacao bem-sucedida.

Persistencia minima:

```txt
onboardingCompletedAt
```

Enquanto esse campo estiver vazio, o frontend pode direcionar o usuario para o fluxo de onboarding depois do login/ativacao.

O onboarding deve ser uma tela autenticada isolada, sem sidebar/header do dashboard, com etapas sequenciais guiadas por acao do usuario.

Decisao de implementacao:

- nao fazer backfill de `onboardingCompletedAt`;
- usuarios existentes tambem devem passar pelo onboarding na primeira sessao apos a entrega;
- seeds de desenvolvimento nao devem preencher `onboardingCompletedAt` automaticamente.
- gravar `onboardingCompletedAt` somente no passo final de conclusao, nunca ao apenas avancar etapas ou abrir Meu Perfil.

### Passo 1 - Instalar aplicativo

Reaproveitar helpers existentes de PWA:

- detectar standalone;
- detectar Android/iOS/desktop;
- usar `beforeinstallprompt` quando disponivel;
- em iOS, exibir instrucao para adicionar a tela inicial.

O usuario pode continuar sem instalar.

Excecao iOS:

- no iPhone/iPad, o usuario deve adicionar o One Elo a Tela de Inicio e abrir pelo icone antes de continuar;
- essa regra existe porque notificacoes no iOS dependem do app instalado/standalone;
- enquanto `standalone` nao for detectado, o onboarding nao deve avancar para os proximos passos.

### Passo 2 - Ativar notificacoes

Reaproveitar helper atual de push notifications.

Regras:

- solicitar permissao apenas por acao do usuario;
- permitir continuar se o usuario negar;
- tratar ambiente sem VAPID configurado como indisponivel, nao como erro fatal.

### Passo 3 - Conferencia cadastral

Levar o usuario para conferir dados em Meu Perfil.

Campos possiveis:

- nome;
- nome de exibicao;
- telefone/WhatsApp;
- foto;
- dados do membro ja existentes.

Endereco e outros campos so devem ser exigidos se ja existirem no modelo/tela de membro.

### Passo 4 - Conclusao

Ao finalizar:

- preencher `onboardingCompletedAt`;
- redirecionar para destino normal do perfil.

---

## Seguranca

Requisitos obrigatorios:

- token aleatorio criptograficamente seguro;
- token bruto nunca persistido;
- persistir apenas hash do token;
- expiracao obrigatoria;
- uso unico;
- limpar token apos ativacao;
- bloquear login diario de `PENDING`;
- bloquear login de `DISABLED`;
- nao permitir ativacao social com e-mail diferente;
- auditar criacao de usuario, regeneracao de link, ativacao e login;
- aplicar rate limit em login, validacao de token, ativacao e regeneracao.

---

## Etapas

### Etapa 0 - Preparacao

Status: concluida

Tarefas:

- [x] Atualizar `development` local com `origin/development`.
- [x] Criar branch de feature a partir de `development`.
- [x] Revisar usos atuais de `User.ativo` no backend e frontend.
- [x] Revisar pontos que assumem `User.senhaHash` obrigatorio.
- [x] Confirmar decisao final sobre convivencia temporaria entre `ativo` e `status`.

Resultado esperado:

- escopo tecnico fechado antes de qualquer migration ou alteracao de auth.

### Etapa 1 - Modelo de dados e migracao

Status: concluida

Tarefas:

- [x] Criar enum/campo de status de usuario.
- [x] Adicionar campos `activationTokenHash`, `activationExpiresAt`, `activationCreatedAt`, `activatedAt` e `onboardingCompletedAt`.
- [x] Tornar `senhaHash` opcional no Prisma.
- [x] Migrar usuarios atuais de `ativo = true` para `status = ACTIVE`.
- [x] Migrar usuarios atuais de `ativo = false` para `status = DISABLED`.
- [x] Decidir se `ativo` permanece temporariamente ou passa a ser descontinuado nesta mesma entrega.
- [x] Atualizar documentacao de modelos.

Validacao:

- [x] `npx.cmd prisma validate`.
- [x] `npx.cmd prisma generate`.
- [x] Typecheck backend apos atualizacao do client.
- [x] `npm.cmd run build -w apps/api`.

Valor entregue:

- base persistida compativel com usuarios pendentes e acesso sem senha.

### Etapa 2 - Backend de criacao pendente e ativacao por senha

Status: concluida

Tarefas:

- [x] Atualizar DTO de criacao de usuario do tenant para nao exigir senha.
- [x] Criar helper/service para gerar token bruto e persistir apenas hash.
- [x] Atualizar `POST /api/auth/users` para criar usuario `PENDING`.
- [x] Retornar link de ativacao apenas na resposta de criacao/regeneracao.
- [x] Criar endpoint publico para validar token de ativacao.
- [x] Criar endpoint publico para ativar conta com senha.
- [x] Preencher `activatedAt` e limpar dados de ativacao apos sucesso.
- [x] Criar sessao JWT apos ativacao por senha.
- [x] Registrar auditoria de criacao e ativacao.
- [x] Registrar auditoria de regeneracao.
- [x] Aplicar rate limit nos endpoints publicos sensiveis.

Validacao:

- [x] Testar criacao de usuario pendente.
- [x] Testar token valido, invalido e reutilizado.
- [x] Testar token expirado.
- [x] Testar ativacao por senha.
- [x] Testar que usuario ativado acessa o sistema.
- [x] Typecheck/backend build relevante.
- [x] `npm.cmd run build -w apps/api`.

Valor entregue:

- administrador deixa de definir senha para usuarios comuns.

### Etapa 3 - Regras de login e status

Status: concluida

Tarefas:

- [x] Atualizar login por e-mail/senha para aceitar apenas `ACTIVE`.
- [x] Retornar `403` com codigo estavel para `PENDING`.
- [x] Retornar bloqueio claro para `DISABLED`.
- [x] Atualizar `me`, troca de senha e demais consultas autenticadas para usar a nova regra de status.
- [x] Garantir que usuario `ACTIVE` nao fique sem senha e sem provedor social.
- [x] Permitir que usuario ativado por provedor social crie sua primeira senha sem senha atual.
- [x] Atualizar login social diario para aceitar apenas usuario `ACTIVE`.

Validacao:

- [x] Login por senha de usuario `ACTIVE`.
- [x] Bloqueio de `PENDING`.
- [x] Bloqueio de `DISABLED`.
- [x] Login social diario com usuario `ACTIVE`.
- [x] Tentativa de login social diario com usuario `PENDING`.
- [x] Criacao da primeira senha por usuario autenticado apenas com Google.

Valor entregue:

- status de usuario passa a ser a fonte de verdade de autenticacao.

### Etapa 4 - Ativacao com Google

Status: concluida

Tarefas:

- [x] Criar caminho OAuth especifico para ativacao por token.
- [x] Validar token antes de iniciar/confirmar ativacao social.
- [x] Reutilizar a tela de confirmacao de vinculo antes de ativar por Google.
- [x] Exigir e-mail Google verificado.
- [x] Exigir e-mail Google igual ao e-mail do usuario pendente.
- [x] Criar ou reativar `UserAuthProvider` durante ativacao.
- [x] Ativar usuario sem criar senha.
- [x] Criar sessao JWT apos ativacao social.
- [x] Bloquear conflitos com provedor ja vinculado a outro usuario.

Validacao:

- [x] Ativacao com Google usando e-mail correto.
- [x] Bloqueio com e-mail Google diferente.
- [x] Bloqueio com token expirado.
- [x] Bloqueio de conflito de provedor.

Valor entregue:

- usuario pode ativar conta sem criar senha.

### Etapa 5 - UI administrativa de usuarios

Status: concluida

Tarefas:

- [x] Remover obrigatoriedade do campo de senha da criacao de usuario no `UsuarioModal`.
- [x] Manter troca/redefinicao de senha apenas em edicao, conforme decisao de produto.
- [x] Exibir status `Pendente`, `Ativo` e `Desativado` na tabela.
- [x] Mostrar link de ativacao apos criar usuario.
- [x] Criar acao para copiar link.
- [x] Criar acao para gerar novo link.
- [x] Ajustar desativacao para usar `DISABLED`.
- [x] Atualizar tipos frontend.

Validacao:

- [x] Criar usuario pela tela de Configuracoes.
- [x] Copiar link recem-criado.
- [x] Regenerar link de usuario pendente.
- [x] Verificar usuario atualizado apos ativacao por link.
- [x] Desativar usuario ativo.
- [x] Verificar layout desktop/mobile.
- [x] Typecheck frontend.
- [x] `npm.cmd run build -w apps/web`.

Valor entregue:

- admin consegue criar e recuperar acesso pendente sem suporte tecnico.

### Etapa 6 - Tela publica de ativacao

Status: concluida

Tarefas:

- [x] Criar rota publica `/activate/[token]`.
- [x] Exibir tela de boas-vindas com dados minimos do usuario/tenant.
- [x] Exibir escolha entre Google e criacao de senha.
- [x] Implementar formulario de senha e confirmacao.
- [x] Implementar estado de link expirado/invalido.
- [x] Redirecionar para onboarding apos ativacao.
- [x] Garantir que a tela nao dependa de sessao autenticada previa.

Validacao:

- [x] Fluxo completo por senha.
- [x] Fluxo completo por Google.
- [x] Link invalido.
- [x] Link expirado.
- [x] Responsividade mobile.

Valor entregue:

- usuario acessa diretamente um fluxo profissional de primeiro acesso.

### Etapa 7 - Onboarding simples

Status: concluida

Tarefas:

- [x] Criar fluxo pos-ativacao com persistencia em `onboardingCompletedAt`.
- [x] Manter `/onboarding` fora do layout com sidebar/header do dashboard.
- [x] Organizar etapas sequenciais por acao do usuario.
- [x] Reaproveitar helpers existentes de PWA.
- [x] Nao exibir acao de instalacao desabilitada quando o prompt PWA estiver indisponivel.
- [x] Reaproveitar helper atual de push notifications.
- [x] Exibir somente a acao Continuar quando as notificacoes ja estiverem ativas.
- [x] Permitir continuar sem instalar PWA fora do iOS.
- [x] Exigir abertura pelo atalho instalado no iOS antes de continuar.
- [x] Exibir guia visual de instalacao no Safari do iOS com tres passos objetivos.
- [x] Substituir mockups simplificados por imagens detalhadas da interface do Safari/iOS.
- [x] Remover a navegacao e o resumo lateral da primeira etapa no Safari do iOS.
- [x] Permitir continuar sem conceder notificacoes.
- [x] Direcionar para conferencia cadastral em Meu Perfil.
- [x] Exigir abertura de Meu Perfil ao concluir o onboarding, sem obrigar campos opcionais.
- [x] Marcar onboarding como concluido.
- [x] Redirecionar para destino normal por perfil.

Validacao:

- [x] Usuario recem-ativado entra no onboarding.
- [x] Usuario existente com `onboardingCompletedAt = null` entra no onboarding.
- [x] Usuario com onboarding concluido nao ve fluxo novamente.
- [x] Ambiente sem suporte a push/PWA nao bloqueia uso.
- [x] Fluxo mobile validado.

Valor entregue:

- primeiro acesso guiado sem bloquear uso do sistema.

### Etapa 8 - Documentacao e validacao final

Status: concluida

Tarefas:

- [x] Atualizar `ai-context/database/models.md`.
- [x] Atualizar `ai-context/business-rules/validation-rules.md`.
- [x] Atualizar `ai-context/frontend/navigation-rules.md`, se houver mudanca de redirecionamento.
- [x] Atualizar documentacao do fluxo social.
- [x] Revisar diff completo.
- [x] Atualizar este plano com resultados reais.

Validacao:

- [x] Typecheck backend.
- [x] Build/backend relevante.
- [x] Typecheck frontend.
- [x] Build/frontend relevante.
- [x] `git diff --check`.

Valor entregue:

- plano, codigo e documentacao ficam sincronizados para handoff.

### Etapa futura - Automacao e refinamentos

Status: fora do escopo inicial

Tarefas futuras:

- [ ] Enviar link automaticamente por e-mail.
- [ ] Enviar link automaticamente por WhatsApp/SMS.
- [ ] Persistir estados granulares de onboarding.
- [ ] Remover definitivamente `ativo`, se a migracao estabilizar.
- [ ] Aplicar ativacao tambem ao primeiro `ADMIN` criado pelo Super Admin.

---

## Documentacao a Atualizar Durante a Implementacao

- `ai-context/database/models.md`
- `ai-context/business-rules/validation-rules.md`
- `ai-context/frontend/navigation-rules.md`, se houver mudanca de redirecionamento
- DTOs de criacao/edicao de usuario
- tipos frontend em `apps/web/src/types`
- documentacao do fluxo social, pois hoje ele assume usuario interno ativo

---

## Status Atual

- Plano revisado para refletir o modelo atual do codigo.
- Implementacao iniciada na branch `feature/user-account-activation-onboarding`.
- Etapas 0 a 8 concluidas.
- Etapas 2 e 5 validadas manualmente no fluxo ponta a ponta por senha.
- Etapa 3 concluida com login por senha e social validado para usuarios `ACTIVE`, `PENDING` e `DISABLED`.
- Etapa 4 concluida com confirmacao de vinculo restaurada e fluxo Google validado manualmente.
- Etapa 6 agora exibe escolha entre Google e criacao de senha e redireciona para onboarding apos ativacao.
- Etapa 7 concluida e validada manualmente com rota autenticada isolada `/onboarding`, etapas sequenciais, persistencia em `onboardingCompletedAt` apenas na conclusao final e redirecionamento para usuarios com onboarding pendente.
- Validacoes finais executadas: Prisma validate, 6 testes unitarios, typecheck backend, build backend, typecheck frontend, build frontend e `git diff --check`.
- Validacao manual concluida: usuario criado sem senha, senha criada pelo link, acesso ao sistema confirmado e usuario atualizado apos ativacao.
- Validacao manual adicional concluida: usuario pendente com data de expiracao vencida teve ativacao bloqueada; link foi regenerado; senha foi criada pelo novo link; usuario ativou com sucesso.
- Validacao manual concluida: ativacao Google, bloqueios do fluxo social, estados da tela publica e onboarding desktop/mobile.
- Validacao manual ponta a ponta concluida: criacao pendente, ativacao por senha e Google, onboarding, revisao de perfil, novo login, desativacao e reativacao.
- Revisao final corrigiu a preservacao de codigos de erro HTTP, bloqueou ativacao administrativa sem forma de acesso, removeu link inutil de usuario criado como `DISABLED` e passou a invalidar sessoes ja emitidas quando usuario ou tenant perde acesso.
- `prisma generate` ja havia sido executado durante o desenvolvimento; a repeticao final nao substituiu a DLL porque o servico Node local estava usando o client. O schema foi validado e os typechecks/builds passaram com o client atual.
- Entrega funcional pronta para handoff; itens da etapa futura permanecem fora do escopo.
- Rollout do onboarding temporariamente desabilitado: `NEXT_PUBLIC_ONBOARDING_ENABLED` ausente ou `false` ignora `onboardingCompletedAt` e envia todos ao destino normal. Definir `true` e gerar novo build do frontend habilita o fluxo.

---

## Riscos e Decisoes Pendentes

- Tornar `senhaHash` nullable exige revisar todos os pontos que assumem senha existente.
- O fluxo Google de ativacao precisa ser separado do login social diario para nao liberar `PENDING` fora do contexto do token.
- A remocao de `ativo` deve ser tratada com cautela, pois o campo aparece em varias telas e services.
- O primeiro `ADMIN` do tenant deve permanecer fora do escopo inicial para reduzir risco.
- Fora do iOS, onboarding nao deve bloquear uso do sistema se PWA ou notificacoes estiverem indisponiveis.
- No iOS, a instalacao do atalho e obrigatoria porque as notificacoes web dependem da abertura como app instalado.
