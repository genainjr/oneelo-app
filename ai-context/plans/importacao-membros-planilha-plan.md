# Plano - Importação de Membros em Lote via Planilha (Excel / CSV)

Status geral: concluido  
Data de criação: 2026-11-11  
Data da última atualização: 2026-11-11  
Branch sugerida para implementação: `feature/importacao-membros-planilha`  

## Planos e Referências Relacionados

- [Detalhamento do Backlog FT-016](../backlog/importacao-membros-planilha.md)
- [Regras de Validação de Negócio](../business-rules/validation-rules.md)
- [Regras de Limite por Plano do Tenant](tenant-plan-limits-plan.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [ODS - Padrão de Modal e Ações](../../ai-core/skills/oneelo-design-system/FORM_STANDARD.md)

---

## 1. Objetivo da Entrega

Criar uma solução completa, segura e resiliente de importação em lote de membros via planilhas (`.xlsx` e `.csv`), permitindo que igrejas de médio e grande porte façam o onboarding de centenas ou milhares de membros em poucos segundos.

A funcionalidade inclui:
1. **Download de Planilha Modelo (.xlsx)**: Modelo oficial para download com cabeçalhos padronizados, linha de exemplo, colunas dimensionadas e listas suspensas de validação (ex: Sexo e Estado Civil).
2. **Parser Resiliente no Backend**: Leitura tolerante a variações comuns de cabeçalhos, sanitização de textos, normalização de telefones (E.164), formatação de CPFs e datas.
3. **Suporte Completo aos Novos Campos Eclesiásticos**: Mapeamento para todos os atributos do modelo `Membro` (`nome`, `nomeExibicao`, `whatsapp`, `email`, `dataNascimento`, `matricula`, `cargo`, `dataBatismo`, `cpf`, `rg`, `sexo`, `estadoCivil`, `status`, `observacoes`).
4. **Prévia com Validação Antecipada (Dry-run)**: Diagnóstico detalhado sem efeito colateral no banco (contagem de linhas válidas, erros impeditivos, duplicidades internas e duplicidades contra o banco).
5. **Estratégia de Duplicidade Inteligente**: Detecção rigorosa por CPF e E-mail, e proteção contra falsos positivos de telefone (quando familiares compartilham o mesmo celular). Opções de confirmação para *Pular duplicados* ou *Atualizar existentes*.
6. **Garantia de Limites do Plano do Tenant**: Bloqueio prévio caso o volume a importar exceda o teto do plano (`GRATUITO`: 50, `BASICO`: 200, `PROFISSIONAL`: ilimitado), com CTA para upgrade.
7. **Persistência em Transação Atômica com Auditoria**: Inserção em batch segura com registro consolidado em `tb_audit_log`.

---

## 2. Contexto e Diagnóstico

### Diagnóstico Técnico:
- **Cadastro Atual**: Feito exclusivamente membro a membro via modal (`apps/web/src/components/app/membro-modal.tsx`) chamando `POST /api/membros`.
- **Fricção de Onboarding**: Igrejas com 100 a 1.000 membros enfrentam barreira operacional de digitação manual de cadastros pré-existentes.
- **Campos Atualizados do Modelo `Membro` no Prisma (`tb_member`)**:
  - Obrigatórios: `nome`, `tenantId`.
  - Opcionais de Contato e Identificação: `nomeExibicao`, `whatsapp`, `email`, `cpf`, `rg`, `matricula`.
  - Opcionais Eclesiásticos e Pessoais: `cargo`, `dataNascimento`, `dataBatismo`, `sexo` (`MASCULINO`, `FEMININO`), `estadoCivil` (`SOLTEIRO`, `CASADO`, `DIVORCIADO`, `VIUVO`, `OUTRO`), `status` (`ATIVO`, `INATIVO`, `VISITANTE`, `TRANSFERIDO`), `observacoes`.
- **Stack & Bibliotecas**: O monorepo utiliza Node.js, NestJS e Prisma no backend. Adotaremos `exceljs` pela confiabilidade, tipagem TypeScript nativa, suporte a `.xlsx`/`.csv` e geração de templates formatados com validação de dados em memória (sem escrita temporária em disco).

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

1. **Biblioteca de Manipulação (`exceljs`)**:
   - `exceljs` processa planilhas em memória a partir do `file.buffer` provido pelo `FileInterceptor` do NestJS (`memoryStorage`).
   - Gera o arquivo `.xlsx` do template com estilos, colunas com largura ajustada, cabeçalhos congelados e validações suspensas.
2. **Fluxo em Duas Fases sem Estado Transitório no Servidor**:
   - `POST /api/membros/import/preview`: Recebe o arquivo multipart (máximo 5MB), executa o parser e dry-run em memória, retornando estatísticas (`totalLinhas`, `validosCount`, `duplicadosCount`, `errosCount`) e os itens validados.
   - `POST /api/membros/import/confirm`: Recebe os registros validados e a estratégia escolhida (`SKIP` ou `UPDATE`), garantindo atomicidade via `prisma.$transaction` e registrando a operação em `AuditLog`.
3. **Tratamento de Duplicidades (Realidade Eclesiástica)**:
   - *Duplicidade interna*: Identificada se duas linhas do próprio arquivo possuírem o mesmo CPF ou mesmo E-mail.
   - *Duplicidade com a base*:
     1. **CPF**: Identificador único forte. Se coincidir com membro ativo no tenant, é duplicado.
     2. **E-mail**: Identificador único forte se preenchido.
     3. **WhatsApp / Celular**: No contexto eclesiástico brasileiro, cônjuges ou pais e filhos frequentemente compartilham o mesmo telefone. O sistema sinaliza duplicidade quando o telefone coincide E o primeiro nome for similar. Se os nomes forem nitidamente distintos (ex: *Manoel Silva* e *Maria Silva*), o registro é tratado como novo membro mantendo o telefone compartilhado.
4. **Respeito aos Limites do Plano do Tenant**:
   - Verificação integrada com `canAddMember` e `getEffectiveMemberLimit` de `tenant-plan.ts`.
   - Se `totalMembrosAtivos + novosValidos > limite`, o preview avisa o limite restante, desabilita a confirmação e exibe CTA para upgrade.
5. **Segurança e Multitenancy**:
   - `tenantId` estritamente injetado pela sessão JWT autenticada do usuário (`@Req() req['tenantId']` ou `@CurrentUser()`).
   - Permissões restritas aos papéis `ADMIN` e `STAFF`.

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Preparação e Spike de Dependências
Status: concluido

- [x] Instalar dependência `exceljs` no workspace `apps/api` (`npm install exceljs -w apps/api`)
- [x] Verificar compatibilidade de tipagens TypeScript do `exceljs` no build da API
- [x] Criar arquivo utilitário de geração de template da planilha modelo em `apps/api/src/modules/membros/import/member-template.builder.ts`:
  - [x] Definir cabeçalhos oficiais: Nome Completo*, Nome de Exibição, WhatsApp / Celular, E-mail, Data de Nascimento, Sexo, Estado Civil, Cargo / Função, Data de Batismo, CPF, RG, Matrícula / Rol, Observações
  - [x] Adicionar linha de dados de exemplo claros para orientar o preenchimento
  - [x] Configurar validação de dados com dropdown no Excel para Sexo (`Masculino`, `Feminino`) e Estado Civil (`Solteiro(a)`, `Casado(a)`, `Divorciado(a)`, `Viúvo(a)`, `Outro`)
- [x] Criar teste unitário ou script de spike para validar geração do template em buffer
- [x] Critério de validação da etapa: Teste isolado gerando o arquivo `.xlsx` do template sem erros de compilação ou execução

### Etapa 1 - Parser Resiliente e Serviço de Validação Prévia (Dry-Run)
Status: concluido

- [x] Criar DTOs em `apps/api/src/modules/membros/dto/import-membros.dto.ts`:
  - [x] `ImportPreviewRowDto` (dados extraídos, status da linha, lista de erros/alertas)
  - [x] `ImportPreviewResponseDto` (totalizadores, resumo de limites do tenant, lista detalhada de prévia)
  - [x] `ConfirmImportItemDto` e `ConfirmImportDto` (estratégia `SKIP` ou `UPDATE`, lista de membros validados)
- [x] Criar serviço `MemberImportService` em `apps/api/src/modules/membros/import/member-import.service.ts`:
  - [x] Leitor universal de buffer para `.xlsx` e `.csv`
  - [x] Mapeamento flexível de colunas (reconhecendo sinônimos: "Nome", "Nome Completo", "Celular", "Telefone", "Zap", "Nascimento", "Batismo", "Função", "Rol", etc.)
  - [x] Sanitização e normalização de telefones (padrão internacional/E.164 brasileiro)
  - [x] Sanitização de CPFs (apenas dígitos válidos)
  - [x] Parser tolerante de datas (formatos `DD/MM/AAAA`, `AAAA-MM-DD` e serial date do Excel)
  - [x] Normalização dos Enums (`SexoMembro`, `EstadoCivil`, `StatusMembro`)
  - [x] Validação de duplicidade interna na própria planilha (linhas repetidas)
  - [x] Validação de duplicidade contra membros existentes do tenant no banco
  - [x] Verificação de teto de membros via `tenant-plan.ts`
- [x] Criar testes unitários em `apps/api/src/modules/membros/import/member-import.service.spec.ts`:
  - [x] Teste com planilha válida completa
  - [x] Teste com linhas contendo erros impeditivos (nome ausente, data inválida)
  - [x] Teste com duplicidades internas e existentes no banco
  - [x] Teste de bloqueio ao ultrapassar o limite do plano do tenant
- [x] Critério de validação da etapa: 100% dos testes unitários do `MemberImportService` passando com sucesso

### Etapa 2 - Endpoints da API e Execução em Lote
Status: concluido

- [x] Adicionar endpoints no controller em `apps/api/src/modules/membros/membros.controller.ts`:
  - [x] `GET /api/membros/import/template`: Download do modelo oficial `.xlsx` com `Content-Disposition: attachment; filename="modelo-importacao-membros-oneelo.xlsx"`
  - [x] `POST /api/membros/import/preview`: Upload do arquivo multipart (`FileInterceptor('file')`), processamento em memória e resposta do dry-run
  - [x] `POST /api/membros/import/confirm`: Persistência atômica dos membros validados
- [x] Implementar método `confirmImport` no `MemberImportService` ou `MembrosService`:
  - [x] Revalidação de segurança dos limites do plano antes da escrita
  - [x] Execução em lote via `prisma.$transaction` com tratamento para `SKIP` e `UPDATE`
  - [x] Criação de registro em `AuditLog` com contagem de membros inseridos e atualizados
- [x] Registrar `MemberImportService` no `apps/api/src/modules/membros/membros.module.ts`
- [x] Criar testes unitários e de integração para os endpoints em `apps/api/src/modules/membros/membros.controller.spec.ts`
- [x] Critério de validação da etapa: Requisições de teste na API validando download de template, upload com prévia e persistência final com auditoria

### Etapa 3 - Interface de Usuário: Modal/Wizard de Importação (ODS)
Status: concluido

- [x] Criar componente `MemberImportModal` em `apps/web/src/components/app/member-import-modal.tsx`:
  - [x] **Etapa 1 - Upload**: Dropzone com drag-and-drop para `.xlsx` e `.csv`, botão com ícone para "Baixar Planilha Modelo", instruções claras e validação de tamanho máximo (5MB)
  - [x] **Etapa 2 - Prévia e Diagnóstico**:
    - [x] Cards de métricas com cores ODS (Total de Linhas, Válidos [verde], Duplicados [amarelo], Inválidos [vermelho])
    - [x] Tabela paginada/rolável com badge de status por linha e visualização dos erros de validação
    - [x] Seletor de estratégia para duplicados: *"Pular membros duplicados"* (padrão) vs. *"Atualizar dados de membros existentes"*
    - [x] Banner de alerta caso a quantidade de membros exceda o limite do plano contratado, com botão de upgrade
  - [x] **Etapa 3 - Confirmação e Sucesso**: Barra de progresso durante o envio e tela de conclusão com resumo final dos membros importados
- [x] Adicionar botão "Importar Planilha" no cabeçalho de `apps/web/src/app/(dashboard)/membros/page.tsx` com ícone de upload ao lado de "Emitir Carteirinhas (Lote)"
- [x] Conectar atualização automática da listagem de membros ao concluir a importação com sucesso
- [x] Garantir responsividade e acessibilidade no desktop e dispositivos móveis
- [x] Critério de validação da etapa: Fluxo visual completo do modal operando no navegador com feedback de validação e sucesso

### Etapa 4 - Validação Integrada, Documentação e Build
Status: concluido

- [x] Testar importação ponta a ponta com planilha real contendo de 50 a 300 membros
- [x] Validar bloqueio correto em tenant com plano `GRATUITO` ao tentar importar mais de 50 membros
- [x] Validar importação sem travas em tenant com plano `PROFISSIONAL`
- [x] Executar checagem de tipos TypeScript (`npx tsc --noEmit`) no `api` e no `web`
- [x] Executar bateria completa de testes unitários (`npm test -w apps/api`)
- [x] Executar build de produção (`npm run build -w apps/api` e `npm run build -w apps/web`)
- [x] Atualizar status do plano e arquivos de documentação em `ai-context/`
- [x] Critério de validação da etapa: Build e testes passando com 0 erros em ambos os pacotes

---

## 5. Critérios de Aceite Gerais

- [x] Administradores e Staff conseguem baixar a planilha modelo oficial `.xlsx` com 1 clique diretamente do modal.
- [x] A planilha modelo contém cabeçalhos compreensíveis, linha de exemplo e menus suspensos para campos com opções fixas.
- [x] Arquivos `.xlsx` e `.csv` são aceitos, sanitizados e validados em memória sem sobrecarregar o servidor nem salvar arquivos temporários em disco.
- [x] Todos os campos novos do modelo `Membro` (`cargo`, `matricula`, `dataBatismo`, `cpf`, `rg`, `sexo`, `estadoCivil`) são suportados no template e no parser.
- [x] Nenhuma linha é gravada no banco de dados sem que o usuário visualize a prévia detalhada com contadores e confirme explicitamente.
- [x] O sistema identifica duplicidades internas na planilha e duplicidades contra o banco de dados do tenant, respeitando o compartilhamento familiar de telefone celular.
- [x] O usuário pode escolher entre pular duplicados ou atualizar cadastros existentes.
- [x] O limite de membros do plano contratado do tenant é rigorosamente respeitado, com alerta visual claro e link para upgrade caso excedido.
- [x] Toda importação confirmada registra auditoria em `tb_audit_log` identificando o usuário solicitante e o resumo das ações realizadas.
