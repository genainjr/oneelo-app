# Plano - Financeiro e Patrimonial

Status geral: **em desenvolvimento**

CriaÃ§Ã£o: 2026-07-23

Branch sugerida para implementaÃ§Ã£o: `feature/financeiro-patrimonial`

Backlog relacionado: [financeiro-patrimonial.md](../backlog/financeiro-patrimonial.md)

## Objetivo da entrega

Iniciar o mÃ³dulo financeiro com seguranÃ§a, isolamento por tenant e permissÃµes prÃ³prias, sem depender do papel global `ADMIN`.

O primeiro valor entregue deve permitir que a igreja configure quem acessa o financeiro antes de registrar dados sensÃ­veis. Depois disso, o MVP avanÃ§a para categorias, contas, entradas, despesas simples e saldo/extrato bÃ¡sico.

## DecisÃµes fechadas

- `User.role` continua sendo a permissÃ£o global do sistema.
- Financeiro terÃ¡ permissÃ£o prÃ³pria por tenant.
- `ADMIN` global nÃ£o acessa financeiro por padrÃ£o.
- Novo tenant nasce com o usuÃ¡rio dono como `ADMIN` global e `FINANCE_MANAGER`.
- Tenant existente sem `FINANCE_MANAGER` ativo permite que um `ADMIN` configure o primeiro gestor financeiro.
- Depois que existe `FINANCE_MANAGER` ativo, somente `FINANCE_MANAGER` gerencia permissÃµes financeiras.
- A configuraÃ§Ã£o inicial fica em `ConfiguraÃ§Ãµes > UsuÃ¡rios`, mantendo o campo atual `Perfil/PermissÃ£o` e adicionando `PermissÃµes especÃ­ficas > Financeiro`.
- No MVP, cada usuÃ¡rio terÃ¡ um Ãºnico nÃ­vel financeiro: `Sem acesso`, `Visualizador`, `Operador`, `Aprovador` ou `Gestor financeiro`.
- Uma tela futura em `Financeiro > ConfiguraÃ§Ãµes > PermissÃµes` pode existir como atalho, mas nÃ£o deve criar outra fonte de verdade.

## Fora de escopo inicial

- conciliaÃ§Ã£o bancÃ¡ria;
- importaÃ§Ã£o OFX/CSV;
- relatÃ³rios avanÃ§ados;
- DRE;
- controle patrimonial completo;
- comprovantes e anexos obrigatÃ³rios;
- fluxo complexo de aprovaÃ§Ã£o em mÃºltiplas etapas;
- notificaÃ§Ãµes financeiras robustas;
- tela prÃ³pria de permissÃµes dentro do financeiro.

## ExecuÃ§Ã£o atual - Entrega 1

Status parcial: implementada a fundaÃ§Ã£o de permissÃµes financeiras.

IncluÃ­do nesta branch:

- modelo `FinancePermission` e enum `FinanceRole`;
- migration de permissÃµes financeiras por tenant/usuÃ¡rio;
- bootstrap de novo tenant com o usuÃ¡rio administrador inicial como `FINANCE_MANAGER`;
- endpoint para consultar a permissÃ£o financeira do usuÃ¡rio atual;
- endpoints para listar, conceder, alterar e remover permissÃ£o financeira;
- bloqueio backend para impedir remoÃ§Ã£o do Ãºltimo `FINANCE_MANAGER`;
- exceÃ§Ã£o de bootstrap para tenant existente sem gestor financeiro;
- inclusÃ£o da permissÃ£o financeira em `/api/auth/me` e `/api/auth/users`;
- seÃ§Ã£o `PermissÃµes especÃ­ficas > Financeiro` em `ConfiguraÃ§Ãµes > UsuÃ¡rios`;
- menu `/financeiro` visÃ­vel apenas para usuÃ¡rio com permissÃ£o financeira ou `ADMIN` em bootstrap inicial;
- rota `/financeiro` com estado inicial protegido e cards vazios.

Ainda fora desta entrega:

- categorias financeiras;
- contas/caixas;
- entradas;
- despesas;
- saldo/extrato real;
- tela prÃ³pria de permissÃµes dentro do financeiro.

## Etapa 0 - Auditoria do estado atual

Objetivo: mapear onde encaixar o mÃ³dulo sem criar padrÃµes paralelos.

