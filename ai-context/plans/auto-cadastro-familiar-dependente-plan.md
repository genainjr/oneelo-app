# Plano - Fluxo Familiar e Dependente sem Celular Próprio no Auto-Cadastro (Opção A)

Status geral: concluido  
Data de criação: 2026-11-17  
Branch sugerida para implementação: feature/auto-cadastro-familiar-dependente  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Plano de Auto-Cadastro Público e Triagem Pastoral (FT-018)](novo-membro-auto-cadastro-plan.md)
- [Plano de Revisão e Atualização de Membro Existente na Triagem](triagem-atualizacao-duplicidade-membro-plan.md)
- [Backlog FT-018: Formulário Público e Auto-Cadastro](../backlog/novo-membro-auto-cadastro.md)
- [Decisões Arquiteturais](../architecture/decisions.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)

---

## 1. Objetivo da Entrega

Viabilizar o envio em sequência de fichas de familiares e crianças/dependentes sem celular próprio no formulário público (`/join/[slug]`) e a aprovação individualizada pela secretaria na fila de triagem (`/membros?tab=fichas`), mantendo o número de WhatsApp do responsável obrigatório para garantir contato da igreja sem necessidade de alteração de schema no banco de dados (Opção A).

A entrega contempla:
1. **Idempotência segura para família no envio (`submitRegistration`):** impedir que uma segunda ficha enviada com o mesmo WhatsApp sobrescreva a ficha pendente de outro familiar (ex.: pai → esposa → filha), passando a considerar reenvio apenas quando `telefone` **e** `nome` normalizado (ou `cpf` informado) coincidirem.
2. **Suporte explícito a Criança / Dependente no `/join/[slug]` (`PublicJoinClient` e DTO):** permitir marcar *"É criança / dependente sem celular próprio"*, solicitando `"Nome do responsável"` e mudando o campo para `"WhatsApp do responsável"`, registrando o vínculo de responsável nas observações sem migração Prisma.
3. **Tela pós-envio enxuta (`"Ficha Enviada com Sucesso!"`):** manter a tela de confirmação limpa apenas com os dois botões originais (`"Enviar Outro Cadastro"` e `"Voltar para o site"`), sem adicionar botões extras de atalho familiar que poluam a interface.
4. **Aprovação como Pessoa Diferente / Familiar na triagem:** liberar no card de triagem (`SolicitacoesTriagemTab`) e no backend (`aprovarSolicitacao`) a opção explícita de criar cadastro separado quando a coincidência for por **`TELEFONE`**, **`EMAIL`** ou **`NOME_EXATO`** — mantendo o bloqueio absoluto exclusivamente para **`CPF`** — além de evitar falso bloqueio de `User.telefoneLogin` caso um familiar com e-mail próprio se torne membro ativo compartilhando o WhatsApp de contato.

---

## 2. Contexto e Diagnóstico

1. **Idempotência restrita ao telefone (`apps/api/src/modules/membros/solicitacoes-cadastro.service.ts`):**
   - `submitRegistration` busca ficha `PENDENTE` apenas comparando `extractPhoneDigits(r.telefone) === phoneDigits`. Quando dois familiares preenchem o formulário antes da aprovação do primeiro, a segunda submissão sobrescreve silenciosamente a primeira ficha.
2. **Bloqueio de criação separada para familiares (`aprovarSolicitacao` e `SolicitacoesTriagemTab`):**
   - Quando o responsável já está cadastrado como `ATIVO` ou `VISITANTE`, a ficha do cônjuge ou da criança dispara duplicidade por `TELEFONE`.
   - O botão `"Criar como Pessoa Diferente"` e a flag `permitirCriarNovoMesmoDuplicado` hoje só funcionam para `NOME_EXATO`, impedindo a aprovação da criança como nova visitante/membro sem alterar o cadastro do pai.
   - Adicionalmente, se um familiar aprovado como `MEMBRO` (`permitirCriarNovoMesmoDuplicado: true`) tiver e-mail próprio mas compartilhar o telefone de contato já usado por outro `User.telefoneLogin`, `createPendingBasicUserInTx` falha com `409`.
3. **UX do formulário público (`apps/web/src/components/public-site/join/public-join-client.tsx`):**
   - O campo `WhatsApp / Celular` exige telefone sem explicar o preenchimento com o número de um responsável para crianças/dependentes, e `"Enviar Outro Cadastro"` apaga todos os campos incluindo telefone e quem convidou.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Contrato do Envio Público e Idempotência (`SubmitMemberRegistrationDto` e `submitRegistration`)
- Estender `SubmitMemberRegistrationDto` (`apps/api/src/modules/membros/dto/submit-member-registration.dto.ts`):
  - `isDependente?: boolean` (`@IsOptional() @IsBoolean()`)
  - `responsavelNome?: string` (opcional por padrão; obrigatório via `@ValidateIf((o) => Boolean(o.isDependente))` + `@IsNotEmpty()` quando `isDependente === true`).
