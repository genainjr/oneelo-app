# Regras de Negocio e Validacoes do SaaS

Este documento descreve regras operacionais, validacoes estruturais e controle de permissao do SaaS de gestao para igrejas.

---

## 1. Permissoes e RBAC

O backend e a fonte de verdade para autorizacao. O frontend pode ocultar menus e acoes, mas nunca deve ser considerado barreira de seguranca.

Perfis globais:

- `ADMIN`: administrador do tenant.
- `STAFF`: equipe operacional global do tenant.
- `BASIC`: membro comum; pode ganhar poderes contextuais por ministerio.
- `SUPER_ADMIN`: administrador da plataforma Lookup Labs.

Papeis ministeriais:

- `LEADER`: lider do ministerio.
- `ASSISTANT_LEADER`: co-lider do ministerio.
- `MEMBER`: participante.

### Matriz resumida

| Acao | ADMIN | STAFF | BASIC lider/co-lider | BASIC comum |
|---|---:|---:|---:|---:|
| Gerir membros globais | sim | sim | nao | nao |
| Visualizar membros globais | sim | sim | nao | nao |
| Visualizar membros do proprio ministerio | sim | sim | sim | nao |
| Gerir ministerios | sim | sim | nao | nao |
| Gerir membros do proprio ministerio | sim | sim | sim | nao |
| Promover alguem a `LEADER` | sim | sim | nao | nao |
| Promover alguem a `ASSISTANT_LEADER` | sim | sim | sim, com restricoes | nao |
| Gerir escalas do proprio ministerio | sim | sim | sim | nao |
| Visualizar escalas do proprio ministerio | sim | sim | sim | nao |
| Confirmar/recusar propria escala | sim | sim | sim | sim |
| Ver perfil proprio | sim | sim | sim | sim |
| Alterar propria senha | sim | sim | sim | sim |

Detalhes completos: `ai-context/backlog/permissions-matrix.md`.

### Regra contextual de ministerio

Um usuario `BASIC` so pode gerir um ministerio quando:

1. possui `memberId`;
2. participa do ministerio por `MinisterioMembro`;
3. seu `MinisterioMembro.role` e `LEADER` ou `ASSISTANT_LEADER`.

A validacao deve ser feita no backend via `AuthorizationService` quando a regra depende de carregar uma entidade para descobrir o `ministerioId`.

Regras de seguranca para lider/co-lider:

- Pode adicionar membros ao proprio ministerio.
- Pode adicionar como `MEMBER` ou `ASSISTANT_LEADER`.
- Nao pode definir `LEADER`.
- Nao pode alterar/remover outro `LEADER`.
- Nao pode alterar o proprio papel ministerial.
- Nao pode agir em ministerios onde nao lidera/co-lidera.

---

## 2. Limitacao de Membros Ativos por Plano

Para controle de uso do SaaS, a insercao de membros respeita `Tenant.limiteMembros`.

Regra:

```txt
totalAtivos < limiteMembros
```

Fluxo:

1. Buscar o tenant autenticado.
2. Contar membros ativos do tenant, respeitando `deletedAt: null`.
3. Se o limite foi atingido, retornar `403 Forbidden`.

A quota bloqueia criacao de novos membros, mas nao deve bloquear atualizacao de membros existentes.

---

## 3. Soft Delete e Inatividade de Membros

Membros nao devem ser removidos fisicamente quando ha historico operacional associado.

- Exclusao logica: preencher `deletedAt`.
- Leitura: o Prisma estendido filtra `deletedAt: null`.
- Atualizacao/visualizacao de membro excluido deve retornar `404 Not Found`.

---

## 4. Validacao Estrutural e Sanitizacao

Todas as rotas de escrita devem usar DTOs validados pelo `ValidationPipe`.

### Membro

- `nome`: obrigatorio.
- `email`: opcional, formato valido quando informado.
- `whatsapp`: opcional, formato de telefone.
- `status`: valor valido de `StatusMembro`.

### User

