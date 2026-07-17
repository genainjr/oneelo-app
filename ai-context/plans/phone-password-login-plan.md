# Plano - Login com telefone e senha

Status geral: planejado - pronto para implementacao
Ultima atualizacao: 2026-07-17

Backlog de origem: `ai-context/backlog/phone-password-login.md`

## Objetivo

Adicionar login por numero de telefone e senha ao OneElo sem substituir os fluxos existentes de e-mail/senha e login social.

Ao final da entrega, um mesmo usuario tenant deve poder acessar a mesma conta por:

- e-mail e senha;
- telefone e senha;
- Google, quando houver `UserAuthProvider` ativo.

Os tres caminhos devem preservar as regras atuais de tenant, `User.status`, RBAC, onboarding, auditoria, redirect e sessao JWT em cookie HTTP-only.

## Resultado esperado ao final do plano

- `User` possui telefone de login opcional, normalizado e unico.
- Telefone de login e `Membro.whatsapp` permanecem dados separados.
- `POST /auth/login` aceita e-mail ou telefone com a mesma senha local.
- Clientes antigos que ainda enviam `{ email, senha }` continuam funcionando durante a transicao.
- A tela `/login` apresenta `E-mail ou telefone` e mantem o botao `Entrar com Google`.
- Administrador pode cadastrar, alterar e remover o telefone de login de usuarios do tenant.
- Usuario autenticado pode gerir o proprio telefone de login mediante reautenticacao por senha.
- Usuarios sem telefone continuam entrando por e-mail ou login social sem migracao obrigatoria.
- A funcionalidade pode ser implantada desabilitada e ativada por configuracao depois da validacao.

## Estado atual do codigo

Ja existe:

- `User.email` obrigatorio e unico global em `apps/api/prisma/schema.prisma`.
- `User.senhaHash` opcional para suportar ativacao e acesso exclusivamente social.
- `User.status` com `PENDING`, `ACTIVE` e `DISABLED` como fonte de verdade de acesso.
- `POST /auth/login` com rate limit de 20 tentativas por minuto.
- `LoginDto` aceitando apenas `email` e `senha`.
- `AuthService.login()` buscando `User` apenas por e-mail e validando tenant, status e senha.
- JWT em cookie HTTP-only, auditoria de login e redirects por perfil/onboarding.
- login Google funcional por `UserAuthProvider`.
- criacao e edicao de usuario tenant em `AuthService`, `CreateUserDto` e `UpdateUserDto`.
- modal administrativo `UsuarioModal` com e-mail obrigatorio e senha opcional.
- `Meu Perfil` com troca de senha e edicao de `Membro.whatsapp`.
- traducoes da tela de login em `pt-BR`, `pt-PT` e `en-US`.

Ainda nao existe:

- telefone dedicado em `User`;
- normalizacao canonica de telefone no backend;
- busca de usuario por telefone no login;
- contrato de login por identificador generico;
- validacao de unicidade para telefone de login;
- campos administrativos para gerir a credencial telefonica;
- endpoint protegido para o usuario gerir o proprio telefone de login;
- testes de autenticacao por telefone;
- flags especificas para rollout do login telefonico.

## Decisoes fechadas

### 1. Telefone de login pertence ao `User`

O campo Prisma sera `telefoneLogin`, mapeado para `login_phone` em `tb_user`.

`Membro.whatsapp` continua sendo contato pastoral/operacional. Nenhuma criacao, migration ou edicao de membro deve copiar esse valor automaticamente para `User.telefoneLogin`.

### 2. Formato canonico e E.164

O backend sera a fonte de verdade da normalizacao e validacao.

Contrato:

- persistir valores como `+5511999999999`;
- exigir DDI no valor recebido pelos endpoints de escrita;
- remover espacos, parenteses e hifens antes da validacao;
- rejeitar numero invalido ou que nao possa ser representado em E.164;
- usar a mesma funcao de normalizacao na gravacao e no login.

`libphonenumber-js` deve ser dependencia direta da API se for adotada na implementacao. A presenca transitiva no lockfile nao deve ser tratada como contrato de dependencia.

### 3. Unicidade global

`telefoneLogin` sera opcional e unico globalmente, assim como o e-mail atual.

Motivo:

- o login tenant nao solicita slug ou identificador do tenant;
- um telefone sem contexto de tenant precisa resolver no maximo um `User`;
- unicidade apenas por tenant deixaria o login ambiguo.

### 4. E-mail continua obrigatorio

Esta entrega nao torna `User.email` opcional. E-mail continua necessario para os fluxos atuais de ativacao, vinculacao social e administracao.

