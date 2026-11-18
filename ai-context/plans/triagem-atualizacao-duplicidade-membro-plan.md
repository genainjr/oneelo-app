# Plano - Triagem de Auto-Cadastro com Revisão, Atualização de Membro Existente e Fluxo de Acesso

Status geral: concluido  
Data de criação: 2026-11-15  
Branch sugerida para implementação: feature/triagem-atualizacao-duplicidade-membro  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Plano de Auto-Cadastro Público e Triagem Pastoral (FT-018)](novo-membro-auto-cadastro-plan.md)
- [Backlog FT-018: Formulário Público e Auto-Cadastro](../backlog/novo-membro-auto-cadastro.md)
- [Plano de Recadastramento e Auto-Preenchimento](recadastramento-membros-auto-preenchimento-plan.md)
- [Decisões Arquiteturais](../architecture/decisions.md)
- [Decisões de RBAC e Autorização](../architecture/rbac-decisions.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [Padrão de CRUD e Modais ODS](../../ai-core/skills/oneelo-design-system/CRUD_STANDARD.md)

---

## 1. Objetivo da Entrega

Resolver a limitação atual da fila de triagem em `/membros?tab=fichas` (`SolicitacoesTriagemTab`) quando uma ficha pública enviada em `/join/[slug]` coincide com um cadastro já existente na igreja (especialmente um **membro `ATIVO`** identificado por CPF, telefone, e-mail ou nome exato).

Com esta entrega, administradores e equipe (`ADMIN` / `STAFF`) passam a conseguir, na própria triagem:
1. **Visualizar o contexto real da duplicidade no card da ficha:** saber imediatamente se o registro coincidente é `VISITANTE` ou `ATIVO` (ou outra `FICHA_PENDENTE`) e qual é a situação de acesso desse membro (`sem usuário`, `usuário pendente de ativação`, `usuário já ativo`, `usuário desativado` ou `usuário administrativo`).
2. **Revisar e atualizar dados cadastrais sem duplicar o membro:** abrir um modal de comparação **Cadastro Atual × Ficha Recebida** para selecionar quais informações novas ou atualizadas devem ser gravadas no cadastro existente e anexar o histórico pastoral nas observações — inclusive quando a pessoa preencheu por engano a aba `Visitante` no formulário público.
3. **Conduzir corretamente o fluxo de usuário (acesso ao aplicativo):**
   - Membro sem usuário → quando houver e-mail válido final e criação de acesso estiver habilitada, cria conta `BASIC` + `PENDING` vinculada ao mesmo `Membro` e abre o modal de boas-vindas com link de ativação para WhatsApp (sem criar um segundo `Membro` e sem consumir vaga extra do plano).
   - Membro com usuário `BASIC` `PENDING` → sincroniza com segurança e-mail/telefone/nome alterados na revisão (sem falso conflito contra o próprio usuário), regenera novo link de ativação (72h) em transação e abre o modal de envio no WhatsApp.
   - Membro com usuário já `ACTIVE`, `DISABLED` ou perfil `ADMIN`/`STAFF` → atualiza apenas os dados cadastrais do `Membro`, conclui a ficha como `APROVADO` sem erro de conflito (`409`), sem criar conta duplicada, sem reativar conta desativada e sem sobrescrever credenciais/perfis de acesso.
4. **Prevenir criação acidental de duplicatas:** substituir a ambiguidade do botão único `"Aprovar Cadastro"` em fichas com match por um fluxo guiado de **Revisar e Atualizar Cadastro Existente**, preservando a saída explícita de novo cadastro apenas para homônimos reais (`NOME_EXATO`).

---

## 2. Contexto e Diagnóstico

1. **Bloqueio visual na fila de triagem (`apps/web/src/components/app/solicitacoes-triagem-tab.tsx`):**
   - Hoje o botão `"Vincular ao Visitante Existente"` só é renderizado quando `item.duplicidade.membroExistenteStatus === 'VISITANTE'` e `item.tipo === 'MEMBRO'`.
   - Quando a coincidência ocorre com um membro `ATIVO` (ex.: match de `CPF`, `TELEFONE`, `EMAIL` ou `NOME_EXATO`), a tela exibe apenas um alerta rosa passivo (`"Cadastro similar existente: ... (CPF)"`) e mantém o botão `"Aprovar Cadastro"`.
2. **Comportamento destrutivo/frustrante ao aprovar (`apps/api/src/modules/membros/solicitacoes-cadastro.service.ts`):**
   - Sem `vincularMembroId`, `aprovarSolicitacao` executa o fluxo de **novo membro**: tenta inserir um segundo registro em `tb_member` (consumindo mais uma vaga da cota do plano) e cria um novo `User`.
   - Se o e-mail ou telefone já existir em `tb_user`, `createPendingBasicUserInTx` (`apps/api/src/modules/auth/auth.service.ts`) lança `ConflictException` (`"Já existe um usuário com este e-mail."` / `"Este telefone já está em uso por outro usuário."`), revertendo a transação sem atualizar nada.
   - Se não houver `User` prévio com aquele e-mail/telefone, o sistema cria um **membro duplicado** no banco de dados.
3. **Ordem de ramos, nulos e concorrência em `aprovarSolicitacao`:**
   - Hoje `if (solicitacao.tipo === TipoSolicitacaoCadastro.VISITANTE)` retorna **antes** de avaliar `if (options.vincularMembroId)` — ignorando qualquer tentativa de vincular/atualizar quando a pessoa enviou a ficha na aba `Visitante` — além de não gravar `cpf` ao criar novo `VISITANTE`.
   - A verificação `solicitacao.status !== PENDENTE` é feita fora de `$transaction`, abrindo brecha para dupla aprovação concorrente.
   - O código passa `email: solicitacao.email!` diretamente para `createPendingBasicUserInTx`; caso uma ficha `VISITANTE` (onde `email` é opcional no DTO) seja promovida sem e-mail, ocorreria erro `500` em `.trim()` em vez de `400 BadRequestException`.
4. **Atualização insuficiente no vínculo existente:**
   - Mesmo na rota `vincularMembroId`, `aprovarSolicitacao` usa `existingMembro.nome || solicitacao.nome` e `existingMembro.cpf ?? solicitacao.cpf` — impedindo que a secretaria atualize campos corrigidos ou mais recentes enviados pela pessoa na nova ficha.
5. **Falta de contexto do `Membro` e do `User` no motor de duplicidade (`apps/api/src/modules/membros/member-deduplication.helper.ts`):**
   - `DuplicityCheckResult` retorna apenas `membroExistenteId`, `membroExistenteNome`, `membroExistenteStatus` e `motivoDuplicidade`.
   - O frontend não recebe o snapshot atual do membro para comparação nem o status da relação `user` (`NONE` / `PENDING` / `ACTIVE` / `DISABLED` / `ADMIN` / `STAFF`), além de `listSolicitacoes` executar `checkMemberDuplicity` dentro de um loop `for` realizando consultas repetidas (`N+1`) por ficha.
6. **Feedback enganoso quando não há link de ativação (`apps/web/src/components/app/welcome-activation-modal.tsx`):**
   - Quando `activationLink` é nulo, o modal ainda exibe título `"Cadastro Aprovado com Sucesso!"`, subtítulo de entrada no sistema e caixa `"Mensagem Oficial de Acolhimento"` para WhatsApp, inadequados para quem já é membro ativo e teve apenas o cadastro atualizado.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Contrato Enriquecido do Motor de Duplicidade (`member-deduplication.helper.ts`)
- Expandir `DuplicityCheckResult` com campos opcionais seguros (somente metadados cadastrais necessários ao tenant, sem expor `senhaHash` ou `activationTokenHash`):
  - `membroExistente?: { id, nome, whatsapp, email, cpf, dataNascimento, sexo, estadoCivil, observacoes, status }`
  - `usuarioExistente?: { id, role, status, ativo, email, telefoneLogin } | null`
- Introduzir contexto pré-carregado opcional (`preloadedContext`) em `checkMemberDuplicity` para que `listSolicitacoes` consulte `tb_member` (com resumo seguro de `user`) e solicitações `PENDENTE` uma única vez por listagem, eliminando consultas `N+1`.
- Preservar o escopo de `StatusMembro` `[ATIVO, VISITANTE]` com `deletedAt: null` e `tenantId` isolado.
- **Comportamento para `FICHA_PENDENTE`:** como `FICHA_PENDENTE` indica outra submissão pendente ainda sem `Membro` consolidado, `membroExistenteId` permanece `undefined`; a ficha exibe apenas o aviso de solicitação concorrente na listagem. Ao aprovar uma das fichas e recarregar a fila (`loadItems()`), a outra ficha passa automaticamente a apontar o `Membro` recém-criado e libera o fluxo de revisão/vínculo.

### 3.2. Contrato de Aprovação com Mesclagem Seletiva, Concorrência e Gestão de Acesso (`AprovarSolicitacaoDto` e `SolicitacoesCadastroService`)
- Expandir `AprovarSolicitacaoDto` em `apps/api/src/modules/membros/solicitacoes-cadastro.controller.ts`:
  - `vincularMembroId?: string`
  - `camposAtualizar?: SolicitacaoMergeField[]` (lista branca validada com `@IsArray()` e `@IsIn(['nome', 'whatsapp', 'email', 'cpf', 'dataNascimento', 'sexo', 'estadoCivil'])`)
  - `anexarObservacoes?: boolean` (default `true`)
  - `criarOuRegenerarAcesso?: boolean` (default `true` quando aplicável ao tipo `MEMBRO` / promoção)
  - `promoverParaAtivo?: boolean` (permite manter `VISITANTE` ou promover a `ATIVO` na revisão; default `true` quando `solicitacao.tipo === 'MEMBRO'`)
  - `permitirCriarNovoMesmoDuplicado?: boolean` (exclusivo para homônimos `NOME_EXATO`)
- **Padronização de contrato de retorno (`userAccessOutcome`):**
  - Unificar o retorno de `aprovarSolicitacao` com o campo tipado `userAccessOutcome: 'CREATED' | 'REGENERATED' | 'ALREADY_ACTIVE' | 'DISABLED' | 'PROTECTED_ROLE' | 'NONE'`, além de `membro`, `user` e `activationLink` (`string | null`).
- **Garantia transacional, precedência e anti-duplicata no backend:**
  - **Claim atômico dentro de `$transaction`:** revalidar e reivindicar a ficha `PENDENTE` dentro da transação (ex.: `tx.solicitacaoCadastroMembro.updateMany` condicionando `{ id, tenantId, status: StatusSolicitacaoCadastro.PENDENTE }` ou bloqueio transacional antes de qualquer criação/edição) para impedir dupla aprovação simultânea.
  - **Precedência de vínculo sobre `tipo`:** avaliar `if (options.vincularMembroId)` **antes** de `if (solicitacao.tipo === TipoSolicitacaoCadastro.VISITANTE)` para que fichas enviadas como `VISITANTE` que coincidam com membro/visitante existente também passem pelo fluxo de revisão e atualização controlada (e garantir que novo `VISITANTE` também persista `cpf: solicitacao.cpf ?? null`).
  - **Proteção no fluxo sem vínculo (`!vincularMembroId`):** reexecutar `checkMemberDuplicity` dentro da transação antes de criar novo registro:
    - Match `CPF` → sempre lança `409 ConflictException` (nunca permite bypass via `permitirCriarNovoMesmoDuplicado`).
    - Match `TELEFONE` ou `EMAIL` → lança `409 ConflictException` exigindo vínculo/revisão (evita duplicata e colisão global de `User.email`/`telefoneLogin`).
    - Match `NOME_EXATO` → lança `409 ConflictException` salvo quando `permitirCriarNovoMesmoDuplicado === true` (homônimo real confirmado).
- **Matriz transacional determinística quando `vincularMembroId` estiver presente:**
  - **Validação de pertencimento e campos:** busca `existingMembro` com `{ id: vincularMembroId, tenantId, deletedAt: null }` incluindo `user`. Aplica somente os campos autorizados em `camposAtualizar` respeitando normalizações (mantendo fallback automático de campos nulos apenas quando `camposAtualizar` não for enviado, garantindo retrocompatibilidade total com chamadas antigas).
  - **Invariante de status do membro e cota (`canAddMember`):**
    - Se `existingMembro.status === StatusMembro.ATIVO`, o status **permanece obrigatoriamente `ATIVO`** (nunca sofre downgrade para `VISITANTE` mesmo em ficha `VISITANTE`) e **não** consome nova vaga na cota do plano.
    - Se `existingMembro.status !== StatusMembro.ATIVO` e `promoverParaAtivo === true` (ou default de `tipo === 'MEMBRO'`), valida `canAddMember(tenant, totalAtivos)` antes de promover para `ATIVO`.
  - **Regra de usuário vinculado (`existingMembro.user`):**
    1. `existingMembro.user === null` e deve conceder acesso (`criarOuRegenerarAcesso !== false` e membro ficará `ATIVO`):
       - Calcula `finalEmail = (updatedMembro.email || solicitacao.email || '').trim().toLowerCase()`. Se vazio, lança `400 BadRequestException` explícito (eliminando `solicitacao.email!` não verificado).
       - Executa `authService.createPendingBasicUserInTx(...)` retornando `activationLink` e `userAccessOutcome: 'CREATED'`.
       - Caso `criarOuRegenerarAcesso === false` (ou permanência como `VISITANTE`), atualiza apenas o `Membro` e retorna `userAccessOutcome: 'NONE'`.
    2. `existingMembro.user !== null` com `role === Role.BASIC` e `status === UserStatus.PENDING`:
       - Se `nome`, `email` (não nulo/não vazio) ou `whatsapp` foram atualizados no `Membro`, sincroniza os dados correspondentes no `User` pendente checando unicidade global em `tb_user` com **`NOT: { id: existingMembro.user.id }`** (evitando falso conflito `409` com a própria conta) e tratando telefone inválido de forma previsível via helper de normalização.
       - Quando `criarOuRegenerarAcesso !== false`, chama helper transacional `authService.regeneratePendingActivationInTx(tx, ...)` gerando novo link válido por 72h e retornando `userAccessOutcome: 'REGENERATED'` (ou `'NONE'` com `activationLink: null` caso desmarcado).
    3. `existingMembro.user !== null` com `status !== UserStatus.PENDING` (`ACTIVE` ou `DISABLED`) ou `role !== Role.BASIC` (`ADMIN` / `STAFF`):
       - **Proteção estrita de acesso e RBAC:** nunca cria usuário duplicado, nunca reativa usuário `DISABLED`, nunca regenera token e nunca altera `email`, `telefoneLogin` ou `role` dessa conta. Atualiza apenas o `Membro`, marca a ficha como `APROVADO` (`membroId: updatedMembro.id`, `userId: existingMembro.user.id`), retorna `activationLink: null` e `userAccessOutcome` correspondente (`'PROTECTED_ROLE'` | `'DISABLED'` | `'ALREADY_ACTIVE'`).
- Registrar `AuditLog` completo com `payloadBefore` e `payloadAfter` dos campos atualizados e ação tomada sobre o acesso (`userAccessOutcome`).

### 3.3. Experiência de Revisão Side-by-Side (ODS Frontend)
- Novo componente `apps/web/src/components/app/solicitacao-duplicidade-modal.tsx` utilizando `ModalShell` (`size="lg"` com corpo rolável e rodapé fixo), `ModalError` e tokens do tema ativo (`bg-brand`, `text-accent-ink`, `bg-accent-soft`, `border-accent-soft-border`):
  - **Cabeçalho contextual:** informa se o registro existente é `Membro Ativo` ou `Visitante`, o critério do match (`CPF`, `Telefone`, `E-mail`, `Nome Exato`) e a situação da conta vinculada (`Sem acesso ao app`, `Convite pendente`, `Acesso já ativo`, `Acesso desativado` ou `Conta administrativa protegida`).
  - **Comparação campo a campo (Atual × Ficha Recebida):**
    - Exibe `Nome completo`, `WhatsApp`, `E-mail`, `CPF`, `Data de Nascimento`, `Sexo` e `Estado Civil`, com formatação segura de data UTC (`YYYY-MM-DD`, sem deslocamento de fuso horário) e rótulos legíveis em PT-BR para enums de sexo e estado civil.
    - **Pré-seleção inteligente:** campos vazios no cadastro atual que vieram preenchidos na ficha já vêm marcados (`"Novo dado"`); campos onde ambos têm valores diferentes vêm desmarcados com destaque visual (`"Valor divergente"`) para decisão consciente da secretaria; campos idênticos ficam recolhidos/discretos.
    - Checkbox separado `"Anexar dados pastorais/observações desta ficha ao histórico do membro"` (marcado por padrão quando houver `igrejaAnterior`, `quemConvidou`, `batizadoAguas` ou `observacoes`).
  - **Bloco explícito de Fluxo de Usuário:**
    - Para membro sem usuário: toggle *"Criar usuário de acesso e gerar link de ativação"* (marcado por padrão quando `tipo === 'MEMBRO'`; se não houver e-mail no membro nem na ficha após seleção, desabilitar o toggle com aviso explícito de que e-mail é necessário para acesso).
    - Para membro com usuário `BASIC` `PENDING`: toggle *"Gerar novo link de ativação (72h) e atualizar contato pendente se alterado"* (marcado por padrão).
    - Para usuário `ACTIVE`, `DISABLED` ou `ADMIN`/`STAFF`: banner informativo específico indicando que apenas os dados cadastrais do `Membro` serão atualizados, sem gerar novo usuário, sem reativar conta bloqueada e sem alterar credenciais.
- **Botões no card (`solicitacoes-triagem-tab.tsx`):**
  - Quando `item.duplicidade.isDuplicate && item.duplicidade.membroExistenteId`:
    - O bloco de alerta cobre tanto `VISITANTE` quanto `ATIVO` com mensagem específica para cada cenário e ação principal **"Revisar e Atualizar Cadastro"** (abrindo `SolicitacaoDuplicidadeModal`).
    - O rodapé do card remove a aprovação direta cega como novo: exibe **"Rejeitar Ficha"** + CTA primário **"Revisar e Atualizar Existente"** (e, somente quando o motivo for `NOME_EXATO`, opção explícita secundária para criar cadastro separado caso seja homônimo).
  - Quando `item.duplicidade.motivoDuplicidade === 'FICHA_PENDENTE'` (`!membroExistenteId`): mantém o alerta de ficha pendente concorrente sem tentar abrir o modal de vínculo com membro.
- **Fluxo pós-aprovação e `welcome-activation-modal.tsx`:**
  - Quando `res.activationLink` existir (`CREATED` ou `REGENERATED`) ou na aprovação de novo `VISITANTE` sem usuário, mantém o fluxo de abertura do `WelcomeActivationModal`.
  - Quando a atualização ocorrer **sem geração de novo link** (`ALREADY_ACTIVE`, `DISABLED`, `PROTECTED_ROLE` ou `NONE` em atualização cadastral), **não abrir** `WelcomeActivationModal` com texto enganoso de boas-vindas/primeiro acesso — exibir um feedback claro de confirmação de atualização cadastral na própria `SolicitacoesTriagemTab`.

### 3.4. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Sobrescrita indesejada de dados corretos no cadastro antigo | Média | Alto | Comparação lado a lado no modal: campos já preenchidos divergentes vêm desmarcados por padrão; somente lacunas vêm pré-marcadas. |
| Conflito `409` falso ou real ao sincronizar e-mail/telefone em usuário `PENDING` | Média | Médio | Checagem prévia em `tb_user` excluindo o próprio `user.id` (`NOT: { id }`), exibindo eventuais conflitos reais inline no `ModalError`. |
| Alteração indevida ou reativação acidental de conta `ACTIVE`/`DISABLED`/`ADMIN`/`STAFF` | Baixa | Crítico | Bloqueio estrito no backend (`SolicitacoesCadastroService`): nunca toca `User` se `role !== BASIC` ou `status !== PENDING`. |
| Erro `500` por e-mail nulo ao promover visitante ou dupla aprovação simultânea | Média | Alto | Validação explícita de e-mail final com `400 BadRequestException` + claim atômico de ficha `PENDENTE` dentro de `$transaction`. |
| Ficha `VISITANTE` coincidente com membro `ATIVO` gerar duplicata ou rebaixamento | Alta (hoje) | Alto | Avaliar `vincularMembroId` antes do ramo `VISITANTE` e proibir downgrade de `StatusMembro.ATIVO`. |
| Criação acidental de segundo membro com mesmo CPF | Alta (hoje) | Alto | Bloquear criação direta como novo no backend e na UI sempre que houver match de `CPF` (sem exceção por homônimo). |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Preparação, Branch e Baseline
Status: concluido

- [x] Confirmar repositório limpo na branch `development` e atualizar com `git pull`
- [x] Criar a branch `feature/triagem-atualizacao-duplicidade-membro` a partir de `development`
- [x] Registrar baseline de testes e typecheck nos pacotes afetados:
  - [x] Executar `npx jest src/modules/membros/solicitacoes-triagem.service.spec.ts src/modules/membros/solicitacoes-routing.spec.ts` em `apps/api`
  - [x] Executar `npx -w apps/web tsc --noEmit`
- [x] Critério de validação da etapa: Branch `feature/triagem-atualizacao-duplicidade-membro` ativa sobre `development` atualizada e baseline verde registrado.

### Etapa 1 - Enriquecimento do Motor de Duplicidade e Resumo de Vínculo (Backend)
Status: concluido

- [x] Atualizar `apps/api/src/modules/membros/member-deduplication.helper.ts`:
  - [x] Expandir `DuplicityCheckResult` com `membroExistente` (dados cadastrais comparáveis) e `usuarioExistente` (`id`, `role`, `status`, `ativo`, `email`, `telefoneLogin` ou `null`)
  - [x] Incluir seleção segura da relação `user` na consulta de membros `ATIVO` e `VISITANTE` do tenant (sem expor hashes ou segredos)
  - [x] Adicionar parâmetro opcional `preloadedContext` em `checkMemberDuplicity` preservando compatibilidade para chamadas isoladas e comportamento de `FICHA_PENDENTE` sem `membroExistenteId`
- [x] Atualizar `apps/api/src/modules/membros/solicitacoes-cadastro.service.ts` (`listSolicitacoes`):
  - [x] Pré-carregar membros elegíveis (com resumo de `user`) e fichas `PENDENTE` do tenant uma única vez antes do mapeamento de duplicidade
- [x] Atualizar/expandir testes em `apps/api/src/modules/membros/solicitacoes-triagem.service.spec.ts`:
  - [x] Validar retorno de `membroExistente` e `usuarioExistente` para membro sem usuário, com usuário `PENDING`, `ACTIVE`, `DISABLED` e `ADMIN`/`STAFF`
- [x] Critério de validação da etapa: Testes unitários do módulo de membros passando (`npx jest src/modules/membros` em `apps/api`) e `npm.cmd run build -w apps/api` sem erros.

### Etapa 2 - Contrato de Aprovação/Mesclagem Seletiva e Fluxo de Acesso em Transação (Backend)
Status: concluido

- [x] Refatorar `apps/api/src/modules/auth/auth.service.ts`:
  - [x] Extrair helper `regeneratePendingActivationInTx(tx, params)` reutilizável por `regenerateActivationLink` e transações externas (validando `status === UserStatus.PENDING`)
  - [x] Preservar 100% do comportamento existente do endpoint de regeneração em `apps/api/src/modules/auth/auth.service.spec.ts`
- [x] Atualizar DTO `AprovarSolicitacaoDto` em `apps/api/src/modules/membros/solicitacoes-cadastro.controller.ts`:
  - [x] Adicionar campos opcionais validados `camposAtualizar`, `anexarObservacoes`, `criarOuRegenerarAcesso`, `promoverParaAtivo` e `permitirCriarNovoMesmoDuplicado`
- [x] Evoluir `aprovarSolicitacao` em `apps/api/src/modules/membros/solicitacoes-cadastro.service.ts`:
  - [x] Realizar claim atômico da solicitação `PENDENTE` dentro de `$transaction` para evitar dupla aprovação concorrente
  - [x] Avaliar `options.vincularMembroId` antes do ramo `solicitacao.tipo === TipoSolicitacaoCadastro.VISITANTE` (e persistir `cpf` também na criação de novo `VISITANTE`)
  - [x] Aplicar atualização seletiva de campos autorizados (`nome`, `whatsapp`, `email`, `cpf`, `dataNascimento`, `sexo`, `estadoCivil`) com normalizações e fallback retrocompatível quando `camposAtualizar` for omitido
  - [x] Preservar `StatusMembro.ATIVO` (nunca rebaixar para `VISITANTE`) e validar cota (`canAddMember`) somente quando houver promoção de não-ativo para `ATIVO`
  - [x] Validar e-mail final antes de `createPendingBasicUserInTx` (lançando `400 BadRequestException` se vazio ao tentar criar conta)
  - [x] Sincronizar contato de usuário `BASIC` `PENDING` checando unicidade global com `NOT: { id: existingUser.id }` + chamar `regeneratePendingActivationInTx` quando aplicável
  - [x] Proteger contas `ACTIVE`, `DISABLED` e `ADMIN`/`STAFF` retornando `userAccessOutcome` padronizado (`CREATED` | `REGENERATED` | `ALREADY_ACTIVE` | `DISABLED` | `PROTECTED_ROLE` | `NONE`) e `activationLink: null`
  - [x] Bloquear criação de novo membro sem vínculo quando houver duplicata na transação (CPF sempre `409`; Telefone/Email exigem vínculo; `NOME_EXATO` exige `permitirCriarNovoMesmoDuplicado: true`)
  - [x] Registrar `payloadBefore` e `payloadAfter` detalhados no `AuditLog`
- [x] Expandir suítes de teste em `apps/api/src/modules/membros/solicitacoes-triagem.service.spec.ts` e `apps/api/src/modules/membros/solicitacoes-routing.spec.ts`:
  - [x] Cobrir atualização seletiva em membro `ATIVO` sem usuário (gera acesso sem cobrar cota; retorna `400` se não houver e-mail final)
  - [x] Cobrir atualização em membro `ATIVO` com usuário `PENDING` (inclusive mantendo mesmo e-mail/telefone sem falso `409` e regenerando link 72h)
  - [x] Cobrir proteção para usuário `ACTIVE`, `DISABLED` e `ADMIN`/`STAFF` (atualiza `Membro`, preserva acesso e conclui ficha sem `409`)
  - [x] Cobrir vínculo de ficha `VISITANTE` em membro `ATIVO` sem rebaixamento e bloqueio de criação duplicada por `CPF` mesmo com `permitirCriarNovoMesmoDuplicado: true`
  - [x] Validar `ValidationPipe` do novo `AprovarSolicitacaoDto` em `solicitacoes-routing.spec.ts`
- [x] Critério de validação da etapa: Todos os specs em `apps/api/src/modules/membros/*.spec.ts` e `apps/api/src/modules/auth/auth.service.spec.ts` passando, e `npm.cmd run build -w apps/api` verde.

### Etapa 3 - Modal de Revisão Side-by-Side e Fluxo Pós-Aprovação (Frontend ODS)
Status: concluido

- [x] Criar componente `apps/web/src/components/app/solicitacao-duplicidade-modal.tsx`:
  - [x] Utilizar `ModalShell` (`size="lg"`), `ModalError` e tokens do tema ativo (`bg-brand`, `text-accent-ink`, `bg-accent-soft`)
  - [x] Exibir card de resumo do membro coincidente (status do membro, critério do match e estado da conta: `Sem acesso`, `Pendente`, `Ativo`, `Desativado` ou `Admin/Staff`)
  - [x] Renderizar comparação campo a campo (**Atual × Ficha Recebida**) com formatação segura de data UTC, rótulos PT-BR de enums, pré-seleção automática apenas para campos novos e seleção manual explícita para divergências
  - [x] Incluir controle de anexação de observações pastorais e controle contextual do fluxo de usuário (desabilitando criação de acesso com alerta claro caso não haja e-mail final válido)
  - [x] Exibir erros `400`/`409` da API inline dentro do modal via `ModalError`
- [x] Atualizar `apps/web/src/components/app/solicitacoes-triagem-tab.tsx`:
  - [x] Tipar `SolicitacaoItem.duplicidade` com `membroExistente` e `usuarioExistente`, e o retorno de aprovação com `userAccessOutcome`
  - [x] Unificar alertas de duplicidade para `VISITANTE` e `ATIVO`, mantendo `FICHA_PENDENTE` (`!membroExistenteId`) apenas como alerta informativo concorrente
  - [x] Substituir ação cega de `"Aprovar Cadastro"` em cards com `membroExistenteId` pela ação primária **"Revisar e Atualizar Cadastro"** abrindo `SolicitacaoDuplicidadeModal` (mantendo opção secundária de cadastro separado apenas para `NOME_EXATO`)
  - [x] Exibir feedback de confirmação inline na aba quando a atualização concluir sem gerar link (`activationLink === null`), sem abrir `WelcomeActivationModal` com mensagem de primeiro acesso
- [x] Conferir/ajustar `apps/web/src/components/app/welcome-activation-modal.tsx`:
  - [x] Garantir que `WelcomeActivationModal` seja usado apenas para fluxos com `activationLink` gerado/regenerado ou novo visitante sem duplicata
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` passando sem erros, além de validação visual desktop/mobile do fluxo na aba de fichas pendentes.

### Etapa 4 - Documentação, Testes Integrados e Validação Final
Status: concluido

- [x] Atualizar `ai-context/backlog/novo-membro-auto-cadastro.md` registrando o suporte a revisão/atualização de membros ativos duplicados e continuidade de acesso
- [x] Atualizar todos os checkboxes deste plano (`ai-context/plans/triagem-atualizacao-duplicidade-membro-plan.md`) e seu status no índice `ai-context/plans/README.md` refletindo `Status geral: concluido`
- [x] Executar bateria de testes backend afetados (`npx jest src/modules/membros src/modules/auth` em `apps/api`)
- [x] Executar verificação de tipos e build de produção do frontend e backend (`npx -w apps/web tsc --noEmit`, `npm.cmd run build -w apps/web`, `npm.cmd run build -w apps/api`)
- [x] Validar ponta a ponta o cenário reproduzido em mobile (`390x844`) e desktop: ficha duplicada por CPF atualizando dados de membro ativo e gerando/preservando usuário conforme o caso
- [x] Critério de validação da etapa: Builds e testes verdes em `apps/api` e `apps/web` e fluxos validados sem regressão ou duplicação de registros.

---

## 5. Critérios de Aceite Gerais

- [x] Uma ficha com duplicidade detectada contra membro `ATIVO` ou `VISITANTE` exibe o diagnóstico completo no card (status do membro + situação do usuário de acesso) e oferece o fluxo de revisão sem exigir rejeição manual e edição externa.
- [x] No modal de revisão, a secretaria visualiza lado a lado o valor atual e o valor da ficha recebida (com datas e enums formatados), tendo lacunas pré-marcadas e divergências sob escolha consciente.
- [x] Ao confirmar atualização de membro `ATIVO` **sem usuário** (com e-mail válido), o sistema atualiza os campos selecionados do mesmo `Membro`, **não** consome cota extra do plano, cria o `User` (`BASIC` `PENDING`) vinculado e exibe o `WelcomeActivationModal` com link para WhatsApp.
- [x] Ao confirmar atualização de membro `ATIVO` **com usuário `PENDING`**, o sistema atualiza `Membro` e dados pendentes no `User` (sem falso conflito `409` contra si mesmo), gera novo link de ativação válido por 72h e permite envio no WhatsApp.
- [x] Ao confirmar atualização de membro `ATIVO` **com usuário `ACTIVE`, `DISABLED` ou `ADMIN`/`STAFF`**, o sistema atualiza apenas os dados escolhidos no `Membro`, preserva intactas as credenciais/status do usuário, conclui a ficha como `APROVADO` sem erro `409` e exibe confirmação clara sem abrir modal enganoso de boas-vindas.
- [x] Em nenhum cenário de vínculo/atualização um novo `Membro` duplicado é inserido em `tb_member`, nem um membro `ATIVO` é rebaixado para `VISITANTE`.
- [x] Todas as permissões são aplicadas no backend (`@Roles(Role.ADMIN, Role.STAFF)` e isolamento estrito por `tenantId`), protegidas contra dupla aprovação concorrente e registradas em `AuditLog`.
