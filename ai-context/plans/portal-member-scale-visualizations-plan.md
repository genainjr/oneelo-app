# Plano - Visualizacoes de membros e escalas no portal

> Status: concluido
> Ultima atualizacao: 2026-06-10

---

## Resumo

Este plano cobre a criacao de visualizacoes de consulta para membros e escalas
dentro do portal, usando como referencia os dois documentos operacionais hoje
mantidos em planilha:

- `docs/ccrv_registros.xlsx`
- `docs/escalas_ccrv_junho-2026.xlsx`

O objetivo nao e substituir as telas atuais de gestao. As paginas existentes de
`/membros` e `/escalas` continuam sendo telas administrativas de cadastro,
edicao e montagem. O novo fluxo deve entregar telas de leitura, busca e
acompanhamento para o uso diario do portal.

---

## Fontes analisadas

### `docs/ccrv_registros.xlsx`

Planilha voltada para cadastro, consulta e segmentacao de membros.

Abas identificadas:

| Aba | Uso observado |
|---|---|
| `Cadastro geral` | Cadastro completo com status ativo, nome, nascimento, CPF, estado civil, sexo, telefone, titulo, flags de ministerio, aniversario, idade, faixa de idade e link WhatsApp |
| `Aniversariantes` | Lista consolidada de aniversarios ordenada para consulta |
| `Membros por Ministerios` | Visao de membros filtrada/organizada para ministerios |
| `WhatsApp` | Lista rapida de contatos e link de WhatsApp |

Campos com equivalencia direta no sistema atual:

| Planilha | Sistema |
|---|---|
| `Nome` | `Membro.nome` |
| `Ativo` | `Membro.status` |
| `Telefone` | `Membro.whatsapp` |
| `Data de Nascimento` / `Aniversario` | `Membro.dataNascimento` |
| Colunas de ministerio (`Obreiros`, `Louvor`, etc.) | `MinisterioMembro` |
| `Funcao` ou funcoes por ministerio | `MinisterioMembroFuncao` / `MinisterioFuncao` |

Campos ainda nao modelados diretamente no cadastro atual:

- `Codigo`
- `CPF`
- `Estado Civil`
- `Sexo`
- `Titulo`
- `Idade`
- `Faixa de Idade`
- `Aniversario Ordem`
- `Aniversario Mes`
- `Link`

Decisao inicial: a visualizacao deve usar os dados ja existentes no banco e
derivar idade/faixa/aniversario quando possivel. Campos sensiveis ou ainda nao
modelados, como CPF, nao entram na primeira entrega de portal.

### `docs/escalas_ccrv_junho-2026.xlsx`

Planilha voltada para geracao e visualizacao mensal de escalas por ministerio.

Abas identificadas:

| Aba | Uso observado |
|---|---|
| `Louvor` | Grade mensal com colunas por funcao musical |
| `Obreiros` | Grade mensal com dia, data e funcoes como Portaria, Templo e Limpeza |
| `Infantil` | Grade mensal por faixas etarias |
| `Geral` | Consolidado por data e funcoes de varios ministerios |

Campos com equivalencia direta no sistema atual:

| Planilha | Sistema |
|---|---|
| Ministerio/aba | `Ministerio` |
| Mes/ano | `Escala.mes` e `Escala.ano` |
| Dia/Data | `EscalaDia.data` |
| Coluna de funcao | `MinisterioFuncao` |
| Nome escalado na celula | `EscalaItem.membro` |
| Celula vazia/oculta | `EscalaDiaFuncaoOculta` ou ausencia de item |

---

## Estado atual encontrado

- `/membros` ja existe, mas e uma tela de gestao com cadastro, edicao,
  exclusao, tags e acoes em lote.
- `/membros/exportacao` existe para saida de dados, nao para consulta
  operacional.
