# Filtros, convite de ativacao e aniversarios

## Objetivo

Entregar um pacote de melhorias para membros e usuarios:

- buscas textuais sem distincao entre maiusculas, minusculas ou acentos;
- link de ativacao apontando para o frontend correto em producao;
- copia do link como mensagem completa de boas-vindas;
- notificacoes diarias de aniversario para aniversariantes e demais membros.

## Decisoes

- A normalizacao textual sera feita sem depender da extensao PostgreSQL `unaccent`.
- `CORS_ORIGIN`, ja existente na API, sera a fonte da origem publica usada nos links gerados.
- Quando houver mais de uma origem separada por virgula, o link usara a primeira.
- `APP_URL` nao sera usado como fallback, pois pode representar a propria API em producao.
- O fallback atual de producao e `https://oneelo.vercel.app` quando `CORS_ORIGIN` estiver ausente.
- O job de aniversario reutilizara `NotificationsService.sendToUsers` e `PushSubscription`.
- Quando houver varios aniversariantes no mesmo tenant, os demais membros receberao uma unica notificacao consolidada.
- Nenhuma nova tabela de notificacao sera criada nesta entrega.
- O convite copiado informa a data e a hora exatas de `activationExpiresAt` no fuso de Brasilia.

## Etapas

- [x] Confirmar `development` atualizada e criar branch de feature.
- [x] Mapear filtros, ativacao e jobs de notificacao existentes.
- [x] Implementar e testar normalizacao de filtros.
- [x] Corrigir origem do link de ativacao e documentar ambiente.
- [x] Copiar convite completo de boas-vindas no frontend.
- [x] Implementar e testar job diario de aniversarios.
- [x] Executar testes, typechecks/builds e revisar o diff.

## Resultado da validacao

- 9 testes unitarios passaram em 4 suites.
- Build do backend NestJS passou.
- Typecheck isolado do frontend passou.
- Build de producao do Next.js passou.
- `git diff --check` passou.
- O typecheck amplo da API continua bloqueado por erros preexistentes nos testes E2E legados, sem erros nos fontes compilados pelo build.
- O lint direcionado continua expondo dividas preexistentes de `no-unsafe-*`, `no-explicit-any` e hooks nos arquivos antigos; os builds e testes relevantes passaram.

## Validacao prevista

- Testes unitarios dos helpers de busca e do job de aniversario.
- Testes do `AuthService` para URL local, configurada e fallback de producao.
- Typecheck e build de `apps/api` e `apps/web`.
- `git diff --check`.
