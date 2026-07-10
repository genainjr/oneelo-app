# Plano - Limites por plano do tenant

Status: pendente

## Objetivo

Corrigir a regra de limite de membros para que ela respeite o plano contratado do tenant, eliminando bloqueios indevidos em tenants `PROFISSIONAL` e reduzindo o ajuste manual de `limiteMembros`.

## Contexto

- O sistema hoje bloqueia criacao de membros com base apenas em `tenant.limiteMembros`.
- O tenant pode estar com `plano = PROFISSIONAL` e ainda assim sofrer bloqueio se `limiteMembros` estiver baixo.
- O tenant do tipo `PROFISSIONAL` precisa evoluir para uma leitura de membros ilimitados ou uma representacao equivalente acordada pelo produto.
- O limite manual foi ajustado temporariamente para `200`, mas isso nao resolve a definicao estrutural de `ilimitado`.

## Mapeamento dos problemas

- O `plano` do tenant existe, mas nao dirige a regra de bloqueio em `MembrosService`.
- `limiteMembros` funciona hoje como unica fonte de verdade, o que mistura precificacao com override operacional.
- `PROFISSIONAL` ainda nao tem comportamento formal de ilimitado.
- O Super Admin cria tenants com plano, mas nao estabelece automaticamente o limite coerente com esse plano.
- Alterar o numero manualmente no banco resolve pontualmente, mas deixa a regra fragil e inconsistente.

## Decisao inicial

- Nao remover o campo `limiteMembros` nesta entrega.
- Introduzir uma regra oficial de limite por plano.
- Tratar `PROFISSIONAL` como ilimitado ou como um valor sentinela acordado pelo produto.
- Manter `limiteMembros` como override tecnico apenas se for necessario para transicao ou clientes legados.

## Hipotese inicial

- O problema e de modelagem de regra, nao de UI.
- A correção pode ser pequena se o limite for calculado em um helper central.
- O maior risco e espalhar a nova regra em mais de um ponto sem centralizacao.

## Etapas

### Etapa 1 - Fechamento da regra

- [ ] Definir oficialmente a equivalencia de limite por plano.
- [ ] Decidir como representar `ilimitado` no dominio.
- [ ] Confirmar se `limiteMembros` vira override ou apenas legada.
- [ ] Identificar todos os pontos que hoje consultam o limite numerico.

Resultado esperado:

- regra unica e documentada para plano, limite e ilimitado.

### Etapa 2 - Backend de membros

- [ ] Centralizar a validacao de limite em um helper de dominio.
- [ ] Ajustar a criacao de membros para respeitar o plano contratado.
- [ ] Garantir que `PROFISSIONAL` nao seja bloqueado por limite numerico fixo.
- [ ] Preservar o comportamento dos tenants `GRATUITO` e `BASICO`.

Resultado esperado:

- bloqueio de criacao passa a seguir a regra oficial do plano.

### Etapa 3 - Super Admin e tenant

- [ ] Ajustar criacao e edicao de tenant para refletir a regra oficial.
- [ ] Definir se o Super Admin pode sobrescrever o limite manualmente.
- [ ] Garantir que novos tenants recebam configuracao coerente com o plano escolhido.
- [ ] Se necessario, preparar backfill para tenants existentes.

Resultado esperado:

- tenants novos e antigos ficam alinhados com a mesma regra de plano.

### Etapa 4 - Validacao

- [ ] Testar criacao de membro em tenant `GRATUITO`.
- [ ] Testar criacao de membro em tenant `BASICO`.
- [ ] Testar criacao de membro em tenant `PROFISSIONAL`.
- [ ] Validar se o limite manual ainda funciona quando intencional.
- [ ] Registrar riscos residuais.

Resultado esperado:

- tenant profissional deixa de bloquear membros indevidamente.

## Riscos

- Se `ilimitado` for modelado como numero sentinela, pode haver novas regras de validacao futuras.
- Se o limite ficar espalhado em varios services, a inconsistência volta.
- Tenants antigos podem precisar de backfill para evitar divergencia entre plano e limite.
- O Super Admin pode precisar de ajuste de interface caso o limite deixe de ser editado manualmente em alguns planos.

## Criterios de aceite

- O bloqueio de membros respeita o plano do tenant.
- `PROFISSIONAL` nao bloqueia criacao por limite numerico comum.
- `GRATUITO` e `BASICO` continuam com seus tetos esperados.
- A regra de limite fica centralizada e documentada.
- O comportamento manual nao quebra tenants legados.

## Status atual

- Etapa 1 pendente.
- Etapa 2 pendente.
- Etapa 3 pendente.
- Etapa 4 pendente.