- `/escalas` ja existe, mas e uma grade de montagem e manutencao de escala.
- `/escalas/exportacao` existe para exportacao, nao para leitura no portal.
- `/minhas-escalas` existe para o membro autenticado, mas hoje carrega a lista
  de escalas e depois busca detalhes escala por escala. Isso resolve o basico,
  mas nao e a melhor base para uma visualizacao rica ou performatica.

Conclusao: o portal precisa separar claramente:

```txt
Gerenciar = criar, editar, excluir, montar, alterar status.
Visualizar = consultar, filtrar, acompanhar, imprimir e confirmar quando aplicavel.
Exportar = gerar arquivo externo.
```

---

## Decisoes de escopo

- Nao alterar os ENUMs de roles. Permanecem `ADMIN`, `STAFF`, `BASIC` e
  `SUPER_ADMIN`.
- Nao criar importador das planilhas nesta etapa. As planilhas sao referencia
  de experiencia e organizacao da informacao.
- Nao expor CPF ou outros dados sensiveis em visualizacoes amplas do portal.
- Nao substituir as paginas atuais de gestao.
- A visualizacao deve respeitar o escopo multi-tenant e as regras de RBAC ja
  documentadas.
- BASIC comum nao deve acessar listagem global de membros.
- BASIC lider/co-lider so deve visualizar membros e escalas dos ministerios que
  lidera/co-lidera, exceto as proprias escalas em `/minhas-escalas`.

---

## Rotas propostas

| Rota | Objetivo | Perfis |
|---|---|---|
| `/membros/visualizacao` | Diretoria de membros, aniversariantes, contatos e participacao ministerial | `ADMIN`, `STAFF` |
| `/ministerios/:id/membros` ou detalhe equivalente | Consulta de membros de um ministerio especifico | `ADMIN`, `STAFF`, `BASIC` lider/co-lider daquele ministerio |
| `/escalas/visualizacao` | Grade mensal/semanal de escalas em modo leitura | `ADMIN`, `STAFF`, `BASIC` lider/co-lider |
| `/minhas-escalas` | Visao individual do membro autenticado, com confirmacao/recusa | `ADMIN`, `STAFF`, `BASIC` com `memberId` |

Observacao: se o projeto preferir evitar novas rotas de ministerio, a
visualizacao ministerial de membros pode ser implementada como uma aba dentro da
pagina de detalhe/gestao de ministerio existente.

---

## Experiencia desejada

### Visualizacao de membros

Objetivo: reproduzir no portal as consultas mais usadas da planilha de cadastro,
sem transformar a pagina em uma tela pesada de edicao.

Componentes esperados:

- Busca por nome e telefone.
- Filtros por status, tag, ministerio e papel ministerial.
- Lista/tabela em ordem alfabetica.
- Cards responsivos no mobile.
- Indicadores resumidos: ativos, inativos, aniversariantes do mes, com WhatsApp,
  sem telefone.
- Aba ou bloco de aniversariantes do mes.
- Aba ou bloco de contatos rapidos com acao de WhatsApp quando houver telefone.
- Drawer/modal de detalhe somente leitura com dados basicos, tags, ministerios,
  funcoes disponiveis e historico resumido de escalas quando viavel.

### Visualizacao de escalas

Objetivo: trazer para o portal a mesma leitura mensal que hoje acontece na
planilha, mas com filtros, responsividade e confirmacoes integradas.

Componentes esperados:

- Filtro por mes, ano, ministerio, status e pendencias.
- Grade mensal em desktop:
  - linhas por dia/data;
  - colunas por funcao;
  - nomes dos membros escalados em cada celula;
  - status visual de confirmacao (`PENDENTE`, `CONFIRMADO`, `RECUSADO`);
  - celulas ocultas renderizadas como indisponiveis.
- Lista por dia no mobile, evitando tabela horizontal dificil de usar.
- Visao consolidada por ministerio e, futuramente, por todos os ministerios.
- Modo impressao da escala em formato limpo.
- Botao de abrir detalhe da escala sem controles de edicao.

### Minhas escalas

Objetivo: melhorar a visualizacao individual que ja existe.

