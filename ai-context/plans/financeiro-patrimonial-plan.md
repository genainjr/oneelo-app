# Plano - Financeiro e Patrimonial

Status: planejado  
Criado em: 23/07/2026  
Branch sugerida: `feature/financeiro-patrimonial`  
Backlog relacionado: [financeiro-patrimonial.md](../backlog/financeiro-patrimonial.md)

## Objetivo

Iniciar o módulo financeiro com segurança, isolamento por tenant e permissões próprias, sem depender do papel global `ADMIN`.

O primeiro valor entregue deve permitir que a igreja configure quem acessa o financeiro antes de registrar dados sensíveis. Depois disso, o MVP avança para categorias, contas, entradas, despesas simples e saldo/extrato básico.

## Decisões alinhadas

- `User.role` continua sendo a permissão global do sistema.
- Financeiro terá permissão própria por tenant.
- `ADMIN` global não acessa financeiro por padrão.
- Novo tenant nasce com o usuário dono como `ADMIN` global e `FINANCE_MANAGER`.
- Tenant existente sem `FINANCE_MANAGER` ativo permite que um `ADMIN` configure o primeiro gestor financeiro.
- Depois que existe `FINANCE_MANAGER` ativo, somente `FINANCE_MANAGER` gerencia permissões financeiras.
- A configuração inicial fica em `Configurações > Usuários`, mantendo o campo atual `Perfil/Permissão` e adicionando `Permissões específicas > Financeiro`.
- No MVP, cada usuário terá um único nível financeiro: `Sem acesso`, `Visualizador`, `Operador`, `Aprovador` ou `Gestor financeiro`.
- Uma tela futura em `Financeiro > Configurações > Permissões` pode existir como atalho, mas não deve criar outra fonte de verdade.

## Fora do escopo inicial

- conciliação bancária;
- importação OFX/CSV;
- relatórios avançados;
- DRE;
- controle patrimonial completo;
- comprovantes e anexos obrigatórios;
- fluxo complexo de aprovação em múltiplas etapas;
- notificações financeiras robustas;
- tela própria de permissões dentro do financeiro.

## Etapa 0 - Auditoria do estado atual

Objetivo: mapear onde encaixar o módulo sem criar padrões paralelos.

Verificar:

- fluxo de criação de tenant;
- fluxo de criação do primeiro usuário/dono;
- modelo `User.role`;
- tela `Configurações > Usuários`;
- guardas/autorização backend;
- sidebar e regras de navegação;
- padrão de auditoria existente;
- padrão de CRUD e mensagens do ODS;
- se já existe conceito explícito de dono do tenant.

Saída esperada:

- lista dos pontos de integração;
- confirmação se o bootstrap do novo tenant usa o usuário criador, dono ou primeiro `ADMIN`;
- riscos de migration para tenants existentes.

## Etapa 1 - Modelo de permissões financeiras

Objetivo: criar a base de autorização do módulo.

Implementar:

- enum de permissão financeira:
  - `FINANCE_VIEWER`;
  - `FINANCE_OPERATOR`;
  - `FINANCE_APPROVER`;
  - `FINANCE_MANAGER`.
- modelo de permissão financeira por tenant e usuário;
- vínculo com `tenantId` e `userId`;
- campos de auditoria:
  - `createdAt`;
  - `createdByUserId`;
  - `updatedAt`;
  - `updatedByUserId`;
  - `revokedAt`, se o histórico exigir revogação lógica.
- regra para impedir mais de uma permissão ativa por usuário no mesmo tenant.

Validação:

- migration gerada;
- Prisma validado e client regenerado;
- tenant isolation preservado.

## Etapa 2 - Bootstrap para novo tenant

Objetivo: evitar que um tenant novo nasça sem responsável financeiro.

Implementar:

- no fluxo de criação/onboarding do tenant, criar permissão `FINANCE_MANAGER` para o usuário dono;
- garantir idempotência se o fluxo for reexecutado;
- registrar auditoria de criação automática;
- manter `User.role = ADMIN` separado da permissão financeira.

Critérios:

- novo tenant tem exatamente um gestor financeiro inicial;
- o gestor inicial acessa `/financeiro`;
- outro `ADMIN` criado depois não ganha financeiro automaticamente.

## Etapa 3 - Bootstrap para tenant existente

Objetivo: permitir configuração inicial sem liberar dados financeiros para todos os administradores.

Regra para usuários já existentes:

- nenhum usuário existente recebe permissão financeira automaticamente;
- usuários `ADMIN`, `STAFF` e `BASIC` continuam com o mesmo `User.role`;
- todos começam como `Sem acesso` ao financeiro até que uma permissão específica seja concedida;
- a única exceção é o bootstrap: se o tenant ainda não tiver nenhum `FINANCE_MANAGER`, um `ADMIN` existente pode indicar o primeiro gestor financeiro;
- depois do primeiro `FINANCE_MANAGER`, novos acessos financeiros para usuários existentes ou novos usuários só podem ser concedidos por `FINANCE_MANAGER`.

Implementar:

- detecção de tenant sem `FINANCE_MANAGER` ativo;
- permitir que `ADMIN` configure o primeiro gestor financeiro apenas nesse cenário;
- bloquear essa ação se já existir `FINANCE_MANAGER`;
- registrar auditoria da ação;
- exibir mensagem clara na UI para orientar a configuração inicial.

Critérios:

- tenant sem gestor financeiro permite setup inicial por `ADMIN`;
- tenant com gestor financeiro bloqueia `ADMIN` sem permissão financeira;
- `ADMIN` não vê dados financeiros durante o setup, apenas a ação de indicar o gestor.

## Etapa 4 - Autorização backend

Objetivo: tornar o backend a fonte de verdade das permissões financeiras.

Implementar:

- helper/guard de permissão financeira;
- endpoint para consultar permissão financeira do usuário atual;
- endpoints para conceder, alterar e remover permissão financeira;
- regra `FINANCE_MANAGER` para gerenciar permissões;
- exceção controlada para `ADMIN` configurar o primeiro gestor quando não existir nenhum;
- proteção da futura área `/financeiro`.

Regras:

- `FINANCE_VIEWER`: visualiza dados financeiros;
- `FINANCE_OPERATOR`: cria lançamentos simples dentro das regras da etapa correspondente;
- `FINANCE_APPROVER`: aprova/rejeita/cancela movimentações sensíveis quando o fluxo existir;
- `FINANCE_MANAGER`: gerencia cadastros, configurações e permissões financeiras.

## Etapa 5 - Configurações > Usuários

Objetivo: configurar permissões financeiras no mesmo local onde o usuário já é administrado.

Implementar:

- manter o campo atual `Perfil/Permissão` para `ADMIN`, `STAFF` e `BASIC`;
- adicionar seção `Permissões específicas`;
- dentro dela, adicionar grupo `Financeiro`;
- exibir seletor:
  - `Sem acesso`;
  - `Visualizador`;
  - `Operador`;
  - `Aprovador`;
  - `Gestor financeiro`.
- ocultar a seção para usuários sem autoridade para gerenciar financeiro;
- mostrar o setup inicial para `ADMIN` somente quando o tenant não tiver gestor financeiro.

Critérios:

- não existem dois locais diferentes de verdade para a mesma permissão;
- alteração de perfil global não altera automaticamente permissão financeira;
- alteração de permissão financeira não altera perfil global;
- ações sem permissão não aparecem na UI.

## Etapa 6 - Navegação e rota financeira

Objetivo: expor o módulo somente para quem pode usar.

Implementar:

- item `/financeiro` na sidebar somente para usuário com permissão financeira;
- rota protegida no frontend;
- proteção equivalente no backend;
- estado inicial do financeiro com cards vazios e mensagem de módulo em preparação;
- CTA de setup inicial apenas para `ADMIN` em tenant sem gestor financeiro.

Critérios:

- usuário sem permissão não vê menu financeiro;
- acesso direto por URL é bloqueado;
- `ADMIN` sem permissão não acessa financeiro quando já existe gestor;
- `FINANCE_VIEWER` acessa leitura inicial.

## Etapa 7 - Categorias e contas

Objetivo: preparar a estrutura mínima para lançamentos.

Implementar:

- categorias de entrada;
- categorias de despesa;
- contas/caixas;
- status ativo/inativo;
- filtros simples;
- prevenção de exclusão física quando houver vínculo.

Permissão mínima:

- `FINANCE_MANAGER`.

## Etapa 8 - Entradas financeiras

Objetivo: registrar dízimos, ofertas e outras entradas.

Implementar:

- cadastro de entrada;
- data;
- valor;
- categoria;
- conta/caixa;
- descrição;
- contribuinte opcional, se a decisão for manter identificação opcional no MVP;
- listagem e filtros.

Permissão mínima:

- criar/editar: `FINANCE_OPERATOR` ou superior conforme regra final;
- visualizar: `FINANCE_VIEWER` ou superior.

## Etapa 9 - Despesas simples

Objetivo: registrar saídas básicas com segurança.

Implementar:

- cadastro de despesa;
- data;
- valor;
- categoria;
- conta/caixa;
- fornecedor opcional;
- descrição;
- status inicial simples;
- cancelamento em vez de exclusão física.

Permissão mínima:

- criar/editar: `FINANCE_OPERATOR` ou superior conforme regra final;
- aprovar/cancelar, se houver aprovação no MVP: `FINANCE_APPROVER` ou `FINANCE_MANAGER`.

## Etapa 10 - Saldo e extrato básico

Objetivo: entregar visão útil para a tesouraria.

Implementar:

- saldo por conta;
- total de entradas;
- total de despesas;
- saldo do período;
- extrato filtrável por período, categoria, conta e tipo;
- exportação futura alinhada à Central de Documentos.

Permissão mínima:

- `FINANCE_VIEWER`.

## Etapa 11 - Próximas entregas

Após o MVP:

- anexos e comprovantes;
- aprovações mais robustas;
- relatórios em PDF pela Central de Documentos;
- painel de indicadores;
- orçamento por categoria;
- conciliação bancária;
- importação OFX/CSV;
- controle patrimonial;
- notificações financeiras pela Central de Notificações.

## Checklist de validação

- `npx prisma validate`;
- `npx prisma generate`;
- build/typecheck da API;
- build/typecheck do web;
- novo tenant recebe `FINANCE_MANAGER` inicial;
- tenant existente sem gestor permite setup por `ADMIN`;
- tenant existente com gestor bloqueia `ADMIN` sem permissão financeira;
- `FINANCE_MANAGER` gerencia permissões;
- `FINANCE_VIEWER` acessa somente leitura;
- usuário sem permissão não vê menu e não acessa URL direta;
- permissões não atravessam tenant;
- alterações sensíveis ficam auditáveis;
- fluxos de entradas, despesas e saldo funcionam no MVP.