- Sem migração no Prisma: `SolicitacaoCadastroMembro.telefone` permanece obrigatório (preenchido com o WhatsApp do responsável, mantendo compatibilidade total com `schema.prisma`). Quando `isDependente` ou `responsavelNome` estiver preenchido, registrar prefixo `[Dependente — Responsável: <nome>]` de forma idempotente em `SolicitacaoCadastroMembro.observacoes`.
- Atualizar busca `existingPending` em `submitRegistration`:
  - Considerar mesma solicitação pendente somente quando:
    1. `(cpfNorm && r.cpf && normalizeCpf(r.cpf).cpf === cpfNorm)`, OU
    2. `extractPhoneDigits(r.telefone) === phoneDigits && normalizeName(r.nome) === normalizeName(dto.nome)`.
  - Preserva idempotência quando a própria pessoa reenvia seus dados com acentos/formatação diferente, enquanto permite múltiplas fichas familiares distintas com o mesmo WhatsApp.

### 3.2. Regras de Criação de Familiar / Pessoa Diferente em `aprovarSolicitacao`
- `CPF` idêntico **continua bloqueado de forma absoluta** (nunca aceita bypass por `permitirCriarNovoMesmoDuplicado`).
- `TELEFONE`, `EMAIL` e `NOME_EXATO` passam a aceitar `permitirCriarNovoMesmoDuplicado: true`, mantendo o bloqueio `409` por padrão quando `permitirCriarNovoMesmoDuplicado` não for confirmado.
- Para novo `MEMBRO` criado com `permitirCriarNovoMesmoDuplicado: true`:
  - `Membro.whatsapp` sempre recebe o WhatsApp da ficha (permitindo envio de WhatsApp de boas-vindas ao responsável/família e notificações).
  - Antes de chamar `createPendingBasicUserInTx`, se houver outro usuário no banco usando aquele número em `User.telefoneLogin`, passar `telefoneLogin: null` para o novo `User` (que fará login via e-mail/Google sem gerar falso conflito `409` nem colisão de `@unique login_phone`). Em `SolicitacaoCadastroMembro.email` igual ao de um `User` existente, `User.email` continua `@unique` e exige e-mail próprio ao criar conta (ou fica como `VISITANTE` sem usuário).

### 3.3. Experiência no Formulário (`/join/[slug]`) e na Triagem (`/membros?tab=fichas`)
- **`public-join-client.tsx`:**
  - Toggle/checkbox `"É criança / dependente sem celular próprio"`: exibe input obrigatório `"Nome do responsável"` e adapta label/helper do telefone para `"WhatsApp do responsável"`.
  - Na tela pós-envio (`submitted === true`): manter o layout limpo original com apenas **`Enviar Outro Cadastro`** (que reinicia todos os campos do formulário, incluindo o estado de dependente) e **`Voltar para o site`**.
- **`solicitacoes-triagem-tab.tsx`:**
  - Habilitar o botão secundário **"Pessoa Diferente / Familiar"** sempre que `hasExistingMemberMatch && item.duplicidade.motivoDuplicidade !== 'CPF'` (ou seja, para `TELEFONE`, `EMAIL` e `NOME_EXATO`).
  - No modal de confirmação (`ModalShell size="sm"`), adaptar a explicação para cada critério (`TELEFONE` compartilhado entre familiares, `EMAIL` compartilhado ou `NOME_EXATO` homônimo), explicando claramente que será criado um novo registro separado sem alterar o cadastro existente.

### 3.4. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Familiar sobrescrever ficha pendente do outro ao enviar com mesmo telefone | Alta (hoje) | Alto | Idempotência por `telefone + normalizeName(nome)` (ou `cpf` coincidente). |
| Criar usuário duplicado no `User.telefoneLogin` ao aprovar familiar `MEMBRO` | Média | Médio | Checar conflito em `User.telefoneLogin` quando `permitirCriarNovoMesmoDuplicado === true` e usar `telefoneLogin: null` preservando `Membro.whatsapp`. |
| Criar dois cadastros para o mesmo `CPF` por engano | Baixa | Alto | Nunca exibir `"Pessoa Diferente"` nem permitir `permitirCriarNovoMesmoDuplicado` quando `motivoDuplicidade === 'CPF'`. |
| Criança sem WhatsApp do responsável ficar incomunicável | Baixa | Médio | Opção A mantém telefone do responsável obrigatório (`InternationalPhoneInput required`). |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Branch e Baseline
Status: concluido

- [x] Confirmar repositório limpo na branch `development` e atualizar com `git pull`
- [x] Criar a branch `feature/auto-cadastro-familiar-dependente` a partir de `development`
- [x] Registrar plano em `ai-context/plans/auto-cadastro-familiar-dependente-plan.md` e índice `ai-context/plans/README.md`
- [x] Critério de validação da etapa: Branch criada sobre `development` atualizada e baseline backend (`jest src/modules/membros`) verde.

### Etapa 1 - DTO, Idempotência por Familiar e Aprovação de Pessoa Diferente (Backend)
Status: concluido

- [x] Atualizar `apps/api/src/modules/membros/dto/submit-member-registration.dto.ts`:
  - [x] Adicionar campos validados `isDependente?: boolean` e `responsavelNome?: string` (obrigatório quando `isDependente === true`)