Mudancas desejadas:

- Criar endpoint otimizado para evitar buscar detalhes de cada escala em serie.
- Separar proximas escalas, pendentes de confirmacao e historico.
- Manter confirmacao/recusa apenas em escalas publicadas.
- No mobile, priorizar cards por data, ministerio e funcao.

---

## Backend proposto

| Endpoint/Servico | Acao |
|---|---|
| `GET /api/membros/visualizacao` | Novo endpoint de leitura para diretoria de membros, com filtros e retorno enriquecido |
| `GET /api/membros/aniversariantes` | Novo endpoint opcional para aniversario por mes, derivado de `dataNascimento` |
| `GET /api/escalas/visualizacao` | Novo endpoint de leitura para grade mensal/semanal, com dados completos de dias, funcoes e itens |
| `GET /api/escalas/minhas` | Novo endpoint para retornar somente os itens do usuario vinculado ao `memberId` |
| `MembrosService` | Adicionar consultas read-only sem expor dados sensiveis |
| `EscalasService` | Adicionar consultas otimizadas para visualizacao e para minhas escalas |
| `AuthorizationService` | Reutilizar regras de tenant, ministerio e membro autenticado |

Regras importantes:

- `ADMIN` e `STAFF` podem visualizar membros e escalas do tenant.
- `BASIC` comum nao acessa visualizacao global de membros.
- `BASIC` comum acessa somente as proprias escalas.
- `BASIC` lider/co-lider acessa escalas e membros dos ministerios que
  lidera/co-lidera.
- Leituras devem ignorar membros com `deletedAt != null`.
- Leituras ministeriais devem ignorar membros inativos quando o contexto for
  operacional.

---

## Frontend proposto

| Arquivo | Acao |
|---|---|
| `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx` | Nova pagina de visualizacao de membros |
| `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx` | Nova pagina de visualizacao de escalas |
| `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx` | Evoluir para usar endpoint otimizado e layout de consulta |
| `apps/web/src/hooks/use-membros-visualizacao.ts` | Novo hook de consulta read-only |
| `apps/web/src/hooks/use-escalas-visualizacao.ts` | Novo hook de consulta read-only |
| `apps/web/src/components/app/member-profile-drawer.tsx` | Novo componente para detalhe somente leitura do membro |
| `apps/web/src/components/app/escala-readonly-grid.tsx` | Novo componente de grade de escala em modo leitura |
| `apps/web/src/components/app/sidebar.tsx` | Adicionar filho `Visualizacao` em Membros e Escalas |
| `apps/web/messages/*.json` | Adicionar labels de navegacao e textos das novas telas |

Padroes de UI:

- A visualizacao nao deve parecer uma landing page.
- Desktop deve favorecer densidade organizada e leitura rapida.
- Mobile deve usar cards por membro/dia, sem tabela comprimida.
- Usar icones nos botoes de acoes claras, mantendo labels quando necessario.
- Evitar card dentro de card.
- Nomes longos devem quebrar linha de forma previsivel, sem truncar informacao
  importante na leitura de escala.

---

## Etapas

- [x] 1. Validar nomes finais das rotas e labels de menu (`Visualizacao`)
- [x] 2. Mapear campos atuais do banco contra as planilhas e registrar lacunas
- [x] 3. Definir DTOs de filtro e retorno para visualizacao de membros
- [x] 4. Implementar endpoint read-only de membros com RBAC por perfil
- [x] 5. Implementar endpoint de aniversariantes por mes
- [x] 6. Criar pagina `/membros/visualizacao`
- [x] 7. Criar drawer/modal de detalhe somente leitura do membro
- [x] 8. Definir DTOs de filtro e retorno para visualizacao de escalas
- [x] 9. Implementar endpoint read-only de escalas com dias, funcoes e itens
- [x] 10. Implementar endpoint otimizado `/api/escalas/minhas`
- [x] 11. Criar componente `EscalaReadonlyGrid`
- [x] 12. Criar pagina `/escalas/visualizacao`
- [x] 13. Evoluir `/minhas-escalas` para usar o endpoint otimizado
- [x] 14. Ajustar sidebar e i18n para incluir `Visualizacao`
- [x] 15. Validar permissoes por regra de backend para `ADMIN`, `STAFF`, `BASIC` comum e `BASIC` lider/co-lider
- [x] 16. Rodar build da API e do Web
- [x] 17. Atualizar documentacoes de contexto afetadas