Telefone e uma credencial adicional, nao um substituto cadastral do e-mail.

### 5. Um unico campo de identificador no novo contrato

O contrato canonico de login passa a usar:

```json
{
  "identificador": "email@exemplo.com ou +5511999999999",
  "senha": "******"
}
```

Para evitar quebra de PWAs ou clientes ainda carregando a versao anterior, o backend deve aceitar temporariamente o payload legado:

```json
{
  "email": "email@exemplo.com",
  "senha": "******"
}
```

Regras:

- exatamente um entre `identificador` e `email` deve ser informado;
- quando `email` for usado, executar somente o caminho de e-mail;
- quando `identificador` contiver `@`, executar o caminho de e-mail;
- nos demais casos, executar normalizacao e busca telefonica;
- nunca aceitar valores conflitantes nos dois campos;
- registrar a retirada futura do alias `email` como debito posterior, somente depois que clientes antigos deixarem de depender dele.

### 6. A senha local e a mesma

Login por telefone reutiliza `User.senhaHash`. Nao existe uma segunda senha para telefone.

Um usuario sem `senhaHash` continua dependendo de login social e nao pode entrar por telefone ate criar uma senha pelo fluxo ja existente em `Meu Perfil`.

### 7. Gestao administrativa e autogestao protegida

No MVP:

- `ADMIN` pode cadastrar, alterar ou remover `telefoneLogin` no fluxo de usuarios em `/configuracoes`;
- o proprio usuario pode cadastrar, alterar ou remover seu telefone em `Meu Perfil` por endpoint dedicado;
- a autogestao exige senha atual valida;
- usuario exclusivamente social precisa primeiro criar uma senha pelo fluxo existente;
- alterar `Membro.whatsapp` nao altera `User.telefoneLogin`;
- alterar `User.telefoneLogin` nao altera `Membro.whatsapp`.

Como SMS/OTP esta fora do escopo, a entrega nao comprova posse do numero por mensagem. A protecao inicial sera autorizacao administrativa ou sessao autenticada com revalidacao da senha.

### 8. Fluxos atuais permanecem invariantes

- Login por e-mail continua disponivel.
- Login Google continua disponivel e nao muda sua regra de vinculacao.
- Telefone nao participa da resolucao de `UserAuthProvider`.
- `ACTIVE` continua exigindo senha local ou provedor social ativo; telefone sozinho nao e forma de acesso.
- JWT continua carregando o e-mail atual; nenhuma permissao passa a depender do telefone.
- `SUPER_ADMIN` e `/admin/login` ficam fora desta entrega.

### 9. Rollout por flags

Usar duas flags com padrao desabilitado:

- API: `PHONE_PASSWORD_LOGIN_ENABLED=false`;
- web: `NEXT_PUBLIC_PHONE_PASSWORD_LOGIN_ENABLED=false`.

Com a flag da API desabilitada:

- login por telefone e rejeitado sem afetar e-mail/senha;
- escrita de `telefoneLogin` pode permanecer bloqueada ate o inicio do rollout.

Com a flag web desabilitada:

- `/login` continua apresentando o rotulo atual de e-mail;
- controles de telefone de login ficam ocultos.

Ordem de ativacao:

1. aplicar migration e publicar API com flag desabilitada;
2. publicar web com flag desabilitada;
3. validar escrita e login em ambiente controlado;
4. habilitar API;
5. habilitar web e gerar novo build;
6. acompanhar erros `401`, `409`, `429` e falhas de normalizacao.

## Escopo

Incluido:

- campo e migration Prisma;
- dependencia/helper de normalizacao E.164 na API;
- DTO compativel com identificador novo e alias legado;
- login por telefone usando a senha local existente;
- cadastro/edicao administrativa do telefone;
- autogestao com confirmacao de senha atual;
- atualizacao de tipos, UI e i18n;
- flags de rollout;
- auditoria sem expor telefone completo;
- testes automatizados e roteiro manual dos tres metodos de login;
- atualizacao da documentacao de modelos, validacoes e navegacao quando aplicavel.

Fora do escopo:

- OTP, SMS, WhatsApp ou magic link;
- recuperacao de conta por telefone;
- tornar e-mail opcional;
- usar ou sincronizar automaticamente `Membro.whatsapp`;
- alterar o login de `SUPER_ADMIN`;
- criar usuario automaticamente a partir de um telefone;
- verificar posse do numero por canal externo;
- remover o alias legado `email` do endpoint nesta entrega.

## Plano de execucao

### Etapa 0 - Preparacao e contrato

Status: concluida para planejamento

Tarefas:

- [x] Atualizar `development` e criar branch dedicada.
- [x] Registrar o backlog `FT-010`.
- [x] Mapear schema, login, status, ativacao, OAuth, gestao de usuarios e Meu Perfil atuais.
- [x] Confirmar que telefone e senha, nao SMS/OTP, e o objetivo.
- [x] Fechar separacao entre `User.telefoneLogin` e `Membro.whatsapp`.
- [x] Fechar formato E.164, unicidade global e compatibilidade do DTO.
- [x] Fechar gestao administrativa, autogestao e estrategia de rollout.

Valor entregue:

- contrato tecnico fechado antes de migration e alteracoes de autenticacao.

### Etapa 1 - Modelo de dados e normalizacao

Status: pendente

Tarefas:

- [ ] Adicionar `telefoneLogin String? @unique @map("login_phone")` em `User`.
- [ ] Criar migration com coluna nullable e indice unico.
- [ ] Nao executar backfill de `Membro.whatsapp`.
- [ ] Adicionar `libphonenumber-js` como dependencia direta da API, se escolhida para o helper.
- [ ] Criar helper backend unico para limpar, validar e normalizar E.164.
- [ ] Criar erro de validacao estavel para telefone invalido.
- [ ] Atualizar seed apenas se um cenario explicito de login por telefone for necessario.
- [ ] Atualizar `ai-context/database/models.md` com o novo campo e regras.

Validacao:

- [ ] Testes unitarios do helper com Brasil, Portugal, Estados Unidos, caracteres de formatacao e entradas invalidas.
- [ ] `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma`.
- [ ] `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma`.
- [ ] Verificar SQL da migration e indice unico.

Valor entregue:

- base persistida e uma unica regra de normalizacao reutilizavel.

### Etapa 2 - Backend de login por identificador

Status: pendente

Tarefas:

- [ ] Evoluir `LoginDto` para aceitar `identificador` ou o alias legado `email`, alem de `senha`.
- [ ] Rejeitar ausencia, duplicidade ou conflito entre os identificadores.
- [ ] Manter busca por e-mail para payload legado e identificador com `@`.
- [ ] Normalizar e buscar por `telefoneLogin` nos demais casos quando a flag estiver ativa.
- [ ] Preservar codigos `ACCOUNT_PENDING_ACTIVATION` e `ACCOUNT_DISABLED`.
- [ ] Preservar bloqueio de tenant inativo e `SUPER_ADMIN` no login tenant.
- [ ] Retornar mensagem generica para usuario inexistente, telefone invalido ou senha incorreta.
- [ ] Reutilizar `createSessionForUser()` depois da verificacao de senha para eliminar divergencia entre sessao/auditoria do login por e-mail e telefone.
- [ ] Atualizar Swagger e exemplos do endpoint.
- [ ] Adicionar `PHONE_PASSWORD_LOGIN_ENABLED` e documentar em `.env.example`.

Validacao:

- [ ] Login por e-mail no payload novo.
- [ ] Login por e-mail no payload legado.
- [ ] Login por telefone formatado e em E.164.
- [ ] Senha incorreta nos dois identificadores.
- [ ] Telefone invalido e telefone inexistente sem enumeracao de conta.
- [ ] Bloqueios de `PENDING`, `DISABLED` e tenant inativo por telefone.
- [ ] Login telefonico bloqueado com flag desabilitada sem regressao do e-mail.
- [ ] Rate limit continua aplicado ao endpoint compartilhado.

Valor entregue:

- backend autentica o mesmo `User` por e-mail ou telefone e emite uma sessao indistinguivel.

### Etapa 3 - Escrita e gestao administrativa

Status: pendente

Tarefas:

- [ ] Adicionar `telefoneLogin` opcional a `CreateUserDto` e `UpdateUserDto`.
- [ ] Aceitar `null` na edicao para remover a credencial telefonica.
- [ ] Normalizar antes de verificar conflito e persistir.
- [ ] Retornar `409 Conflict` quando o telefone pertencer a outro `User`.
- [ ] Incluir `telefoneLogin` nos selects/respostas administrativas necessarios.
- [ ] Atualizar `User` em `apps/web/src/types/index.ts`.
- [ ] Adicionar campo `Telefone de login` ao `UsuarioModal` com explicacao de que nao e o WhatsApp do membro.
- [ ] Permitir preencher, editar e remover o telefone na tela de usuarios.
- [ ] Exibir o telefone de forma responsiva na listagem/configuracao sem mistura-lo com `Membro.whatsapp`.
- [ ] Registrar auditoria de inclusao, alteracao e remocao usando valor mascarado ou apenas ultimos digitos.
- [ ] Respeitar a flag para impedir configuracao antes do rollout.