- [x] Mapear fluxo de criaÃ§Ã£o de tenant.
- [x] Mapear fluxo de criaÃ§Ã£o do primeiro usuÃ¡rio/dono.
- [x] Mapear modelo `User.role`.
- [x] Mapear tela `ConfiguraÃ§Ãµes > UsuÃ¡rios`.
- [x] Mapear guardas/autorizaÃ§Ã£o backend.
- [x] Mapear sidebar e regras de navegaÃ§Ã£o.
- [x] Mapear padrÃ£o de auditoria existente.
- [x] Mapear padrÃ£o de CRUD e mensagens do ODS.
- [x] Verificar se jÃ¡ existe conceito explÃ­cito de dono do tenant.
- [x] Registrar pontos de integraÃ§Ã£o.
- [x] Confirmar que o bootstrap do novo tenant usa o primeiro `ADMIN` criado no tenant.
- [x] Registrar risco para tenants existentes: ninguÃ©m recebe permissÃ£o financeira automaticamente.

EntregÃ¡vel:

- [x] Pontos de integraÃ§Ã£o mapeados antes da implementaÃ§Ã£o.

CritÃ©rios de aceite:

- [x] NÃ£o criar padrÃµes paralelos quando jÃ¡ existe fluxo equivalente.
- [x] Identificar impacto de migration para tenants existentes.

## Etapa 1 - Modelo de permissÃµes financeiras

Objetivo: criar a base de autorizaÃ§Ã£o do mÃ³dulo.

- [x] Criar enum `FinanceRole`.
- [x] Incluir `FINANCE_VIEWER`.
- [x] Incluir `FINANCE_OPERATOR`.
- [x] Incluir `FINANCE_APPROVER`.
- [x] Incluir `FINANCE_MANAGER`.
- [x] Criar modelo `FinancePermission`.
- [x] Vincular permissÃ£o com `tenantId`.
- [x] Vincular permissÃ£o com `userId`.
- [x] Incluir `createdAt`.
- [x] Incluir `createdByUserId`.
- [x] Incluir `updatedAt`.
- [x] Incluir `updatedByUserId`.
- [x] Incluir `revokedAt`.
- [x] Impedir mais de uma permissÃ£o por usuÃ¡rio no mesmo tenant.
- [x] Criar migration.
- [x] Validar schema Prisma.
- [x] Regenerar Prisma Client.

EntregÃ¡vel:

- [x] Estrutura persistente de permissÃµes financeiras criada.

CritÃ©rios de aceite:

- [x] Tenant isolation preservado pela modelagem.
- [x] Migration disponÃ­vel para execuÃ§Ã£o.

## Etapa 2 - Bootstrap para novo tenant

Objetivo: evitar que um tenant novo nasÃ§a sem responsÃ¡vel financeiro.

- [x] Criar permissÃ£o `FINANCE_MANAGER` para o admin inicial no fluxo de criaÃ§Ã£o de tenant.
- [x] Manter `User.role = ADMIN` separado da permissÃ£o financeira.
- [ ] Garantir idempotÃªncia explÃ­cita se o fluxo for reexecutado.
- [ ] Registrar auditoria especÃ­fica da criaÃ§Ã£o automÃ¡tica da permissÃ£o financeira, se a trilha separada for exigida.

EntregÃ¡vel:

- [x] Novo tenant nasce com gestor financeiro inicial.

CritÃ©rios de aceite:

- [ ] Novo tenant validado manualmente com exatamente um gestor financeiro inicial.
- [ ] Gestor inicial validado acessando `/financeiro`.
- [ ] Outro `ADMIN` criado depois validado sem financeiro automÃ¡tico.

## Etapa 3 - Bootstrap para tenant existente

Objetivo: permitir configuraÃ§Ã£o inicial sem liberar dados financeiros para todos os administradores.

- [x] NÃ£o conceder permissÃ£o financeira automÃ¡tica a usuÃ¡rios existentes.
- [x] Detectar tenant sem `FINANCE_MANAGER` ativo.
- [x] Permitir que `ADMIN` configure o primeiro gestor financeiro apenas nesse cenÃ¡rio.
- [x] Bloquear bootstrap se jÃ¡ existir `FINANCE_MANAGER`.
- [x] Registrar auditoria da aÃ§Ã£o de alteraÃ§Ã£o de permissÃ£o.
- [x] Exibir orientaÃ§Ã£o clara na UI para setup inicial.

