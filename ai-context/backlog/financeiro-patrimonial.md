# Backlog - Financeiro e Patrimonial

### FT-014 Financeiro e Patrimonial

- **Prioridade**: alta
- **Fase**: evolução funcional cobrada por usuário
- **Categoria**: produto / financeiro / governança / relatórios / permissões
- **Esforço estimado**: alto
- **Contexto**: o módulo Financeiro existe hoje apenas como página `ComingSoon`. Há demanda real de usuário para começar entregas mínimas, mas o domínio exige cuidado maior que módulos operacionais comuns por envolver dados sensíveis, acesso restrito, rastreabilidade e possibilidade de decisões financeiras da igreja.
- **Ação**: criar um backlog incremental para permitir entregar valor em fatias pequenas, começando por permissões específicas e controle financeiro básico antes de avançar para conciliação bancária, patrimônio e relatórios avançados.
- **Impacto**: permite iniciar o módulo com segurança, reduz risco de expor dados financeiros para perfis indevidos e cria base para tesouraria, liderança e prestação de contas.

## Problema atual

O sistema possui rota `/financeiro`, mas ela é apenas uma tela de expectativa.

Ainda não existe:

- modelo financeiro no banco;
- permissões específicas do financeiro;
- cadastro de entradas;
- cadastro de despesas;
- categorias financeiras;
- contas, caixas ou centros financeiros;
- relatórios de caixa;
- anexos de comprovantes;
- aprovação de despesas;
- trilha de auditoria financeira;
- separação clara entre quem lança, quem aprova e quem visualiza.

## Objetivo

Criar um módulo financeiro seguro e incremental, começando pelo menor conjunto útil para controle básico da tesouraria da igreja.

O módulo deve permitir:

1. controlar entradas e saídas;
2. restringir acesso por permissões financeiras específicas;
3. gerar visão simples de saldo e movimentações;
4. manter histórico auditável;
5. evoluir para patrimônio, conciliação e relatórios avançados.

## Direção de produto

Financeiro não deve usar apenas as permissões globais atuais (`ADMIN`, `STAFF`, `BASIC`).

O módulo precisa de permissões próprias, porque:

- nem todo `ADMIN` operacional deve necessariamente ver finanças;
- `STAFF` pode operar parte do sistema sem acessar financeiro;
- tesoureiro pode precisar de acesso financeiro sem ser administrador geral;
- pastor/liderança pode precisar de visão consolidada sem permissão de edição;
- auditor/contador pode precisar visualizar relatórios sem alterar lançamentos.

## Papéis e permissões financeiras sugeridas

### Perfis financeiros

Modelo sugerido: criar permissões financeiras por usuário dentro do tenant, independentes do papel global.

Perfis iniciais:

- `FINANCE_VIEWER`: visualiza dashboards, saldos e relatórios.
- `FINANCE_OPERATOR`: lança entradas e despesas em rascunho ou pendentes.
- `FINANCE_APPROVER`: aprova, rejeita ou cancela movimentações sensíveis.
- `FINANCE_MANAGER`: gerencia categorias, contas, permissões financeiras e configurações.

Possível perfil futuro:

- `FINANCE_AUDITOR`: visualiza histórico e relatórios, sem alterar dados.

### Regras iniciais

- `SUPER_ADMIN` não deve acessar dados financeiros de tenant como regra operacional comum, salvo suporte explícito e auditado.
- `ADMIN` global não acessa financeiro por padrão.
- Permissão financeira é uma camada específica do módulo, separada de `User.role`.
- Novo tenant deve nascer com o usuário criador/dono como `ADMIN` global e `FINANCE_MANAGER`.
- Tenant existente sem `FINANCE_MANAGER` ativo permite que um `ADMIN` indique o primeiro gestor financeiro.
- Depois que o tenant possui ao menos um `FINANCE_MANAGER` ativo, somente `FINANCE_MANAGER` pode conceder, alterar ou remover permissões financeiras.
- `BASIC` comum não acessa financeiro.
- Permissões financeiras devem ser validadas no backend.
- A UI deve ocultar ações sem permissão, mas não pode ser a barreira principal.
- Toda alteração financeira relevante precisa registrar autor e data.