Validacao:

- [ ] Criar usuario sem telefone.
- [ ] Criar usuario com telefone valido.
- [ ] Rejeitar telefone duplicado em criacao e edicao.
- [ ] Editar e remover telefone existente.
- [ ] Confirmar que vincular/editar membro nao sincroniza `whatsapp`.
- [ ] Validar modal e listagem em desktop e mobile.

Valor entregue:

- administradores conseguem provisionar a nova credencial com regras consistentes.

### Etapa 4 - Autogestao em Meu Perfil

Status: pendente

Tarefas:

- [ ] Criar DTO dedicado com `senhaAtual` e `telefoneLogin` nullable.
- [ ] Criar endpoint autenticado, por exemplo `PATCH /auth/me/login-phone`.
- [ ] Exigir `User.status = ACTIVE`, tenant ativo e `senhaHash` existente.
- [ ] Validar a senha atual antes de incluir, trocar ou remover o telefone.
- [ ] Orientar usuario exclusivamente social a criar sua primeira senha antes de gerir o telefone.
- [ ] Aplicar normalizacao, unicidade e auditoria iguais ao fluxo administrativo.
- [ ] Incluir secao `Telefone de login` em `Meu Perfil`, separada do WhatsApp de contato.
- [ ] Exibir telefone atual com tratamento adequado de privacidade.
- [ ] Atualizar contexto/tipos do usuario somente onde necessario.

Validacao:

- [ ] Usuario adiciona telefone com senha correta.
- [ ] Senha incorreta bloqueia inclusao, troca e remocao.
- [ ] Usuario social sem senha recebe orientacao para criar senha.
- [ ] Conflito com telefone de outro usuario retorna erro amigavel.
- [ ] Alterar telefone de login nao altera WhatsApp e vice-versa.
- [ ] Sessao atual continua valida conforme politica definida.

Valor entregue:

- usuarios de qualquer role conseguem gerir a propria credencial sem acesso administrativo.

### Etapa 5 - Tela de login, tipos e traducoes

Status: pendente

Tarefas:

- [ ] Substituir estado `email` por `identificador` na tela `/login` quando a flag estiver ativa.
- [ ] Usar `type="text"` e `autoComplete="username"` para suportar e-mail e telefone.
- [ ] Enviar `{ identificador, senha }` no novo frontend.
- [ ] Manter o payload e rotulo atuais quando a flag estiver desabilitada.
- [ ] Alterar rotulo para `E-mail ou telefone` e adicionar exemplo internacional.
- [ ] Atualizar erro generico para nao enumerar e-mail ou telefone.
- [ ] Preservar estados `403`, `401`, `429`, carregamento e erro de conexao.
- [ ] Preservar botao Google e redirect seguro existente.
- [ ] Atualizar `LoginDto` frontend.
- [ ] Atualizar `pt-BR`, `pt-PT` e `en-US`.

Validacao:

- [ ] Login por e-mail continua funcional na nova UI.
- [ ] Login por telefone funciona com teclado/autocomplete adequados em mobile.
- [ ] Login Google permanece visivel e funcional.
- [ ] Redirect por role e onboarding permanece igual para os tres metodos.
- [ ] Flag desabilitada preserva a experiencia atual.
- [ ] Responsividade e acessibilidade basica do formulario.

Valor entregue:

- usuario escolhe e-mail, telefone ou Google na mesma experiencia de entrada.

### Etapa 6 - Integracao com ativacao, status e login social

Status: pendente

Tarefas:

- [ ] Confirmar que `telefoneLogin` nao ativa conta `PENDING` sozinho.
- [ ] Confirmar que usuario `ACTIVE` sem `senhaHash` nao consegue login telefonico.
- [ ] Confirmar que criar a primeira senha habilita e-mail/telefone sem alterar provedores.
- [ ] Confirmar que regras de desvinculacao social continuam baseadas em `senhaHash` ou outro provedor ativo.
- [ ] Confirmar que alterar e-mail nao altera telefone e nao quebra `UserAuthProvider` existente.
- [ ] Confirmar que o JWT e o guard continuam independentes do telefone.
- [ ] Revisar respostas de `/auth/me`, ativacao e listagem para evitar exposicao desnecessaria.

Validacao:

- [ ] Matriz `ACTIVE`, `PENDING`, `DISABLED` por e-mail, telefone e Google.
- [ ] Usuario somente social cria senha, cadastra telefone e entra com telefone.
- [ ] Usuario com telefone continua entrando por e-mail apos troca do telefone.
- [ ] Desvinculacao social permanece segura quando existe senha local.
- [ ] Onboarding habilitado e desabilitado preserva o destino correto.