EntregÃ¡vel:

- [x] Setup inicial controlado para tenant existente.

CritÃ©rios de aceite:

- [x] Tenant sem gestor financeiro validado permitindo setup por `ADMIN`.
- [ ] Tenant com gestor financeiro validado bloqueando `ADMIN` sem permissÃ£o financeira.
- [ ] `ADMIN` validado sem ver dados financeiros durante o setup, apenas a aÃ§Ã£o de indicar o gestor.

## Etapa 4 - AutorizaÃ§Ã£o backend

Objetivo: tornar o backend a fonte de verdade das permissÃµes financeiras.

- [x] Criar endpoint para consultar permissÃ£o financeira do usuÃ¡rio atual.
- [x] Criar endpoint para listar permissÃµes financeiras.
- [x] Criar endpoint para conceder permissÃ£o financeira.
- [x] Criar endpoint para alterar permissÃ£o financeira.
- [x] Criar endpoint para remover permissÃ£o financeira.
- [x] Aplicar regra `FINANCE_MANAGER` para gerenciar permissÃµes.
- [x] Aplicar exceÃ§Ã£o controlada para `ADMIN` configurar o primeiro gestor.
- [x] Bloquear remoÃ§Ã£o do Ãºltimo `FINANCE_MANAGER`.
- [x] Centralizar regra em service reutilizÃ¡vel.
- [x] Extrair autorizaÃ§Ã£o financeira para `FinanceAuthorizationService` reutilizÃ¡vel antes dos endpoints financeiros de dados reais.

Regras:

- [x] `FINANCE_VIEWER`: acessa a tela financeira inicial em leitura.
- [ ] `FINANCE_OPERATOR`: criar lanÃ§amentos simples quando essa etapa existir.
- [ ] `FINANCE_APPROVER`: aprovar/rejeitar/cancelar movimentaÃ§Ãµes sensÃ­veis quando o fluxo existir.
- [x] `FINANCE_MANAGER`: gerencia permissÃµes financeiras.

EntregÃ¡vel:

- [x] Backend protegendo permissÃµes financeiras sem depender apenas da UI.

CritÃ©rios de aceite:

- [x] ValidaÃ§Ã£o runtime de concessÃ£o do primeiro `FINANCE_MANAGER`.
- [x] Service de autorizaÃ§Ã£o reutilizÃ¡vel definido antes de criar dados financeiros reais.

## Etapa 5 - ConfiguraÃ§Ãµes > UsuÃ¡rios

Objetivo: configurar permissÃµes financeiras no mesmo local onde o usuÃ¡rio jÃ¡ Ã© administrado.

- [x] Manter o campo atual `Perfil/PermissÃ£o` para `ADMIN`, `STAFF` e `BASIC`.
- [x] Adicionar seÃ§Ã£o `PermissÃµes especÃ­ficas`.
- [x] Adicionar grupo `Financeiro`.
- [x] Exibir opÃ§Ã£o `Sem acesso`.
- [x] Exibir opÃ§Ã£o `Visualizador`.
- [x] Exibir opÃ§Ã£o `Operador`.
- [x] Exibir opÃ§Ã£o `Aprovador`.
- [x] Exibir opÃ§Ã£o `Gestor financeiro`.
- [x] Ocultar a seÃ§Ã£o para usuÃ¡rios sem autoridade para gerenciar financeiro.
- [x] Mostrar setup inicial para `ADMIN` somente quando o tenant nÃ£o tiver gestor financeiro.
- [ ] Revisar acesso de `FINANCE_MANAGER` que nÃ£o seja `ADMIN`, porque a tela `ConfiguraÃ§Ãµes` continua restrita ao `ADMIN` global.

EntregÃ¡vel:

- [x] PermissÃ£o financeira configurÃ¡vel no modal de usuÃ¡rio.

CritÃ©rios de aceite:

- [x] Campo global e permissÃ£o financeira ficam separados.
- [x] AlteraÃ§Ã£o de perfil global nÃ£o altera automaticamente permissÃ£o financeira.
- [x] AlteraÃ§Ã£o de permissÃ£o financeira nÃ£o altera perfil global.
- [ ] ValidaÃ§Ã£o manual das aÃ§Ãµes sem permissÃ£o nÃ£o aparecendo na UI.

