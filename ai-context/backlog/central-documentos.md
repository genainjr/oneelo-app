# Backlog - Central de Documentos

### FT-013 Central de Documentos

- **Prioridade**: alta
- **Fase**: próxima evolução de produtividade e operação
- **Categoria**: produto / infraestrutura / documentos / relatórios
- **Esforço estimado**: alto
- **Contexto**: o OneElo possui exportação de Escalas e Agenda geradas sob demanda no backend via Playwright/Chromium, mas a geração síncrona causa lentidão no primeiro acesso e faz com que o menu nativo de compartilhamento do celular (`navigator.share`) falhe por expiração de gesto do usuário. Além disso, os arquivos gerados não ficam persistidos em histórico, geram consumo repetido de memória e não cobrem fluxos em lote ou documentos formais da igreja (carteirinhas).
- **Ação**: criar a Central de Documentos multitenant integrada ao monólito NestJS para gerenciar requisições assíncronas, armazenar no Supabase Storage, disponibilizar downloads seguros e manter o histórico do tenant. A Fase 1 terá como entregas principais:
  1. **Evolução do Cadastro de Membros**: Inclusão de dados eclesiásticos, pessoais e documentais essenciais na tabela `Membro` (`matricula`, `cargo`, `dataBatismo`, `cpf`, `rg`, `sexo`, `estadoCivil`).
  2. **Emissão de Carteirinhas de Membros**: Emissão unitária e em lote (formato cartão CR80 e grade A4 para impressão, mais versão digital PNG para o app do membro).
  3. **Persistência e Cache das Exportações de Escalas e Agenda**: Armazenamento no Supabase Storage indexado pela versão (`updatedAt`) da escala/agenda, mantendo 100% o layout validado do ODS (`ExportShareDialog` e `ExportSharePreparedBanner`) e viabilizando abertura instantânea do menu nativo de compartilhamento no mobile.
- **Impacto**: viabiliza emissão profissional de carteirinhas de membros para secretarias, resolve definitivamente a falha de compartilhamento nativo no celular, elimina timeouts/repetição de renderização pesada e oferece histórico permanente de documentos por tenant.

---

## 1. Pilares Funcionais da Entrega

### A. Dados Cadastrais, Pessoais e Eclesiásticos dos Membros (Fase 1)
Para que a Carteirinha de Membro nasça completa na sua versão 1, a tabela de membros (`tb_member`) e o formulário de cadastro/edição em `/membros` serão expandidos para contemplar:
- `matricula`: Número de registro / rol de membros da congregação.
- `cargo`: Cargo ou função eclesiástica (ex.: Pastor, Presbítero, Diácono, Evangelista, Membro, Cooperador).
- `dataBatismo`: Data do batismo nas águas.
- `cpf`: Cadastro de Pessoa Física do membro (com máscara e validação).
- `rg`: Registro Geral (opcional).
- `sexo`: Sexo do membro (`MASCULINO` / `FEMININO`).
- `estadoCivil`: Estado civil do membro (`SOLTEIRO`, `CASADO`, `VIUVO`, `DIVORCIADO`, `UNIAO_ESTAVEL`).

### B. Carteirinhas de Membros (Carro-chefe da Secretaria)
- **Emissão Unitária**: Ação direta na listagem/perfil do membro (`/membros`), permitindo emitir a carteirinha individual em alta resolução (PDF ou imagem PNG).
- **Emissão em Lote**: Ação em lote para gerar todas as carteirinhas ativas (ou filtradas por ministério/status) em uma única remessa consolidada pronta para impressão gráfica (grade A4 para gráfica ou cartões individuais CR80: 85.6mm x 53.98mm).
- **Estrutura Visual do Cartão**:
  - **Frente**: Foto do membro (Supabase Storage), nome completo e de exibição, cargo eclesiástico, congregação e logo da igreja com cores institucionais do tenant.
  - **Verso**: Matrícula/rol, data de nascimento, data de batismo, CPF/RG, data de emissão/validade e **QR Code de autenticidade** (apontando para URL segura de validação do OneElo).
- **Acesso do Membro (Mobile PWA)**: O membro comum (`BASIC`) poderá visualizar e baixar sua carteirinha digital PNG diretamente na tela de Meu Perfil / Painel Pessoal.

### C. Integração de Escalas e Agenda (Respeitando o Layout ODS)
- **Manutenção Estrita do Layout Validado**: O fluxo visual de exportação e compartilhamento em `/escalas/visualizacao` e `/agenda/visualizacao` permanece **inalterado**, utilizando os componentes do padrão ODS:
  - `<ExportShareDialog />`: Seleção de formato (PDF vs Imagem) e seleção de semana ("Semana X" ou "Todas as semanas").
  - `<ExportSharePreparedBanner />`: Banner com os botões consolidados `Compartilhar` (ícone `Share2`) e `Baixar` (ícone `Download`).
