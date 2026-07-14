# Backlog - Login social com OAuth

### FT-008 Base de login social vinculada ao usuario interno
- **Prioridade**: alta
- **Fase**: 2
- **Categoria**: seguranca / autenticacao / UX
- **Primeiro provedor previsto**: Google
- **Provedores futuros considerados no desenho**: Apple e outros provedores OAuth/OIDC compativeis.

## Contexto

O sistema hoje autentica apenas com e-mail e senha, gerando JWT em cookie HTTP-only. A necessidade inicial e permitir login com Google sem perder o vinculo com o usuario interno do tenant, mas a solucao nao deve nascer acoplada apenas ao Google.

O desenho deve criar uma fundacao generica de identidade externa/social login. Google deve ser a primeira entrega funcional, enquanto Apple deve ser considerado no modelo desde o inicio para evitar refatoracao estrutural posterior.

O fluxo parte do pressuposto de que o administrador do tenant cria o `User` interno antes, possivelmente com senha padrao. No primeiro acesso, o usuario pode escolher entrar com Google, sem precisar usar a senha padrao antes, desde que o e-mail verificado do Google corresponda a esse `User` interno.

## Objetivo

Permitir que um usuario interno ja existente vincule uma identidade externa no primeiro login social, mediante confirmacao explicita, e use esse provedor para autenticar no OneElo, mantendo:

- o mesmo usuario interno;
- o mesmo tenant;
- as mesmas regras de RBAC;
- a emissao atual de JWT/cookie HTTP-only;
- a possibilidade futura de adicionar Apple ou outros provedores sem remodelar a base.

## Escopo recomendado

### 1. Modelo generico de provedores

Criar uma tabela generica de identidades externas, preferencialmente vinculada a `User`, por exemplo `UserAuthProvider` ou `UserIdentity`.

Campos recomendados:

- `id`;
- `userId`;
- `provider`: enum com valores iniciais como `GOOGLE` e `APPLE`;
- `providerUserId`: identificador estavel do usuario no provedor;
- `email`;
- `emailVerified`;
- `linkedAt`;
- `lastLoginAt`;
- `createdAt`;
- `updatedAt`;
- tokens criptografados opcionais, apenas se houver necessidade real de chamar APIs do provedor depois.

Indices/restricoes recomendados:

- unico por `provider + providerUserId`;
- unico por `userId + provider`, salvo decisao explicita de permitir multiplas contas do mesmo provedor por usuario.

Observacao: evitar modelar isso como integracao de membro apenas. Login e autenticacao pertencem ao `User`. O `Membro` pode continuar vinculado ao `User` pelo modelo existente.

### 2. Fluxos distintos

Separar claramente:

- **Primeiro login social com vinculacao**: usuario clica em Google/Apple na tela de login, o sistema valida o e-mail verificado contra um `User` interno existente e solicita confirmacao explicita antes de criar o vinculo.
- **Login com provedor**: usuario entra via Google/Apple na tela de login.
- **Gestao de provedores conectados**: usuario visualiza provedores vinculados em `Meu Perfil` ou configuracoes.
- **Desvincular provedor**: usuario remove o vinculo, desde que ainda exista uma forma valida de acesso.

A vinculacao autenticada em `Meu Perfil` pode existir como caminho secundario, mas o caminho principal do MVP e o primeiro login social com confirmacao.

### 3. Regra de seguranca para login social

O login social nao deve criar usuario operacional automaticamente sem regra explicita de tenant.

Regra recomendada para o MVP:

- se ja existir vinculo `provider + providerUserId`, autenticar o `User` interno correspondente;
- se nao existir vinculo, mas o e-mail verificado corresponder a um `User` interno unico e ativo, permitir fluxo controlado de primeiro vinculo com confirmacao explicita;
- se houver ambiguidade de tenant, e-mail nao verificado, usuario inativo ou ausencia de usuario interno, bloquear com mensagem amigavel;
- nunca conceder acesso fora das regras atuais de tenant/RBAC.

### 4. Google como primeira entrega

Implementar OAuth2/OIDC com Google no backend NestJS:

- endpoint de inicio do fluxo;
- callback;
- validacao de `state`/CSRF;
- validacao de e-mail verificado;
- resolucao do usuario interno;
- criacao/atualizacao do vinculo;
- emissao do mesmo JWT/cookie atual.

### 5. Apple previsto no desenho

Mesmo que Apple nao entre na primeira entrega, o modelo deve suportar suas particularidades:

- o identificador estavel e o `sub`;
- o e-mail pode ser enviado apenas no primeiro login;
- o usuario pode usar e-mail privado relay da Apple;
- o client secret e um JWT assinado;
- callbacks e configuracoes do Apple Developer sao especificos;
- a vinculacao deve depender do `providerUserId/sub`, nao apenas do e-mail.

## Fora do escopo inicial

- Criar usuarios automaticamente para qualquer conta Google/Apple sem convite ou usuario interno previo.
- Substituir o login com senha.
- Integrar Google Calendar.
- Sincronizar foto de perfil, agenda ou contatos.
- Permitir multiplas contas do mesmo provedor por usuario, salvo decisao futura.

## Impacto esperado

- Reduz friccao no login para usuarios finais.
- Diminui dependencia de senha local.
- Mantem controle central de tenant/RBAC.
- Cria fundacao reaproveitavel para Apple e outros provedores sociais.
- Prepara a base para integracoes OAuth futuras sem misturar autenticacao com integracoes operacionais.

## Dependencias

- Credenciais OAuth do Google.
- Decisao de produto sobre Apple na primeira fase ou fase posterior.
- Definicao de URLs de callback por ambiente.
- Politica de vinculacao por e-mail verificado.
- Revisao do fluxo de recuperacao de conta.
- Possivel decisao sobre criptografia de tokens se forem armazenados.

## Arquivos afetados previstos

- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/auth/`
- `apps/api/src/modules/integrations/` ou modulo equivalente de identidade externa
- `apps/web/src/app/(auth)/login/`
- `apps/web/src/app/(dashboard)/meu-perfil/`
- `apps/web/src/app/(dashboard)/configuracoes/`
- `.env.example` do backend e, se necessario, do frontend