## Etapa 6 - NavegaÃ§Ã£o e rota financeira

Objetivo: expor o mÃ³dulo somente para quem pode usar.

- [x] Mostrar item `/financeiro` na sidebar somente para usuÃ¡rio com permissÃ£o financeira.
- [x] Mostrar item `/financeiro` para `ADMIN` somente no bootstrap inicial sem gestor financeiro.
- [x] Remover bloqueio de `/financeiro` por `Role.BASIC` no middleware, porque o financeiro usa permissÃ£o especÃ­fica.
- [x] Proteger rota no frontend consultando permissÃ£o financeira.
- [x] Proteger regra equivalente no backend via endpoint de permissÃ£o.
- [x] Criar estado inicial do financeiro com cards vazios.
- [x] Criar CTA de setup inicial para `ADMIN` em tenant sem gestor financeiro.

EntregÃ¡vel:

- [x] Rota `/financeiro` deixa de ser Coming Soon e passa a ter acesso controlado.

CritÃ©rios de aceite:

- [ ] UsuÃ¡rio sem permissÃ£o validado sem menu financeiro.
- [ ] Acesso direto por URL validado como bloqueado.
- [ ] `ADMIN` sem permissÃ£o validado sem acesso financeiro quando jÃ¡ existe gestor.
- [ ] `FINANCE_VIEWER` validado acessando leitura inicial.

## Etapa 7 - Categorias e contas

Objetivo: preparar a estrutura mÃ­nima para lanÃ§amentos.

- [x] Criar categorias de entrada.
- [x] Criar categorias de despesa.
- [x] Criar contas/caixas.
- [x] Criar status ativo/inativo.
- [x] Criar filtros simples.
- [x] Prevenir exclusÃ£o fÃ­sica usando inativaÃ§Ã£o.

PermissÃ£o mÃ­nima:

- [x] `FINANCE_MANAGER`.

## Etapa 8 - Entradas financeiras

Objetivo: registrar dÃ­zimos, ofertas e outras entradas.

- [x] Criar cadastro de entrada.
- [x] Incluir data.
- [x] Incluir valor.
- [x] Incluir categoria.
- [x] Incluir conta/caixa.
- [x] Incluir descriÃ§Ã£o.
- [x] Decidir e implementar contribuinte opcional.
  - Entradas permitem vÃ­nculo opcional com membro; despesas mantÃªm fornecedor manual.
- [x] Permitir vÃ­nculo opcional com membro em lanÃ§amentos de entrada.
- [x] Incluir filtro por membro na listagem de lanÃ§amentos.
- [x] Criar listagem e filtros.

PermissÃ£o mÃ­nima:

- [x] Criar/editar: `FINANCE_OPERATOR` ou superior conforme regra final.
- [x] Visualizar: `FINANCE_VIEWER` ou superior.

## Etapa 9 - Despesas simples

Objetivo: registrar saÃ­das bÃ¡sicas com seguranÃ§a.

- [x] Criar cadastro de despesa.
- [x] Incluir data.
- [x] Incluir valor.
- [x] Incluir categoria.
- [x] Incluir conta/caixa.
- [x] Incluir fornecedor opcional.
- [x] Incluir descriÃ§Ã£o.
- [x] Criar status inicial simples.
- [x] Usar cancelamento em vez de exclusÃ£o fÃ­sica.

PermissÃ£o mÃ­nima:

- [x] Criar/editar: `FINANCE_OPERATOR` ou superior conforme regra final.
- [x] Cancelar: `FINANCE_APPROVER` ou `FINANCE_MANAGER`.

## Etapa 10 - Saldo e extrato bÃ¡sico

Objetivo: entregar visÃ£o Ãºtil para a tesouraria.

- [x] Calcular saldo por conta.
- [x] Calcular total de entradas.
- [x] Calcular total de despesas.
- [x] Calcular saldo do perÃ­odo.
- [x] Criar extrato filtrável por período, categoria, conta e tipo.
  - Backend aceita filtros por período, categoria, conta, tipo e status; UI filtra por período, descrição, tipo e status.
- [x] Criar exportação CSV inicial reaproveitando `ExportShell` e `useExport`.
- [x] Criar impressão inicial do extrato financeiro reaproveitando o padrão de Agenda/Escalas.

PermissÃ£o mÃ­nima:

- [x] `FINANCE_VIEWER`.