- [x] Atualizar `apps/api/src/modules/membros/solicitacoes-cadastro.service.ts`:
  - [x] Alterar `submitRegistration` para checar idempotência por `telefone + normalizeName(nome)` (ou `cpf` coincidente), evitando sobrescrita de fichas de familiares distintos com o mesmo telefone
  - [x] Gravar identificação formatada de dependente/responsável em `observacoes` sem duplicar prefixo em reenvios
  - [x] Liberar `permitirCriarNovoMesmoDuplicado: true` em `aprovarSolicitacao` para `TELEFONE` e `EMAIL` (além de `NOME_EXATO`), mantendo bloqueio absoluto `409` para `CPF`
  - [x] Tratar criação de `User` quando `permitirCriarNovoMesmoDuplicado: true` e o telefone já existir em `User.telefoneLogin` de outro usuário (mantendo `Membro.whatsapp` compartilhado e passando `telefoneLogin: null` para login por e-mail)
- [x] Atualizar e expandir testes em `apps/api/src/modules/membros/solicitacoes-cadastro.service.spec.ts` e `apps/api/src/modules/membros/solicitacoes-triagem.service.spec.ts`:
  - [x] Validar que submissões com mesmo telefone e nomes diferentes criam duas fichas `PENDENTE` distintas
  - [x] Validar que submissão de dependente exige `responsavelNome` quando `isDependente: true` e registra responsável em `observacoes`
  - [x] Validar aprovação de familiar (`permitirCriarNovoMesmoDuplicado: true`) com match por `TELEFONE` / `EMAIL` (tanto `VISITANTE` quanto `MEMBRO` sem colisão de `telefoneLogin`) mantendo bloqueio absoluto de `CPF`
- [x] Critério de validação da etapa: `npx jest src/modules/membros` em `apps/api` e `npm.cmd run build -w apps/api` passando 100%.

### Etapa 2 - Formulário Público Familiar/Dependente e Triagem na UI (Frontend)
Status: concluido

- [x] Atualizar `apps/web/src/components/public-site/join/public-join-client.tsx`:
  - [x] Adicionar toggle `"É criança / dependente sem celular próprio"` com input `"Nome do responsável"` e adaptação automática do rótulo/helper de telefone para `"WhatsApp do responsável"` (mantendo telefone obrigatório — Opção A)
  - [x] Manter a tela pós-envio limpa com apenas os dois botões originais (`"Enviar Outro Cadastro"` e `"Voltar para o site"`), garantindo reset completo no `"Enviar Outro Cadastro"`
- [x] Atualizar `apps/web/src/components/app/solicitacoes-triagem-tab.tsx`:
  - [x] Habilitar botão secundário **"Pessoa Diferente / Familiar"** para matches de `TELEFONE`, `EMAIL` e `NOME_EXATO` (mantendo oculto para `CPF`)
  - [x] Adaptar texto do modal de confirmação explicando compartilhamento de telefone/e-mail entre familiares ou homônimo
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` passando sem erros.

### Etapa 3 - Documentação, Testes Completos e Validação E2E Mobile/Desktop
Status: concluido

- [x] Atualizar `ai-context/backlog/novo-membro-auto-cadastro.md` e todos os checkboxes deste plano (`Status geral: concluido`)
- [x] Executar bateria de testes backend (`npx jest src/modules/membros src/modules/auth`) e `npm.cmd run build -w apps/api`
- [x] Executar `npx -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web`
- [x] Validar via Playwright em mobile (`390x844`) e desktop (`1280x800`): fluxo de dependente sem celular em `/join/[slug]` + tela de sucesso enxuta com 2 botões + aprovação em `/membros?tab=fichas` como **"Pessoa Diferente / Familiar"**
- [x] Critério de validação da etapa: Todos os builds, testes automatizados e checks visuais mobile/desktop verdes sem erros ou overflow.

---

## 5. Critérios de Aceite Gerais

- [x] Enviar fichas de adulto e dependente sem celular usando o mesmo WhatsApp cria solicitações pendentes distintas (sem uma sobrescrever a outra).
- [x] No formulário público `/join/[slug]`, ao marcar *"É criança ou dependente sem celular próprio"*, o campo exige o nome do responsável e orienta claramente o preenchimento com o WhatsApp do responsável.
- [x] A tela pós-envio (`"Ficha Enviada com Sucesso!"`) permanece limpa apenas com os botões **"Enviar Outro Cadastro"** e **"Voltar para o site"**.
- [x] Na triagem (`/membros?tab=fichas`), fichas com match por `TELEFONE`, `EMAIL` ou `NOME_EXATO` oferecem tanto **"Revisar e Atualizar Cadastro"** quanto **"Pessoa Diferente / Familiar"** (enquanto `CPF` permanece estritamente protegido contra duplicação).
- [x] Aprovar `Isabella Lis` como nova `Visitante` (ou `MEMBRO` com e-mail próprio compartilhando telefone de contato) conclui sem erro `409` e sem alterar o cadastro do responsável.
