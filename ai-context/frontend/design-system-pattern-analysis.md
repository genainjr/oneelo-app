# Analise de Padroes do Design System Atual do OneElo

Fonte analisada: `ai-context/frontend/design-system-inventory.md`

Objetivo: identificar quantos padroes de tabela, formulario, filtro, acao e visualizacao existem no frontend atual, agrupando componentes por similaridade.

Observacao: este documento e apenas analitico. Nenhuma implementacao foi realizada.

---

## Resumo Quantitativo

| Categoria | Quantidade de padroes identificados |
|---|---:|
| Padroes de tabela | 4 |
| Padroes de formulario | 8 |
| Padroes de filtro | 4 |
| Padroes de acao | 9 |
| Padroes de visualizacao | 8 |

---

## 1. Padroes de Tabela

### Total: 4 padroes

| Padrao | Componentes / Arquivos | Caracteristica |
|---|---|---|
| Tabela compartilhada generica | `DataTable<T>`, usada em `membros/page.tsx`, `configuracoes/page.tsx` | Tabela reutilizavel com loading, empty state, selecao e paginacao. |
| Tabela HTML administrativa simples | `admin/page.tsx` | Tabela manual para tenants, sem `DataTable`. |
| Tabela read-only responsiva | `membros/visualizacao/page.tsx` | Tabela desktop + cards mobile para consulta. |
| Grade/matriz operacional | `escalas/page.tsx`, `escala-readonly-grid.tsx` | Matriz dias x funcoes, com variacao interativa e read-only. |

### Observacao

O frontend possui um componente de tabela compartilhado, mas ainda mantem tabelas manuais para casos administrativos, read-only e matrizes operacionais.

---

## 2. Padroes de Formulario

### Total: 8 padroes

| Padrao | Componentes / Arquivos | Caracteristica |
|---|---|---|
| Formulario de autenticacao | `/login`, `/admin/login` | E-mail + senha em card centralizado. |
| Formulario publico/comercial | `app/page.tsx` | Lead/demo com nome, e-mail, telefone e mensagem. |
| Formulario CRUD modal simples | `MembroModal`, `UsuarioModal`, `agenda/page.tsx`, `escalas/page.tsx` | Criacao/edicao de entidade em modal. |
| Formulario CRUD modal composto | `ministerios/page.tsx`, `admin/page.tsx` | Formularios com secoes, tabs ou multiplos blocos de dados. |
| Formulario de sub-recurso inline | `ministerios/page.tsx`, `escalas/page.tsx` | Adicionar membro, funcao ou dia dentro de uma entidade pai. |
| Formulario de seguranca/perfil | `meu-perfil/page.tsx` | Troca de senha e dados de perfil. |
| Formulario de exportacao | `*/exportacao/page.tsx` | Selecao de formato e campos para CSV. |
| Formulario de tag/cor | `membros/page.tsx` | Criacao de tag com nome e seletor de cor. |

### Observacao

Os formularios CRUD usam shells de modal muito parecidos, mas implementados em locais diferentes.

---

## 3. Padroes de Filtro

### Total: 4 padroes

| Padrao | Componentes / Arquivos | Caracteristica |
|---|---|---|
| Filtro em card com submit | `membros/page.tsx`, `agenda/page.tsx` | Bloco branco com campos e botoes Aplicar/Limpar. |
| Filtro compacto em toolbar | `escalas/page.tsx` | Filtros horizontais por mes, ano e ministerio. |
| Filtro de visualizacao read-only | `membros/visualizacao/page.tsx`, `escalas/visualizacao/page.tsx` | Filtros combinados com metricas/resumo da visualizacao. |
| Filtro por chips/tags | `membros/page.tsx` | Selecao por tags com operadores AND/OR. |

### Observacao

Os filtros tem comportamento semelhante, mas visual e estrutura variam bastante entre modulos.

---

## 4. Padroes de Acao

### Total: 9 padroes

| Padrao | Componentes / Arquivos | Caracteristica |
|---|---|---|
| Acao primaria no `PageHeader` | Membros, Ministerios, Agenda, Escalas | Botao principal de criacao ou comando de pagina. |
| Acao de linha/tabela | Membros, Configuracoes, Admin | Editar, excluir, desativar ou criar usuario por registro. |
| Acao de card/lista | Ministerios, Agenda, Escalas | Botoes dentro de cards ou listas de entidades. |
| Acao modal footer | Modais de membro, usuario, evento, tenant, escala | Cancelar/salvar/criar no rodape do modal. |
| Acao destrutiva via `confirm()` | Membros, Ministerios, Agenda, Escalas | Confirmacao nativa do browser. |
| Acao destrutiva custom modal | `configuracoes/page.tsx` | Modal proprio para desativar usuario. |
| Acao em massa | `membros/page.tsx` | Banner fixo inferior para aplicar/remover tags em membros selecionados. |
| Acao contextual em grade | `escalas/page.tsx` | Adicionar/remover membro, ocultar celula, remover dia, reordenar dias. |
| Acao de exportacao/download | Paginas `*/exportacao` | Exportar CSV apos selecao de campos. |

### Observacao

