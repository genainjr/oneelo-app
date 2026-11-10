# Plano - Recadastramento de Membros e Auto-Preenchimento Cadastral

Status geral: concluido  
Data de criação: 2026-11-10  
Branch sugerida para implementação: feat/recadastramento-membros-auto-preenchimento  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Painel Pessoal Basic Plan](painel-pessoal-basic-plan.md)
- [Carteirinha Renderer Service](../../apps/api/src/modules/documents/renderers/carteirinha-renderer.service.ts)

---

## 1. Objetivo da Entrega

Permitir que os membros preencham e mantenham atualizados seus próprios dados cadastrais faltantes (CPF, Data de Nascimento, Data de Batismo, Estado Civil, Sexo e Foto), implementando a dupla estratégia aprovada:
1. **Gatilho de Bloqueio Amigável na Carteirinha**: Se o membro tentar abrir ou emitir a carteira com campos essenciais pendentes, abre o modal de preenchimento rápido para liberar o documento.
2. **Banner Informativo de Atualização no Painel Pessoal**: Um aviso sutil no topo do painel pessoal informando sobre o recadastramento com botão de acesso direto.
3. **Reaproveitamento Máximo de Modais e Componentes**: Utilização estrita de `ModalShell`, `InputField`, `SelectField` e `ImageUploadPanel`.
4. **Enriquecimento da tela "Meu Perfil"**: Disponibilização dos novos campos para edição autônoma a qualquer momento.
5. **Aprimoramento Visual Mobile Estilo CNH Digital**: Visualização mobile imersiva, ocupando a largura total útil da tela em proporção exata de documento oficial (85.6mm x 54mm) com rotação fluida e sem cortes.

---

## 2. Contexto e Diagnóstico

- Os novos campos da carteirinha (`cpf`, `dataNascimento`, `dataBatismo`, `estadoCivil`, `sexo`, `fotoUrl`) foram adicionados recentemente ao schema do membro e estão praticamente 100% em branco para os membros antigos.
- A tela `/meu-perfil` atualmente só permitia editar `nome`, `nomeExibicao` e `whatsapp`.
- O endpoint `PATCH /api/auth/me/profile` aceitava apenas `UpdateMyProfileDto` com esses 3 campos limitados.
- Sem a atualização autônoma pelo próprio membro, a secretaria da igreja ficaria sobrecarregada para coletar centenas de dados manualmente.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

- **Reaproveitamento de Componentes**: O novo modal `CompletarCadastroModal` reutiliza `ModalShell`, `InputField`, `SelectField`, `ImageUploadPanel` e `ModalError`, mantendo a consistência visual e sem duplicar código.
- **Campos Obrigatórios para Carteirinha**:
  - `cpf`: Obrigatório para emissão oficial de documento.
  - `dataNascimento`: Obrigatório.
  - `dataBatismo`: Opcional / se batizado.
  - `estadoCivil`: Obrigatório.
  - `sexo`: Obrigatório.
- **Contrato da API (`apps/api`)**:
  - Expandir `UpdateMyProfileDto` com validações `class-validator` (`IsOptional`, `IsDateString`, `IsEnum`, etc.).
  - No `auth.service.ts` (`updateMyProfile`), persistir essas propriedades no registro de `membro` vinculado ao usuário logado em transação Prisma.
- **Sincronização no Frontend**:
  - Utilizar `useAuthUser().refreshUser()` para atualizar o contexto global de usuário imediatamente após salvar, refletindo os dados no Painel Pessoal, no Meu Perfil e na Carteirinha sem necessidade de recarregar a página (F5).

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Preparação e Expansão da API de Perfil do Usuário
Status: concluido

- [x] Atualizar DTO de perfil (`apps/api/src/modules/auth/dto/update-my-profile.dto.ts`):
  - [x] Adicionar campo `cpf` (string opcional, com validação de formato e sanitização)
  - [x] Adicionar campo `rg` (string opcional)
  - [x] Adicionar campo `dataNascimento` (string ISO/data opcional)
  - [x] Adicionar campo `dataBatismo` (string ISO/data opcional)
  - [x] Adicionar campo `estadoCivil` (enum EstadoCivil opcional)
  - [x] Adicionar campo `sexo` (enum Sexo opcional)