- `email`: obrigatorio e unico no escopo correto.
- `telefoneLogin`: opcional, unico globalmente e persistido em E.164 com DDI; pertence a `User` e nao a `Membro`.
- `Membro.whatsapp` continua sendo contato e nunca deve ser sincronizado automaticamente com `User.telefoneLogin`; no cadastro de usuario, pode apenas preencher o campo vazio como sugestao editavel antes da confirmacao do administrador.
- `status`: `PENDING`, `ACTIVE` ou `DISABLED`; login diario so e permitido para `ACTIVE`.
- `senha`: minimo definido pelo DTO quando informada; persistida como `senhaHash`.
- `senhaHash`: pode ser nula enquanto a conta estiver pendente ou quando o acesso for exclusivamente social.
- Criacao de usuario do tenant pode omitir senha; nesse caso a conta nasce `PENDING` e recebe link de ativacao.
- Link de ativacao deve armazenar apenas hash do token, ter expiracao e ser de uso unico.
- Alteracao da propria senha exige senha atual valida e nova senha com minimo definido pelo DTO.
- Conta autenticada por provedor social e ainda sem `senhaHash` pode criar a primeira senha sem informar senha atual; o backend exige ao menos um provedor ativo nesse caso.
- `role`: valor valido de `Role`.
- `memberId`: opcional; quando usado por `BASIC`, viabiliza permissoes contextuais de ministerio.

#### Ciclo de acesso e ativacao

- `PENDING`: nao permite login diario por senha ou provedor social.
- `ACTIVE`: permite login somente quando existe `senhaHash` ou ao menos um `UserAuthProvider` ativo.
- `DISABLED`: bloqueia login por senha e social com orientacao para procurar o administrador.
- O guard autenticado consulta o estado atual do usuario e do tenant; desativacoes bloqueiam tambem sessoes JWT ja emitidas.
- O administrador nao pode mudar um usuario para `ACTIVE` sem senha e sem provedor social ativo.
- A criacao sem senha gera token aleatorio, persiste somente seu hash e define expiracao de 72 horas.
- Regenerar o link substitui o hash anterior; portanto, somente o link mais recente permanece valido.
- Ativacao por senha ou Google preenche `activatedAt`, remove os dados do token e cria a sessao autenticada.
- Um token expirado, reutilizado, substituido ou pertencente a usuario que deixou de ser `PENDING` deve ser rejeitado.

#### Login e ativacao social

- Login Google diario exige usuario `ACTIVE` e vinculo `UserAuthProvider` ativo.
- O primeiro vinculo diario exige e-mail Google verificado, usuario interno preexistente com o mesmo e-mail e confirmacao explicita.
- A ativacao Google de usuario `PENDING` so pode comecar pelo link de ativacao valido.
- Na ativacao Google, o e-mail verificado deve ser igual ao e-mail do usuario pendente.
- Identidade Google ja vinculada a outro usuario e conflito de provedor devem bloquear a ativacao.
- O fluxo de login social nao cria usuarios internos automaticamente.
- Um provedor nao pode ser removido se isso deixar um usuario `ACTIVE` sem senha e sem outro provedor ativo.

#### Login por telefone e senha

- O login tenant aceita e-mail ou `telefoneLogin` com a mesma `senhaHash`.
- Telefone deve ser normalizado pelo backend antes da gravacao, verificacao de unicidade e consulta.
- A web usa o idioma apenas para sugerir o pais inicial, permite troca de pais e converte o numero nacional para E.164 antes do envio.
- O endpoint aceita temporariamente o payload legado `{ email, senha }` e usa `{ identificador, senha }` como contrato novo.
- Telefone sozinho nao e forma valida de acesso: usuario precisa possuir `senhaHash`.
- Autogestao do telefone exige usuario `ACTIVE`, tenant ativo e confirmacao da senha atual.
- Usuario exclusivamente social precisa criar sua primeira senha antes de cadastrar telefone de login.
- Erros de credencial nao devem revelar se e-mail ou telefone esta cadastrado.
- SMS, OTP e recuperacao por telefone permanecem fora desta entrega.

#### Onboarding inicial

- Quando `NEXT_PUBLIC_ONBOARDING_ENABLED=true`, todo usuario autenticado com `onboardingCompletedAt = null` deve ser direcionado para `/onboarding`.
- Com a flag ausente ou igual a `false`, nenhuma verificacao de onboarding bloqueia login, ativacao ou navegacao autenticada.
- A migration e o seed nao preenchem `onboardingCompletedAt`; usuarios existentes tambem passam pelo fluxo.
- O campo e gravado somente ao concluir a ultima etapa e seguir para a revisao em Meu Perfil.
- Fora do iOS, indisponibilidade de instalacao PWA ou notificacoes nao pode bloquear a conclusao.
- No Safari do iOS, o usuario precisa adicionar o PWA e abri-lo pelo icone antes de avancar para notificacoes.
- Permissao de notificacoes continua opcional em todas as plataformas.