- **Otimização por Baixo dos Panos (Cache por Versão no Supabase Storage)**:
  - Ao solicitar a exportação de uma semana ou período, o backend verifica se o arquivo já existe no Supabase Storage para aquela versão da escala (`escalaId` + hash/`updatedAt`).
  - Se o arquivo já existir (escala inalterada): o retorno do backend é imediato (milissegundos), permitindo que o clique em `Compartilhar` acione o `navigator.share` do celular de forma instantânea sem bloqueio do iOS/Android.
  - Se a escala foi alterada ou for a primeira geração: o arquivo é processado, salvo no Storage com sua chave de versão e catalogado no histórico do tenant.
  - Se houver troca ou substituição de voluntário, o `updatedAt` muda e invalida o cache automaticamente, impedindo o envio de escalas com dados desatualizados.

### D. Histórico e Gestão de Documentos por Tenant
- Tela dedicada no portal (`/documentos` ou submódulo da Secretaria) para consultar remessas anteriores:
  - Listagem com data de geração, solicitante, tipo de documento, status (`PROCESSANDO`, `CONCLUÍDO`, `ERRO`) e tamanho do arquivo.
  - Botão de download direto seguro via URLs assinadas no Supabase Storage.
  - Botão de reprocessamento em caso de falhas transitórias.

---

## 2. Formatos Suportados

- **PDF**: Formato primário para documentos de impressão (A4 para grades de escalas/eventos/carteirinhas em lote e CR80 para cartões individuais).
- **PNG**: Formato para compartilhamento rápido ou versão digital no celular do membro.
- **DOCX/Word**: Reservado arquiteturalmente para atas e certificados em fase futura (fora do escopo da Fase 1).

---

## 3. Arquitetura e Processamento Assíncrono (Sem Dependência de Redis)

Para manter a simplicidade operacional e custo zero adicional de infraestrutura, a fila de processamento será implementada diretamente sobre o banco de dados e o monólito NestJS:

1. **Solicitação**: O usuário solicita um documento pesado (ex.: carteirinhas em lote) ou a exportação de escala/agenda.
2. **Criação do Job (`DocumentJob`)**: O backend cria o registro na tabela `tb_document_job` com status `PENDING` e retorna imediatamente para o frontend.
3. **Processador em Background**:
   - Um worker leve no NestJS (gerenciado com `@nestjs/schedule` ou fila concorrente interna com semáforo) consome os jobs pendentes respeitando o limite de concorrência do Chromium (`ChromiumRendererService`).
   - O worker compila os dados, renderiza via Playwright e envia o binário final para o bucket `tenant-documents` do Supabase Storage.
4. **Finalização**: O job é marcado como `COMPLETED` com a `storageKey`, disparando uma notificação in-app (sino) e web-push para o solicitante.

---

## 4. Modelo de Dados Sugerido

### Alterações em `Membro` (`tb_member`)
- `matricula`: String? (número de rol/membro).
- `cargo`: String? (cargo eclesiástico).
- `dataBatismo`: DateTime? (data de batismo nas águas).
- `cpf`: String? (CPF formatado).
- `rg`: String? (RG).
- `sexo`: Enum `SexoMembro` (`MASCULINO`, `FEMININO`).
- `estadoCivil`: Enum `EstadoCivil` (`SOLTEIRO`, `CASADO`, `VIUVO`, `DIVORCIADO`, `UNIAO_ESTAVEL`).

### Novo Modelo `DocumentJob` (`tb_document_job`)
- `id`: UUID (chave primária).
- `tenantId`: Identificador do tenant (isolamento multitenant estrito).
- `requestedByUserId`: ID do usuário solicitante.
- `tipoDocumento`: Enum (`CARTEIRINHA_INDIVIDUAL`, `CARTEIRINHAS_LOTE`, `ESCALA_PDF`, `ESCALA_PNG`, `AGENDA_PDF`, `AGENDA_PNG`, `RELATORIO`).
- `formato`: Enum (`PDF`, `PNG`).
- `status`: Enum (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).
- `parametros`: JSON com filtros (IDs de membros, semana, mês/ano, filtros de ministério).
- `versionHash`: Hash da versão dos dados de origem (ex.: `updatedAt` da escala) para validação de cache.
- `storageKey`: Caminho do arquivo no Supabase Storage (`tenant-documents/{tenantId}/{jobId}.{ext}`).
- `fileName`: Nome amigável do arquivo para download.
- `fileSize`: Tamanho em bytes.
- `tentativas`: Contador de retentativas (máx. 3).
- `erroMensagem`: Mensagem sanitizada em caso de falha.
- `createdAt` / `completedAt`.

---

## 5. Permissões e Segurança

- `ADMIN` e `STAFF`: Podem gerar carteirinhas individuais e em lote, relatórios e consultar todos os documentos do tenant.
- `BASIC` Líder: Pode gerar e consultar documentos relacionados aos seus ministérios liderados.
- `BASIC` Comum: Pode visualizar e baixar exclusivamente a sua própria carteirinha digital em Meu Perfil / Painel Pessoal.
- **Isolamento Multitenant Rigoroso**: Todas as consultas e operações no banco e no Storage são filtradas estritamente por `tenantId`.
