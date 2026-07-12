# Plano: ajustes de UX, PWA, pendencias e sessao

## Objetivo

Corrigir pontos de experiencia e regra de negocio reportados apos a liberacao do app mobile/PWA e das telas de escalas.

## Checklist

- [x] Levar usuario ao topo ao trocar pagina em tabelas paginadas.
- [x] Abrir atalho mobile na tela inicial autenticada em vez da pagina raiz.
- [x] Centralizar pendencias de escalas no backend apenas para escalas publicadas.
- [x] Bloquear membro em mais de uma funcao na mesma data, considerando todas as escalas do tenant.
- [x] Manter contadores locais do frontend coerentes com a regra de escala publicada.
- [x] Centralizar tempo de expiracao do token de usuario e alinhar cookie com JWT.
- [x] Rodar validacoes de frontend e backend.

## Decisoes

- O atalho PWA inicia em `/dashboard`; usuarios `BASIC` continuam sendo redirecionados para `/personal-panel` pelo middleware.
- A sessao de usuario passa a respeitar `JWT_EXPIRES_IN`, com padrao de `1d` quando a variavel nao estiver definida.
- A resposta de login informa `expiresIn` e `expiresAt` para facilitar diagnostico do tempo de sessao.