## Etapa 11 - PrÃ³ximas entregas

ApÃ³s o MVP:

- [x] anexos e comprovantes;
  - Implementado comprovante opcional por lançamento, com upload/substituição/remoção e link na listagem/exportação.
  - Bucket público `financial-receipts` versionado em `infra/supabase/storage`; pendente apenas aplicar Terraform no projeto Supabase alvo antes de validar upload integrado.
- [ ] aprovaÃ§Ãµes mais robustas;
- [ ] relatÃ³rios em PDF pela Central de Documentos;
- [ ] painel de indicadores;
- [ ] orÃ§amento por categoria;
- [ ] conciliaÃ§Ã£o bancÃ¡ria;
- [ ] importaÃ§Ã£o OFX/CSV;
- [ ] controle patrimonial;
- [ ] notificaÃ§Ãµes financeiras pela Central de NotificaÃ§Ãµes.

## Checklist de validaÃ§Ã£o

- [x] `npx prisma validate`;
- [x] `npx prisma generate`;
- [x] build/typecheck da API;
- [x] build/typecheck do web;
- [x] migration executada em banco local;
- [ ] novo tenant recebe `FINANCE_MANAGER` inicial;
- [x] tenant existente sem gestor permite setup por `ADMIN`;
- [ ] tenant existente com gestor bloqueia `ADMIN` sem permissÃ£o financeira;
- [x] `FINANCE_MANAGER` gerencia permissÃµes;
- [ ] `FINANCE_VIEWER` acessa somente leitura;
- [ ] usuÃ¡rio sem permissÃ£o nÃ£o vÃª menu e nÃ£o acessa URL direta;
- [ ] permissÃµes nÃ£o atravessam tenant;
- [x] alteraÃ§Ãµes sensÃ­veis de permissÃ£o ficam auditÃ¡veis no endpoint de update;
- [x] backend bloqueia remoÃ§Ã£o do Ãºltimo `FINANCE_MANAGER`;
- [x] fluxos de entradas, despesas e saldo funcionam no MVP.

## Ajuste de navegação - duas telas

Decisão atual:

- [x] Manter gerenciamento e visualização como telas principais do módulo financeiro.
- [x] Usar `/financeiro` como tela de gerenciamento.
- [x] Usar `/financeiro/visualizacao` como tela de visualização.
- [x] Criar `/financeiro/exportacao` seguindo o padrão de exportação dos demais módulos.
- [x] Não criar uma terceira tela de resumo nesta entrega.
- [x] Exibir resumo financeiro dentro da tela de visualização.
- [x] Separar o menu financeiro em `Gerenciamento`, `Visualização` e `Exportação`, seguindo o padrão dos demais módulos.
- [x] Padronizar títulos do cabeçalho como `Gerenciamento Financeiro`, `Visualização Financeira` e `Exportação Financeira`.

## Plano de refatoração ODS - Financeiro

Objetivo: alinhar as telas `/financeiro` e `/financeiro/visualizacao` ao ODS e aos padrões já usados em membros, ministérios, escalas e agenda, sem mudar a regra de negócio do MVP financeiro.

Diagnóstico atual:

- [x] A tela de gerenciamento foi alinhada ao padrão visual dos demais módulos, com cadastros auxiliares agrupados.
- [x] Os cadastros de contas, categorias e lançamentos usam modais CRUD.
- [x] As listagens de contas e categorias usam `DataTable` sem cabeçalho, em formato de cadastro auxiliar.
- [x] Os filtros principais reaproveitam `FilterShell`, `FilterActions`, `FilterInput`, `FilterSelect` e `useFilterState`.
- [x] Labels e cores de status/tipo financeiro estão centralizados em utilitário compartilhado do módulo.
- [x] As chamadas de API e regras de carregamento foram concentradas em hook compartilhado do financeiro.
- [x] A tela de visualização mantém somente consulta, com `StatCard`, filtros e extrato read-only.
- [x] Os estados de erro seguem o padrão com erro inline e ação de retry quando aplicável.

Etapa R1 - Utilitários e hook do módulo:

- [x] Criar tipos compartilhados do financeiro no frontend.
- [x] Centralizar labels de `FinanceRole`, tipos de conta, tipos de categoria, tipos de lançamento e status de lançamento.
- [x] Centralizar classes/cores de badges financeiros.
- [x] Criar hook `useFinanceiro` ou hooks menores por domínio (`useFinancialAccounts`, `useFinancialCategories`, `useFinancialTransactions`).
- [x] Remover chamadas diretas repetidas de API das páginas.