Ha inconsistencia entre confirmacao nativa, confirmacao custom e acoes inline. Esse e um dos pontos mais fragmentados do Design System atual.

---

## 5. Padroes de Visualizacao

### Total: 8 padroes

| Padrao | Componentes / Arquivos | Caracteristica |
|---|---|---|
| Dashboard KPI | `dashboard/page.tsx`, `StatCard` | Cards de metricas operacionais. |
| Listagem tabular CRUD | `membros/page.tsx`, `configuracoes/page.tsx` | Tabela com acoes e edicao. |
| Listagem em cards | `ministerios/page.tsx`, `agenda/page.tsx`, `minhas-escalas/page.tsx` | Cards por entidade ou participacao. |
| Visualizacao read-only com detalhes laterais | `membros/visualizacao/page.tsx`, `MemberProfileDrawer` | Consulta + drawer de perfil. |
| Visualizacao read-only imprimivel | `escalas/visualizacao/page.tsx`, `EscalaReadonlyGrid` | Grade de escala para leitura/impressao. |
| Mestre-detalhe operacional | `escalas/page.tsx` | Lista lateral + detalhe com grade interativa. |
| Pagina de exportacao | `*/exportacao/page.tsx` | Selecao de campos, resumo e download. |
| Pagina "em breve" | `ComingSoon`, modulos futuros | Layout padrao para funcionalidades futuras. |

### Observacao

O sistema alterna entre tabela, card, drawer, grade e mestre-detalhe sem uma taxonomia formal aparente.

---

## Agrupamento por Similaridade

### Grupo A: Estrutura de Pagina

| Componentes / Paginas | Similaridade |
|---|---|
| `PageHeader`, paginas CRUD, visualizacoes, exportacoes | Cabecalho com titulo, descricao e acao. |
| `ComingSoon`, paginas futuras | Layout padronizado de placeholder de modulo. |
| `DashboardLayout`, `Sidebar`, `Header`, `ChatbotButton` | Shell autenticado da aplicacao. |
| `AuthLayout`, login tenant, login admin | Experiencia centralizada de autenticacao. |

### Grupo B: Dados Tabulares

| Componentes / Paginas | Similaridade |
|---|---|
| `DataTable`, membros, usuarios, auditoria | Tabela de entidade com colunas configuraveis. |
| Tenants admin | Tabela de entidade, mas manual. |
| Visualizacao de membros | Tabela read-only com responsividade propria. |
| Escala interativa/read-only | Tabela matricial orientada por calendario/funcao. |

### Grupo C: CRUD Modal

| Componentes / Paginas | Similaridade |
|---|---|
| `MembroModal` | CRUD modal simples. |
| `UsuarioModal` | CRUD modal simples com busca de membro. |
| Evento modal | CRUD modal simples inline. |
| Criar escala modal | CRUD modal simples inline. |
| Admin tenant/user modais | CRUD modal com wrapper local. |
| Ministerio modal | CRUD modal complexo com tabs. |

### Grupo D: Busca, Filtro e Selecao

| Componentes / Paginas | Similaridade |
|---|---|
| Filtros de membros, agenda, visualizacoes | Campos com aplicar/limpar/recarregar. |
| Filtro de escalas | Toolbar compacta. |
| Tags de membros | Filtro por chips e operador logico. |
| `MembroSearchCombobox` | Busca/selecao contextual de membro. |

### Grupo E: Feedback e Estados

| Componentes / Paginas | Similaridade |
|---|---|
| `EmptyState` | Estado vazio reutilizavel. |
| Skeletons inline | Loading em tabelas/cards/listas. |
| Alertas inline | Erro/sucesso em forms e paginas. |
| `alert()`/`confirm()` | Feedback nativo disperso. |
| Modal de desativacao usuario | Feedback/confirm custom. |

### Grupo F: Metricas e Resumos

| Componentes / Paginas | Similaridade |
|---|---|
| `StatCard` | Metrica compartilhada no dashboard. |
| `StatBox` local | Metrica simples em visualizacao de membros. |
| Metricas de escalas | Cards locais em `/escalas/visualizacao`. |
| Metricas de minhas escalas | Cards locais em `/minhas-escalas`. |

### Grupo G: Exportacao

| Componentes / Paginas | Similaridade |
|---|---|
| `membros/exportacao` | Selecao de campos + CSV. |
| `ministerios/exportacao` | Selecao de campos + CSV. |
| `escalas/exportacao` | Selecao de campos + CSV. |
| `agenda/exportacao` | Selecao de campos + CSV. |
| `downloadCsv` | Utilitario compartilhado de download. |

---

## Conclusao

O Design System atual ja tem alguns nucleos reutilizaveis claros:

- `PageHeader`
- `DataTable`
- `EmptyState`
- `StatCard`
- `ComingSoon`
- `MembroModal`
- `UsuarioModal`
- `MembroSearchCombobox`
- `EscalaReadonlyGrid`

A maior fragmentacao esta em cinco areas:

1. Shell de modal.
2. Filtros.
3. Exportacoes.
4. Confirmacoes/acoes destrutivas.
5. Visualizacoes de metricas e tabelas read-only.