- [x] Atualizar serviço de autenticação (`apps/api/src/modules/auth/auth.service.ts`):
  - [x] Extrair e persistir os novos campos em `tx.membro.update` dentro de `updateMyProfile`
  - [x] Garantir validação de tipos e datas na transação
- [x] Critério de validação da etapa:
  - [x] Build do pacote `apps/api` executado com sucesso (`npm run build -w apps/api`)

### Etapa 1 - Componente Reutilizável de Completar Cadastro
Status: concluido

- [x] Criar o modal reutilizável `CompletarCadastroModal` (`apps/web/src/components/app/completar-cadastro-modal.tsx`):
  - [x] Utilizar `ModalShell` como container padrão
  - [x] Utilizar `InputField` para CPF, RG, Data de Nascimento e Data de Batismo
  - [x] Utilizar `SelectField` para Estado Civil e Sexo
  - [x] Integrar `ImageUploadPanel` para envio de foto selfie/perfil caso o membro não possua foto
  - [x] Implementar submit com chamada para `PATCH /api/auth/me/profile` e `POST /api/auth/me/photo`
  - [x] Acionar `refreshUser()` após salvamento bem-sucedido
- [x] Critério de validação da etapa:
  - [x] Componente implementado sem erros de tipagem TypeScript

### Etapa 2 - Integração na Carteirinha e no Painel Pessoal
Status: concluido

- [x] Integrar validação cadastral na Carteirinha (`apps/web/src/components/app/carteirinha-modal.tsx` e `personal-panel/page.tsx`):
  - [x] Criar função utilitária `isCadastroIncompleto(membro)` para checar campos essenciais
  - [x] No `personal-panel/page.tsx`, interceptar o clique em "Carteira de Membro" quando o cadastro estiver incompleto, abrindo o `CompletarCadastroModal`
  - [x] Adicionar banner de aviso no topo de `personal-panel/page.tsx` com barra ou botão de chamada quando `isCadastroIncompleto(membro)` for verdadeiro
  - [x] Ao concluir o preenchimento, abrir automaticamente a `CarteirinhaModal` emitida
- [x] Critério de validação da etapa:
  - [x] Validação do fluxo integrado no Painel Pessoal

### Etapa 3 - Enriquecimento da Tela "Meu Perfil"
Status: concluido

- [x] Atualizar página de perfil (`apps/web/src/app/(dashboard)/meu-perfil/page.tsx`):
  - [x] Adicionar seção "Dados Cadastrais da Carteirinha"
  - [x] Incluir campos de CPF, Data de Nascimento, Data de Batismo, Estado Civil e Sexo
  - [x] Integrar salvamento com `api.patch('/api/auth/me/profile', ...)`
- [x] Critério de validação da etapa:
  - [x] Formulário de `meu-perfil` exibindo e salvando todos os campos com sucesso

### Etapa 4 - Testes, Validação Integrada e Build Final
Status: concluido

- [x] Validar compilação do frontend (`npm run build -w apps/web`)
- [x] Validar compilação do backend (`npm run build -w apps/api`)
- [x] Verificar consistência de tipos e layout responsivo (mobile e desktop)
- [x] Critério de validação da etapa:
  - [x] Zero erros de compilação em `apps/api` e `apps/web`

---

## 5. Critérios de Aceite Gerais

- [x] O membro com campos faltantes que clicar em "Carteira de Membro" é direcionado para completar o cadastro antes de emitir o documento.
- [x] O membro com cadastro incompleto visualiza um banner de aviso no Painel Pessoal.
- [x] O modal de preenchimento reaproveita `ModalShell`, `InputField`, `SelectField` e `ImageUploadPanel`.
- [x] A tela `/meu-perfil` permite consulta e edição dos novos campos a qualquer momento.
- [x] Os dados salvos são imediatamente refletidos na geração do PDF e no QR Code oficial.