Etapa R2 - Gerenciamento `/financeiro`:

- [x] Manter `PageHeader` com ação primária clara para novo lançamento ou nova entidade conforme decisão de UX.
- [x] Remover indicadores da tela de gerenciamento, mantendo métricas apenas em `/financeiro/visualizacao`.
- [x] Deixar lançamentos como bloco principal da tela.
- [x] Agrupar contas e categorias em `Cadastros auxiliares`.
- [x] Deixar `Cadastros auxiliares` minimizável para reduzir ocupação vertical.
- [x] Remover limite `max-w-7xl` das telas financeiras para melhor uso de monitores largos.
- [x] Substituir formulários inline por modais CRUD para conta, categoria e lançamento.
- [x] Usar `DataTable` para contas.
- [x] Usar `DataTable` para categorias.
- [x] Usar `DataTable` ou lista responsiva padronizada para lançamentos, conforme comportamento mobile validado.
- [x] Ajustar lançamentos, contas e categorias para o padrão visual de cards usado no gerenciamento de agenda.
- [x] Padronizar badges, fontes, pesos, espaçamentos, metadados e botões com o gerenciamento de eventos.
- [x] Padronizar botões de editar/inativar/cancelar conforme ações compactas usadas nos outros módulos.
- [x] Manter ações ocultas para quem não tiver permissão financeira suficiente.
- [x] Substituir cancelamento/inativação direta por modal de confirmação custom quando houver risco destrutivo ou reversão limitada.
- [x] Remover filtros auxiliares de contas e categorias por não agregarem valor em listas pequenas.
- [x] Padronizar modais financeiros com `ModalShell`, `ModalFooter`, campos compartilhados e rodapé fixo no shell.
- [x] Padronizar feedback de sucesso para criação, edição, cancelamento e inativação.
- [x] Aplicar filtro padrão do mês atual no gerenciamento financeiro.

Etapa R3 - Visualização `/financeiro/visualizacao`:

- [x] Manter `StatCard` para saldo, entradas e despesas.
- [x] Padronizar filtros com o mesmo layout usado nas telas de visualização existentes.
- [x] Garantir que a rota seja estritamente read-only.
- [x] Exibir extrato com layout responsivo seguindo o padrão de visualização: tabela em desktop e cards legíveis em mobile, se necessário.
- [x] Ajustar extrato da visualização para o mesmo padrão de cards usado no gerenciamento de agenda.
- [x] Manter transição visual mínima entre gerenciamento/visualização de eventos e telas financeiras.
- [x] Usar `EmptyState` com descrição e orientação de ajuste de filtros.
- [x] Incluir retry para erro de carregamento.
- [x] Aplicar filtro padrão do mês atual na visualização financeira.
- [x] Incluir botão de impressão reaproveitando o padrão de Agenda/Escalas.
- [x] Usar título `Extrato Financeiro` no documento impresso.

Etapa R3.1 - Exportação `/financeiro/exportacao`:

- [x] Criar rota `/financeiro/exportacao`.
- [x] Reaproveitar `ExportShell`.
- [x] Reaproveitar `useExport`.
- [x] Exportar lançamentos financeiros em CSV.
- [x] Incluir item `Exportação` na navegação do financeiro.

Etapa R4 - Navegação e permissões visuais:

- [x] Confirmar sidebar com `Gerenciamento` e `Visualização` para usuários com permissão financeira.
- [ ] Confirmar que usuário sem permissão não vê o menu financeiro.
- [x] Confirmar que `BASIC` com permissão financeira enxerga o menu financeiro.
- [x] Confirmar que ações de criar/editar/cancelar não aparecem para `FINANCE_VIEWER`.

Etapa R5 - Validação:

- [x] Build/typecheck do web.
- [ ] Testar gerenciamento com `FINANCE_MANAGER`.
- [ ] Testar criação de lançamento com `FINANCE_OPERATOR`.
- [ ] Testar cancelamento com `FINANCE_APPROVER`.
- [ ] Testar visualização com `FINANCE_VIEWER`.
- [ ] Testar bloqueio visual e acesso direto para usuário sem permissão financeira.
- [ ] Testar responsividade das duas telas.
