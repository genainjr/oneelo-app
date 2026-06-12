# Matriz de Conformidade com o OneElo Design System

Fonte:

- `ai-context/frontend/design-system-inventory.md`
- `ai-context/frontend/design-system-pattern-analysis.md`
- `ai-core/skills/oneelo-design-system/`

Objetivo: comparar todas as telas atuais com o ODS e identificar nivel de conformidade, gaps e prioridades de refatoracao.

Legenda:

- `Alta`: ja segue majoritariamente o ODS.
- `Parcial`: usa parte dos padroes, mas mantem duplicacoes ou anti-padroes.
- `Baixa`: diverge do padrao escolhido.
- `N/A`: rota tecnica ou fora do escopo principal do ODS interno.

---

## Matriz por Tela

| Tela / rota | Padrao ODS esperado | Conformidade | Principais conformidades | Gaps / ajustes futuros |
|---|---|---:|---|---|
| `/` landing | Form publico / marketing | Parcial | Formulario de lead claro | Conflito com redirect `/`; fora do shell interno |
| `/` redirect dashboard | Navegacao tecnica | N/A | Redireciona para `/dashboard` | Conflita conceitualmente com landing |
| `/login` | Auth form | Alta | Card central, e-mail/senha, loading, erro inline | Duplicado com admin login |
| `/admin/login` | Auth form admin | Parcial | Mesmo padrao visual de login | Nao usa `AuthLayout`; duplica `/login` |
| `/admin` | CRUD Super Admin | Baixa | Layout admin, modais, loading, erro | Tabela manual, modal local, `useAdmin` sem padrao loading/error |
| `/dashboard` | View KPI | Alta | Usa `StatCard`, view de metricas | Busca `/api/auth/me` propria |
| `/membros` | CRUD tabular | Parcial alta | `PageHeader`, `DataTable`, `MembroModal`, hook, selecao em massa | `confirm()`/`alert()`, filtro proprio, status/cores locais |
| `/membros/visualizacao` | View read-only | Parcial | `PageHeader`, drawer, filtros, empty state | Tabela manual, `StatBox` local, filtros divergentes |
| `/membros/exportacao` | Export standard | Parcial alta | Estrutura export padrao, `downloadCsv` | Logica duplicada, `STATUS_LABEL` local |
| `/ministerios` | CRUD em cards + modal complexo | Parcial | `PageHeader`, cards, `MembroSearchCombobox`, tabs justificadas | Modal shell inline, `alert()`/`confirm()`, muita logica na pagina |
| `/ministerios/exportacao` | Export standard | Parcial alta | Estrutura export padrao, `downloadCsv` | Logica duplicada entre exportacoes |
| `/ministerios/louvor` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/ministerios/infantil` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/ministerios/midia` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/escalas` | CRUD mestre-detalhe + grade | Parcial | `PageHeader`, hook, grade interativa, permissoes por contexto | Modal inline, `confirm()`, grade duplica read-only |
| `/escalas/visualizacao` | View read-only imprimivel | Alta | `PageHeader`, `EscalaReadonlyGrid`, filtros, print | Metricas locais e filtro visual divergente |
| `/escalas/exportacao` | Export standard | Parcial alta | Estrutura export padrao, `downloadCsv` | Logica duplicada, labels locais |
| `/agenda` | CRUD card/lista | Parcial | `PageHeader`, hook, filtro em card, modal CRUD | Nao usa componente modal comum, `alert()`/`confirm()` |
| `/agenda/exportacao` | Export standard | Parcial alta | Estrutura export padrao, `downloadCsv` | Logica duplicada, labels locais |
| `/minhas-escalas` | View do membro | Parcial | `PageHeader`, `EmptyState`, cards read-only, acao de confirmacao | Metricas locais, mutacao direta na pagina |
| `/meu-perfil` | View perfil + form seguranca | Parcial alta | `PageHeader`, `EmptyState`, form de senha, cards de dados | `Info`/`PasswordField` locais reutilizaveis |
| `/configuracoes` | CRUD tabular + auditoria | Alta | `PageHeader`, `DataTable`, `UsuarioModal`, tabs, confirmacao custom | Badges locais, busca `/api/auth/me` propria |
| `/grupos` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/financeiro` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/integracoes` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |

---

## Resumo por Padrao ODS

| Padrao ODS | Telas conformes | Telas parciais / divergentes |
|---|---|---|
| `PageHeader` | Dashboard internas principais, CRUDs, views, exports | Landing, logins, admin seguem estruturas proprias justificaveis |
| `DataTable` | `/membros`, `/configuracoes` | `/admin`, `/membros/visualizacao` usam tabela manual |
| Modal CRUD | `MembroModal`, `UsuarioModal` | Admin, agenda, ministerios, escalas usam modais inline |
| Exportacao | Todas as rotas `*/exportacao` seguem a mesma UX | Falta consolidacao; labels/status e mapeamento repetidos |
| View read-only | `/escalas/visualizacao`, `/membros/visualizacao`, `/minhas-escalas`, `/meu-perfil` | Metricas, filtros e tabelas read-only ainda variam |
| Permissoes visuais | Sidebar e varias acoes condicionadas | Busca de usuario e regras espalhadas por paginas |
| Feedback | `EmptyState` presente em varias telas | `alert()`/`confirm()` ainda usados em CRUDs |

---

## Prioridade de Refatoracao

### Alta prioridade

- `/admin`
- `/agenda`
- `/ministerios`
- `/escalas`

Motivo: maior duplicacao de modal, confirmacao, acoes e logica inline.

### Media prioridade

- `/membros`
- `/membros/visualizacao`
- `/minhas-escalas`
- `/meu-perfil`

Motivo: ja seguem parte do ODS, mas mantem componentes locais duplicaveis.

### Baixa prioridade

- paginas `*/exportacao`
- paginas `ComingSoon`

Motivo: visualmente consistentes; precisam mais de consolidacao estrutural do que correcao de UX.

---

## Conclusao

O frontend atual ja possui varios nucleos reutilizaveis alinhados ao ODS. A principal lacuna nao e visual isolada, mas estrutural: modais, filtros, exportacoes, confirmacoes e regras de permissao estao repetidos em varias telas.

As refatoracoes devem priorizar a eliminacao dessas duplicidades antes de alterar a aparencia geral do produto.