Valor entregue:

- nova credencial integrada sem enfraquecer os invariantes atuais de acesso.

### Etapa 7 - Documentacao, rollout e validacao final

Status: pendente

Tarefas:

- [ ] Atualizar `ai-context/database/models.md`.
- [ ] Atualizar `ai-context/business-rules/validation-rules.md`.
- [ ] Atualizar `ai-context/frontend/navigation-rules.md` se houver impacto real de UX/navegacao.
- [ ] Atualizar documentacao do login social somente se algum texto assumir e-mail como unico login local.
- [ ] Atualizar `.env.example` da API e web.
- [ ] Registrar comandos executados e resultados neste plano.
- [ ] Executar roteiro manual com e-mail, telefone e Google.
- [ ] Validar rollout com flags desabilitadas antes da ativacao.
- [ ] Revisar diff completo e atualizar status/checklists com o resultado real.

Validacao tecnica prevista:

- [ ] `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma`.
- [ ] `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma`.
- [ ] testes unitarios direcionados da API.
- [ ] `npm.cmd run build -w apps/api`.
- [ ] typecheck/build relevante do frontend.
- [ ] `npm.cmd run build -w apps/web`.
- [ ] `git diff --check`.

Valor entregue:

- codigo, migration, documentacao e roteiro operacional prontos para verificacao manual e handoff.

## Matriz minima de aceite

| Cenario | E-mail + senha | Telefone + senha | Google |
|---|---:|---:|---:|
| `ACTIVE` com senha e telefone | permite | permite | permite se vinculado |
| `ACTIVE` com senha e sem telefone | permite | bloqueia genericamente | permite se vinculado |
| `ACTIVE` sem senha e com Google | bloqueia | bloqueia | permite se vinculado |
| `PENDING` | bloqueia com codigo especifico | bloqueia com codigo especifico | somente ativacao por link valido |
| `DISABLED` | bloqueia com codigo especifico | bloqueia com codigo especifico | bloqueia com codigo especifico |
| tenant inativo | bloqueia | bloqueia | bloqueia |
| flag telefonica desabilitada | permite | bloqueia | permite |

## Documentacao a atualizar durante a implementacao

- `ai-context/database/models.md`
- `ai-context/business-rules/validation-rules.md`
- `ai-context/frontend/navigation-rules.md`, se aplicavel
- `ai-context/plans/phone-password-login-plan.md`
- `.env.example` da API e web
- Swagger/DTOs de autenticacao e usuarios
- tipos e traducoes do frontend

## Riscos e mitigacoes

### Numeros duplicados ou mal formatados

Risco: o mesmo numero ser persistido em representacoes diferentes ou atribuido a usuarios diferentes.

Mitigacao: helper E.164 unico no backend, indice unico e testes de concorrencia/conflito.

### Quebra de clientes antigos

Risco: PWAs com bundle anterior continuam enviando `email`.

Mitigacao: manter alias legado no DTO durante a transicao e remover apenas em entrega futura observada.

### Enumeracao de contas

Risco: respostas diferentes revelarem se e-mail ou telefone existe.

Mitigacao: mensagem `401` generica, mesmo comportamento para identificador invalido/inexistente e rate limit compartilhado.

### Telefone sem comprovacao de posse

Risco: numero ser cadastrado incorretamente ou sem pertencer ao usuario.

Mitigacao: no MVP, somente administrador autorizado ou usuario autenticado com senha atual valida pode alterar. Verificacao por OTP fica registrada como evolucao futura.

### Confusao entre telefone de login e WhatsApp

Risco: telas ou services sincronizarem silenciosamente duas finalidades diferentes.

Mitigacao: campos, labels, DTOs e endpoints separados; nenhum backfill ou sincronizacao automatica.

### Divergencia entre e-mail, telefone e social

Risco: cada metodo aplicar regras diferentes de status, tenant, sessao ou redirect.

Mitigacao: reutilizar validacoes e criacao de sessao existentes e validar a matriz completa antes do rollout.

## Evolucoes futuras

- [ ] Confirmacao de posse por SMS ou WhatsApp.
- [ ] Recuperacao de conta por telefone verificado.
- [ ] Indicador `phoneVerifiedAt` caso verificacao seja implementada.
- [ ] Remocao do alias legado `email` do DTO de login apos janela de compatibilidade.
- [ ] Avaliar telefone como alternativa cadastral ao e-mail em uma iniciativa separada.