#### Notificacoes de aniversario

- O backend executa o job diariamente as 08:00 no fuso `America/Sao_Paulo`.
- Somente membros ativos, nao excluidos e com data de nascimento participam da selecao.
- O aniversariante com usuario ativo recebe uma mensagem pessoal vinculada ao tenant.
- Os demais membros com usuario ativo recebem uma unica mensagem por tenant, consolidada quando houver mais de um aniversariante.
- O envio reutiliza `PushSubscription` e `NotificationsService.sendToUsers`; nao existe persistencia adicional de notificacoes.
- Usuarios sem subscription push ativa nao recebem o push, sem bloquear o processamento dos demais.

### Ministerio

- `nome`: obrigatorio.
- `tenantId`: sempre derivado da sessao no backend.
- `ativo`: usado para arquivamento logico.
- `usaEscalas`: controla novas escalas e novas necessidades de escala; default `true`.
- Ao desativar `usaEscalas`, bloquear se houver evento `AGENDADO`, do dia atual em diante no fuso `America/Sao_Paulo`, com `requerEscala = true`.
- Escalas existentes permanecem visiveis e gerenciaveis mesmo depois da desativacao.

### MinisterioMembro

- `ministerioId`: ministerio do mesmo tenant.
- `membroId`: membro do mesmo tenant.
- `role`: `LEADER`, `ASSISTANT_LEADER` ou `MEMBER`.
- `podeSerEscalado`: elegibilidade contextual para escalas; default `true`.
- Sem funcoes configuradas, um vinculo elegivel pode atuar em todas as funcoes; com funcoes, somente nas selecionadas.
- Alteracoes de papel devem obedecer a matriz RBAC.

### Escala

- `ministerioId`: ministerio ativo, do mesmo tenant e com `usaEscalas = true` para novas escalas.
- `data`: data valida.
- Mutacoes devem validar permissao sobre o ministerio da escala.
- Visualizacoes administrativas de escala devem respeitar o mesmo escopo de
  ministerio usado para gestao.
- A visualizacao individual de escalas deve retornar somente itens vinculados ao
  `memberId` do usuario autenticado.

### Evento em lote

- `POST /api/eventos/lote` preserva as mesmas permissões e validações ministeriais da criação individual.
- O lote contém de 1 a 200 ocorrências e cobre uma janela máxima de 366 dias.
- Cada ocorrência exige `dataInicio` ISO; `dataFim`, quando informada, deve ser posterior e permanecer no mesmo dia operacional em `America/Sao_Paulo`.
- Datas iniciais repetidas no mesmo payload são rejeitadas.
- Evento existente com o mesmo título normalizado e a mesma data inicial bloqueia todo o lote e retorna as datas conflitantes.
- Todas as ocorrências e relações ministeriais são criadas em uma única transação.
- As ocorrências são eventos independentes; não existe série persistida, edição coletiva ou criação automática de escala.

### EscalaItem

- `membroId`: membro ativo do mesmo tenant.
- O membro deve pertencer ao ministerio da escala e ter `podeSerEscalado = true`.
- A funcao deve pertencer ao ministerio e respeitar as funcoes configuradas no vinculo.
- `funcao`: obrigatoria quando a escala usa funcao textual.
- Confirmacao/recusa deve ser limitada ao proprio membro escalado, exceto quando a regra do modulo permitir administracao por gestor.

---

## 5. Navegacao por Perfil

- `BASIC` comum entra por padrao em `/minhas-escalas`.
- `BASIC` comum nao deve acessar dashboard administrativo, membros, financeiro, grupos, integracoes ou configuracoes.
- `BASIC` lider/co-lider ve `Ministerios` e `Escalas`, com escopo limitado aos seus ministerios.
- A sidebar deve iniciar com secoes internas recolhidas por padrao.

Detalhes: `ai-context/frontend/navigation-rules.md`.