---

## Arquivos previstos

| Arquivo | Acao |
|---|---|
| `apps/api/src/modules/membros/dto/filter-membros-visualizacao.dto.ts` | Criado |
| `apps/api/src/modules/membros/membros.controller.ts` | Rotas read-only adicionadas antes de `:id` |
| `apps/api/src/modules/membros/membros.service.ts` | Consultas de visualizacao e aniversariantes |
| `apps/api/src/modules/escalas/dto/filter-escala-visualizacao.dto.ts` | Criado |
| `apps/api/src/modules/escalas/escalas.controller.ts` | Rotas read-only adicionadas |
| `apps/api/src/modules/escalas/escalas.service.ts` | Consultas otimizadas para visualizacao e minhas escalas |
| `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx` | Criado |
| `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx` | Criado |
| `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx` | Ajustado |
| `apps/web/src/hooks/use-membros-visualizacao.ts` | Criado |
| `apps/web/src/hooks/use-escalas-visualizacao.ts` | Criado |
| `apps/web/src/components/app/member-profile-drawer.tsx` | Criado |
| `apps/web/src/components/app/escala-readonly-grid.tsx` | Criado |
| `apps/web/src/components/app/sidebar.tsx` | Filhos de visualizacao adicionados |
| `apps/web/messages/pt-BR.json` | `nav.view` adicionado |
| `apps/web/messages/pt-PT.json` | `nav.view` adicionado |
| `apps/web/messages/en-US.json` | `nav.view` adicionado |
| `ai-context/frontend/navigation-rules.md` | Regras de menu atualizadas |
| `ai-context/business-rules/validation-rules.md` | Regras de visualizacao atualizadas |

---

## Criterios de aceite

- ADMIN e STAFF conseguem acessar uma visualizacao de membros sem abrir modo de
  edicao.
- A visualizacao de membros permite pesquisar e filtrar dados operacionais
  equivalentes aos usos principais da planilha `ccrv_registros.xlsx`.
- BASIC comum nao acessa listagem global de membros.
- BASIC lider/co-lider visualiza apenas membros dos ministerios que
  lidera/co-lidera, quando essa rota ministerial for disponibilizada.
- A visualizacao de escalas mostra a grade mensal por ministerio em modo
  leitura, com dias, funcoes e membros escalados.
- A grade de escala fica legivel em desktop e vira lista por dia no mobile.
- Membros ja escalados aparecem com status de confirmacao visivel.
- `/minhas-escalas` carrega a visao individual sem buscar detalhes escala por
  escala.
- Confirmar/recusar presenca continua restrito a escala publicada e ao item do
  proprio membro, salvo perfis gestores conforme regra existente.
- Sidebar mostra `Gerenciar`, `Visualizacao` e `Exportacao` sem quebrar o
  comportamento colapsado.
- `npm.cmd run build` passa em `apps/api`.
- `npm.cmd run build` passa em `apps/web`.

---

## Validacao realizada

- `npm.cmd run build` em `apps/api`: aprovado.
- `npm.cmd run build` em `apps/web`: aprovado.
- `git diff --check`: sem erros de whitespace; apenas avisos esperados de CRLF
  no Windows.

---

## Fora do escopo inicial

- Importacao automatica das planilhas.
- Cadastro de campos sensiveis adicionais, como CPF.
- Renomear ENUMs de roles.
- Geracao automatica de escalas por IA.
- Link publico nao autenticado para visualizar ou confirmar escalas.