### Bootstrap inicial de permissões financeiras

Novo tenant:

- o fluxo de criação/onboarding do tenant deve criar a primeira permissão financeira para o usuário dono;
- esse usuário fica com `User.role = ADMIN` e permissão financeira `FINANCE_MANAGER`;
- essa regra evita tenant sem responsável financeiro no primeiro acesso.

Tenant existente:

- não migrar todos os `ADMIN` automaticamente para `FINANCE_MANAGER`;
- nenhum usuário existente recebe permissão financeira automaticamente;
- usuários existentes continuam com o mesmo `User.role` e começam como `Sem acesso` ao financeiro;
- se não existir gestor financeiro ativo, um `ADMIN` pode acessar uma ação de configuração inicial para definir o primeiro `FINANCE_MANAGER`;
- essa ação deve ser única, auditável e bloqueada assim que houver gestor financeiro ativo.

Interface inicial:

- a configuração principal deve ficar em `Configurações > Usuários`, junto do usuário;
- manter o campo atual `Perfil/Permissão` para o papel global do sistema;
- adicionar uma seção separada `Permissões específicas`, com o grupo `Financeiro`;
- no MVP, usar um seletor único por usuário: `Sem acesso`, `Visualizador`, `Operador`, `Aprovador` e `Gestor financeiro`;
- uma tela futura em `Financeiro > Configurações > Permissões` pode existir como atalho operacional, mas deve usar a mesma fonte de verdade.

## Entregas mínimas sugeridas

### Entrega 1 - Fundação, permissões financeiras e bootstrap inicial

Objetivo: liberar acesso controlado antes de qualquer dado financeiro real.

Escopo:

- criar estrutura de permissões financeiras por tenant;
- configurar bootstrap para novo tenant com `FINANCE_MANAGER` inicial;
- configurar bootstrap para tenant existente sem gestor financeiro;
- incluir permissões financeiras em `Configurações > Usuários`;
- proteger rota `/financeiro`;
- criar menu visível apenas para usuários autorizados;
- criar tela inicial do financeiro com estado vazio e cartões básicos.

Critérios de aceite:

- usuário sem permissão não acessa `/financeiro`;
- `ADMIN` sem permissão financeira não acessa dados financeiros quando já existe gestor financeiro no tenant;
- novo tenant nasce com o dono como `FINANCE_MANAGER`;
- tenant existente sem gestor financeiro permite configuração inicial por `ADMIN`;
- tenant existente com gestor financeiro bloqueia `ADMIN` sem permissão de alterar permissões financeiras;
- usuário com `FINANCE_VIEWER` acessa tela inicial;
- usuário com `FINANCE_MANAGER` gerencia permissões financeiras;
- alterações de permissões ficam auditáveis;
- permissões não atravessam tenant.

Valor entregue:

- módulo passa a existir com segurança;
- a igreja pode definir quem terá acesso antes de lançar dados.

### Entrega 2 - Categorias e contas financeiras

Objetivo: criar a base para organizar movimentações.

Escopo:

- cadastro de categorias de entrada;
- cadastro de categorias de despesa;
- cadastro de contas/caixas, por exemplo: caixa igreja, banco, pix, dinheiro;
- status ativo/inativo;
- ordenação e filtros simples.

Critérios de aceite:

- `FINANCE_MANAGER` cria e edita categorias/contas;
- categorias usadas em movimentações futuras não podem ser excluídas fisicamente;
- inativação preserva histórico;
- tenant isolado.

Valor entregue:

- tesouraria consegue preparar a estrutura antes de lançar movimentações.

### Entrega 3 - Lançamentos simples de entradas

Objetivo: registrar dízimos, ofertas e outras entradas.

Escopo:

- criar entrada financeira;
- data da entrada;
- valor;
- categoria;
- conta/caixa;
- forma de pagamento;
- descrição;
- contribuinte opcional vinculado a membro;
- origem opcional: culto, evento ou manual;
- status inicial simples: confirmado ou rascunho, conforme decisão de produto.

Critérios de aceite:

- `FINANCE_OPERATOR` lança entrada;
- `FINANCE_VIEWER` apenas visualiza;
- valores são positivos e validados;
- alteração posterior fica auditável;
- contribuinte pode ficar em branco para ofertas anônimas.

Valor entregue:

- primeira funcionalidade financeira real para uso da igreja.

### Entrega 4 - Lançamentos simples de despesas

Objetivo: registrar saídas financeiras básicas.

Escopo:

- criar despesa;
- data da despesa;
- valor;
- categoria;
- conta/caixa;
- fornecedor ou favorecido opcional;
- descrição;
- comprovante opcional;
- status: rascunho, pendente, pago/cancelado.

Critérios de aceite:

- `FINANCE_OPERATOR` lança despesa;
- comprovante é salvo com escopo por tenant;
- valores são positivos e entram como saída nos relatórios;
- cancelamento preserva histórico;
- usuário sem permissão não acessa anexos.

Valor entregue:

- igreja passa a controlar despesas junto com entradas.

### Entrega 5 - Saldo e extrato básico

Objetivo: dar visão operacional simples.

Escopo:

- saldo por período;
- total de entradas;
- total de saídas;
- saldo líquido;
- extrato paginado;
- filtros por período, categoria, conta, tipo e status;
- exportação simples futura ou integração com Central de Documentos.

Critérios de aceite:

- `FINANCE_VIEWER` visualiza relatórios;
- totais batem com os lançamentos filtrados;
- movimentações canceladas não entram no saldo ativo;
- tenant isolado.

Valor entregue:

- liderança/tesouraria consegue acompanhar caixa mensal.

### Entrega 6 - Aprovação de despesas

Objetivo: separar lançamento e aprovação.

Escopo:

- despesa criada como pendente;
- aprovador aprova ou rejeita;
- registrar motivo da rejeição;
- impedir que o mesmo usuário aprove quando regra de dupla validação for exigida;
- notificação futura para aprovadores.

Critérios de aceite:

- `FINANCE_OPERATOR` cria despesa pendente;
- `FINANCE_APPROVER` aprova ou rejeita;
- ações ficam auditáveis;
- despesa rejeitada não afeta saldo como paga.

Valor entregue:

- melhora governança financeira.

### Entrega 7 - Relatórios financeiros iniciais

Objetivo: evoluir de extrato para prestação de contas.

Escopo:

- relatório mensal de entradas e saídas;
- agrupamento por categoria;
- comparativo mensal simples;
- visão por conta/caixa;
- exportação para PDF pela futura Central de Documentos.

Critérios de aceite:

- dados batem com extrato;
- filtros são claros;
- relatórios respeitam permissões;
- exportação não expõe dados para usuários não autorizados.

Valor entregue:

- base para prestação de contas à liderança.

### Entrega 8 - Patrimônio

Objetivo: iniciar controle patrimonial sem misturar com caixa.

Escopo:

- cadastro de bens;
- categoria patrimonial;
- valor estimado;
- data de aquisição;
- responsável;
- localização;
- estado de conservação;
- status ativo, baixado, manutenção.

Critérios de aceite:

- patrimônio tem permissões financeiras ou patrimoniais definidas;
- baixa preserva histórico;
- bens não entram no saldo financeiro.

Valor entregue:

- controle de equipamentos, imóveis e recursos da igreja.

### Entrega 9 - Conciliação bancária

Objetivo: automatizar conferência, somente depois do fluxo manual estar maduro.

Escopo:

- importação OFX/CSV;
- leitura de extrato;
- sugestão de vínculo com lançamentos existentes;
- marcação como conciliado;
- relatório de pendências.

Critérios de aceite:

- importação não cria lançamentos duplicados sem confirmação;
- usuário revisa sugestões;
- extrato importado fica auditável;
- erros de arquivo são claros.

Valor entregue:

- reduz trabalho operacional da tesouraria.

## Modelo de dados sugerido

### FinancePermission

Permissão financeira por usuário e tenant.

Campos esperados:

- `id`;
- `tenantId`;
- `userId`;
- `role`;
- `createdByUserId`;
- `createdAt`;
- `updatedAt`;
- `revokedAt` opcional.

### FinancialAccount

Conta, caixa ou meio financeiro.

Campos esperados:

- `id`;
- `tenantId`;
- `name`;
- `type`: cash, bank, pix, other;
- `active`;
- `initialBalance` opcional;
- `createdAt`;
- `updatedAt`.

### FinancialCategory

Categoria de entrada ou despesa.

Campos esperados:

- `id`;
- `tenantId`;
- `name`;
- `type`: income ou expense;
- `active`;
- `createdAt`;
- `updatedAt`.

### FinancialTransaction

Movimentação financeira.

Campos esperados:

- `id`;
- `tenantId`;
- `type`: income ou expense;
- `status`;
- `date`;
- `amount`;
- `accountId`;
- `categoryId`;
- `description`;
- `memberId` opcional para contribuinte;
- `supplierName` opcional;
- `paymentMethod`;
- `createdByUserId`;
- `approvedByUserId` opcional;
- `approvedAt` opcional;
- `cancelledByUserId` opcional;
- `cancelledAt` opcional;
- `createdAt`;
- `updatedAt`.

### FinancialAttachment

Comprovantes e arquivos associados.

Campos esperados:

- `id`;
- `tenantId`;
- `transactionId`;
- `storageKey`;
- `fileName`;
- `mimeType`;
- `fileSize`;
- `uploadedByUserId`;
- `createdAt`.

### Asset

Patrimônio.

Campos esperados:

- `id`;
- `tenantId`;
- `name`;
- `category`;
- `estimatedValue`;
- `acquisitionDate`;
- `responsibleMemberId` opcional;
- `location`;
- `condition`;
- `status`;
- `notes`;
- `createdAt`;
- `updatedAt`.

## Regras de segurança e auditoria

- Financeiro deve ter autorização própria no backend.
- Dados financeiros nunca devem ser enviados para usuários sem permissão.
- Anexos financeiros devem usar storage protegido.
- Alterações de valor, status, categoria, conta e comprovante devem ser auditáveis.
- Exclusão física deve ser evitada; preferir cancelamento/inativação.
- Relatórios e exportações devem respeitar o mesmo escopo de permissão.
- Logs não devem expor valores sensíveis além do necessário para auditoria.

## Decisões pendentes

- Haverá papel "Pastor" ou "Liderança" com visão financeira sem edição?
- Despesa nasce sempre pendente ou pode nascer paga?
- Entrada precisa de aprovação?
- Controle de dízimo deve identificar contribuinte por padrão ou ser opcional?
- A igreja precisa de múltiplas contas/caixas já no MVP?
- Comprovante digital entra na primeira entrega de despesas ou depois?
- Patrimônio usa as mesmas permissões do financeiro ou permissões próprias?

## MVP recomendado

Para responder rápido ao usuário que está cobrando, o menor caminho útil seria:

1. permissões financeiras específicas;
2. categorias e contas;
3. entradas;
4. despesas simples;
5. saldo/extrato básico.

Esse MVP evita começar por relatórios avançados, conciliação ou patrimônio, que dependem de uma base confiável de lançamentos.

## Critérios gerais de aceite

- Nenhuma tela financeira aparece para usuário sem permissão.
- Backend bloqueia acesso financeiro sem permissão.
- Lançamentos respeitam tenant.
- Valores são validados.
- Cancelamentos preservam histórico.
- Relatórios simples batem com lançamentos filtrados.
- Anexos não ficam públicos.
- O módulo pode evoluir para relatórios e patrimônio sem refazer a base.
