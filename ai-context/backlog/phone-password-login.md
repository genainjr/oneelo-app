# Backlog - Login com telefone e senha

### FT-010 Login por numero de telefone e senha
- **Prioridade**: alta
- **Fase**: a priorizar
- **Categoria**: seguranca / autenticacao / UX
- **Esforco estimado**: medio
- **Contexto**: o login por senha aceita apenas e-mail, enquanto o telefone do membro e apenas um dado de contato.
- **Acao**: adicionar telefone normalizado ao `User` e aceitar e-mail ou telefone no mesmo fluxo de senha.
- **Impacto**: oferecer uma alternativa de acesso sem remover login por e-mail ou login social.

## Contexto

O OneElo permite autenticar usuarios do tenant por e-mail e senha e tambem por provedores sociais vinculados, atualmente com Google como primeiro provedor funcional. O usuario deve poder escolher uma terceira forma de entrada: numero de telefone e senha.

Essa nova opcao deve complementar os fluxos existentes. Login por e-mail e senha e login social devem continuar disponiveis e emitir a mesma sessao JWT em cookie HTTP-only.

O telefone usado para autenticacao pertence a `User`. O campo `Membro.whatsapp` continua sendo um dado de contato do membro e nao deve ser reutilizado automaticamente como credencial, pois hoje e opcional, nao e unico e pode conter formatos diferentes.

## Objetivo

Permitir que um usuario interno existente entre no OneElo usando:

- e-mail e senha;
- numero de telefone e senha;
- provedor social previamente vinculado.

Todos os metodos devem resolver o mesmo `User` interno e preservar tenant, role, status, RBAC, auditoria, redirecionamento e politica de sessao existentes.

## Escopo recomendado

### 1. Credencial telefonica no usuario

Adicionar a `User` um campo opcional dedicado ao telefone de login, persistido em formato canonico e com restricao de unicidade compativel com o fluxo de login sem identificacao previa do tenant.

Regras recomendadas:

- normalizar para o padrao E.164 antes de persistir e consultar;
- considerar codigo do pais e DDD obrigatorios na representacao canonica;
- rejeitar telefones duplicados entre usuarios;
- manter o campo opcional para nao bloquear usuarios legados que entram por e-mail ou login social;
- nao copiar automaticamente `Membro.whatsapp` para a credencial de `User`;
- definir um fluxo explicito e validado para cadastrar ou alterar o telefone de login.

### 2. Login por identificador e senha

Evoluir o login tenant para aceitar um identificador que possa ser e-mail ou telefone:

- se o identificador for e-mail, manter o comportamento atual;
- se for telefone, normalizar antes da busca;
- validar a mesma senha armazenada em `User.senhaHash`;
- aplicar as mesmas verificacoes de `User.status`, compatibilidade de `ativo`, tenant ativo e demais bloqueios existentes;
- emitir o mesmo JWT/cookie HTTP-only e registrar a mesma auditoria de login;
- manter mensagens genericas para credenciais invalidas, sem revelar se o e-mail ou telefone existe.

### 3. Experiencia na tela de login

Atualizar a tela `/login` para:

- apresentar um unico campo com rotulo como `E-mail ou telefone`;
- aceitar e normalizar a entrada telefonica sem prejudicar o preenchimento de e-mail;
- preservar o botao e o fluxo de login social;
- preservar redirects seguros por role, onboarding e destino solicitado;
- exibir os mesmos estados de carregamento, limite de tentativas e erro do fluxo atual.

### 4. Cadastro e manutencao

Definir onde administradores e usuarios autorizados podem cadastrar ou alterar o telefone de login. A implementacao deve:

- validar formato e unicidade no backend;
- diferenciar claramente telefone de login e telefone/WhatsApp de contato;
- impedir que uma alteracao de contato troque silenciosamente a credencial de acesso;
- registrar auditoria quando a credencial telefonica for criada, alterada ou removida;
- avaliar confirmacao adicional da posse do numero antes de habilita-lo como credencial.

## Requisitos de seguranca

- Reutilizar rate limiting e protecoes do endpoint atual de login.
- Normalizar o telefone antes da verificacao de unicidade e da consulta.
- Nao registrar senha, telefone completo ou outros dados sensiveis em logs de erro.
- Manter resposta indistinguivel para usuario inexistente, senha incorreta ou identificador invalido.
- Invalidar ou revisar sessoes quando a politica de alteracao de credencial assim exigir.
- Cobrir conflitos de telefone em criacao, edicao, ativacao e importacao de usuarios.

## Fora do escopo inicial

- Login sem senha por SMS ou WhatsApp.
- Envio de OTP ou codigo de verificacao para autenticar cada acesso.
- Substituir login por e-mail e senha.
- Substituir login social.
- Usar `Membro.whatsapp` diretamente como identificador de autenticacao.
- Criar automaticamente um novo `User` a partir de um telefone de membro.

## Criterios de aceite

- Usuario ativo com telefone de login cadastrado entra com telefone e senha.
- O mesmo usuario continua entrando com e-mail e senha.
- O mesmo usuario continua entrando por provedor social quando houver vinculo ativo.
- Todos os metodos criam a mesma sessao e aplicam as mesmas regras de tenant, status, RBAC, onboarding e redirect.
- Telefone e normalizado antes de gravacao e consulta.
- Dois usuarios nao podem compartilhar o mesmo telefone de login.
- Usuarios sem telefone cadastrado continuam usando e-mail ou login social sem migracao obrigatoria.
- Telefone de contato do membro nao se torna credencial automaticamente.
- Erros de login nao revelam se um telefone ou e-mail esta cadastrado.
- Testes cobrem login por e-mail, telefone e social, alem de duplicidade, normalizacao, usuario inativo e tenant inativo.

## Dependencias e decisoes pendentes

- Definir o fluxo de cadastro inicial do telefone de login.
- Definir se a posse do numero sera confirmada antes de habilitar a credencial e por qual canal.
- Definir politica para troca ou remocao do telefone de login.
- Definir estrategia de recuperacao de conta quando o usuario nao tiver acesso ao e-mail ou ao telefone.
- Revisar impactos em criacao de usuario, ativacao, onboarding, importacao e Meu Perfil.

## Arquivos afetados previstos

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/`
- `apps/api/src/modules/auth/dto/login.dto.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- fluxos backend de criacao e edicao de `User`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(dashboard)/meu-perfil/page.tsx`
- componentes e traducoes relacionados a autenticacao e usuarios
- testes de autenticacao backend e frontend

## Plano de desenvolvimento

- `ai-context/plans/phone-password-login-plan.md`
