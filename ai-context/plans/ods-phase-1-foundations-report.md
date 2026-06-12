# ODS Phase 1 Foundations Report

Fonte:

- `ai-context/plans/ods-refactoring-plan.md`
- `ai-core/skills/oneelo-design-system/`
- `ai-context/plans/ods-phase-0-baseline.md`

Objetivo: executar somente a Fase 1 do plano de refatoracao ODS, criando fundacoes compartilhadas sem migrar telas inteiras e sem alterar regras de negocio, APIs, banco, Prisma, permissoes ou autenticacao.

---

## Alteracoes realizadas

- Criado shell compartilhado de modal baseado no padrao visual de `MembroModal` e `UsuarioModal`.
- Criado componente de confirmacao custom para uso futuro em acoes destrutivas.
- Criados campos compartilhados para input, select, textarea e senha.
- Criado shell compartilhado de filtros com acoes padrao de aplicar, limpar e recarregar.
- Centralizados labels e cores de `StatusEvento` em `lib/utils.ts`.
- Migrados apenas os dois modais de referencia do ODS para validar a fundacao:
  - `MembroModal`;
  - `UsuarioModal`.
- Removidos `any` locais nos dois modais refatorados.
- Ajustada inicializacao de estado dos modais para evitar `setState` sincrono em `useEffect` nos arquivos alterados.

Nao foram realizadas:

- migracoes amplas de modais inline;
- substituicoes de `confirm()` em telas;
- refatoracao de filtros existentes;
- refatoracao de tabelas;
- alteracao de rotas;
- alteracao de regras de negocio;
- alteracao de APIs;
- alteracao de banco de dados;
- alteracao de modelos Prisma;
- alteracao de permissoes;
- alteracao de autenticacao.

---

## Componentes criados

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| `ModalShell` | `apps/web/src/components/app/modal-shell.tsx` | Shell padrao para modais ODS com overlay, header, corpo rolavel e footer. |
| `ModalError` | `apps/web/src/components/app/modal-shell.tsx` | Erro inline padrao para modais. |
| `ConfirmDialog` | `apps/web/src/components/app/confirm-dialog.tsx` | Confirmacao custom para acoes destrutivas futuras. |
| `InputField` | `apps/web/src/components/app/form-field.tsx` | Input com label, erro e classes ODS. |
| `SelectField` | `apps/web/src/components/app/form-field.tsx` | Select com label, erro e classes ODS. |
| `TextareaField` | `apps/web/src/components/app/form-field.tsx` | Textarea com label, erro e classes ODS. |
| `PasswordField` | `apps/web/src/components/app/form-field.tsx` | Campo de senha com alternancia mostrar/ocultar. |
| `FilterShell` | `apps/web/src/components/app/filter-shell.tsx` | Container padrao para filtros. |
| `FilterActions` | `apps/web/src/components/app/filter-shell.tsx` | Acoes padrao de aplicar, limpar e recarregar. |

---

## Componentes removidos

Nenhum componente foi removido.

Foram eliminadas apenas duplicacoes internas nos dois modais de referencia:

- shell local de modal em `MembroModal`;
- shell local de modal em `UsuarioModal`;
- campos repetidos de input/select/textarea nos dois modais;
- toggle local de senha em `UsuarioModal`, substituido por `PasswordField`.

---

## Componentes reutilizados

| Componente | Uso aplicado |
|---|---|
| `ModalShell` | `MembroModal`, `UsuarioModal` |
| `ModalError` | `MembroModal`, `UsuarioModal` |
| `InputField` | `MembroModal`, `UsuarioModal` |
| `SelectField` | `MembroModal`, `UsuarioModal` |
| `TextareaField` | `MembroModal` |
| `PasswordField` | `UsuarioModal` |
| `MembroSearchCombobox` | Mantido em `UsuarioModal` sem alteracao funcional |

---

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `apps/web/src/components/app/modal-shell.tsx` | criado |
| `apps/web/src/components/app/confirm-dialog.tsx` | criado |
| `apps/web/src/components/app/form-field.tsx` | criado |
| `apps/web/src/components/app/filter-shell.tsx` | criado |
| `apps/web/src/components/app/membro-modal.tsx` | refatorado para usar `ModalShell`, `ModalError`, `InputField`, `SelectField` e `TextareaField` |
| `apps/web/src/components/app/usuario-modal.tsx` | refatorado para usar `ModalShell`, `ModalError`, `InputField`, `SelectField` e `PasswordField` |
| `apps/web/src/lib/utils.ts` | adicionado `STATUS_EVENTO_LABEL` e `STATUS_EVENTO_COLOR` |
| `ai-context/plans/ods-phase-0-baseline.md` | criado na Fase 0 e mantido como baseline |
| `ai-context/plans/ods-phase-1-foundations-report.md` | criado |

---

## Possiveis regressoes

| Area | Risco | Observacao |
|---|---|---|
| `MembroModal` | Diferenca visual pequena no header/corpo/footer | O shell foi extraido do proprio padrao existente, mas deve ser validado visualmente. |
| `UsuarioModal` | Diferenca visual pequena no icone, senha e footer | O comportamento de salvar/cancelar e payload foi preservado. |
| Busca de membro em usuario | Mudanca de ciclo de montagem do modal | A busca continua chamando `/api/auth/members-available` ao abrir o modal. |
| Textos com acentos | Alguns textos foram normalizados para ASCII nos arquivos refatorados | Nao muda regra de negocio; pode ser revisado em fase de i18n/copy. |
| `StatusEvento` | Novo utilitario ainda nao aplicado nas telas | Criado como fundacao; migracao de exportacoes/status fica para fases posteriores. |

---

## Testes recomendados

- Abrir `/membros`, criar e editar membro.
- Validar campos obrigatorios do `MembroModal`.
- Abrir `/configuracoes`, criar e editar usuario.
- Validar busca e limpeza de membro vinculado em `UsuarioModal`.
- Validar senha obrigatoria ao criar usuario.
- Validar senha opcional ao editar usuario.
- Validar modal em mobile, tablet e desktop.
- Validar que cancelar/fechar nao salva dados.
- Validar que erros de formulario continuam aparecendo dentro do modal.

---

## Percentual de aderencia ao ODS antes e depois da refatoracao

Como a matriz original e qualitativa, o percentual abaixo e uma estimativa operacional da Fase 1, limitada ao escopo de fundacoes compartilhadas.

| Categoria | Antes | Depois | Justificativa |
|---|---:|---:|---|
| Fundacoes de modal | 30% | 75% | Existiam modais de referencia, mas sem shell compartilhado. Agora ha shell padrao e dois modais usando-o. |
| Campos de formulario | 20% | 65% | Campos eram repetidos em modais. Agora ha componentes base e uso nos modais de referencia. |
| Confirmacao destrutiva | 15% | 45% | Existia modal custom isolado em configuracoes. Agora ha componente compartilhado, ainda nao migrado nas telas. |
| Filtros | 20% | 40% | Existiam padroes similares. Agora ha shell base, sem migracao ampla nesta fase. |
| Labels/status centralizados | 60% | 70% | Status de membros, escalas e confirmacao ja existiam; `StatusEvento` foi adicionado. |
| Aderencia geral da Fase 1 | 29% | 59% | Fundacoes foram criadas e validadas em uso minimo, sem avancar para fases seguintes. |

---

## Validacao

| Validacao | Comando / Metodo | Resultado |
|---|---|---|
| TypeScript | `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` | Passou |
| ESLint focado nos arquivos da Fase 1 | `npm.cmd run lint -w apps/web -- src/components/app/modal-shell.tsx src/components/app/confirm-dialog.tsx src/components/app/form-field.tsx src/components/app/filter-shell.tsx src/components/app/membro-modal.tsx src/components/app/usuario-modal.tsx src/lib/utils.ts` | Passou |
| ESLint global | `npm.cmd run lint -w apps/web` | Falhou por baseline preexistente; 96 problemas, 77 erros e 19 warnings |
| Build frontend | `npm.cmd run build -w apps/web` | Passou |
| Rotas | Build Next.js listou as rotas do App Router | Passou por compilacao |
| Navegacao | Nenhuma rota/sidebar/auth foi alterada | Sem mudanca funcional; validacao manual recomendada |
| Responsividade | Modais mantem overlay centralizado, corpo rolavel e grid responsivo | Validacao visual manual recomendada |

Avisos do build mantidos da Fase 0:

- multiplos lockfiles fazem o Next.js inferir o workspace root;
- convencao `middleware` esta depreciada em favor de `proxy`.

---

## Limite Da Fase

A Fase 1 foi encerrada sem avancar para:

- Fase 2: substituicao de `alert()` e `confirm()`;
- Fase 3: exportacoes;
- Fase 4: tabelas/listagens;
- Fase 5: modais CRUD restantes;
- Fase 6: filtros existentes;
- Fase 7: visualizacoes e metricas;
- Fase 8: permissoes e navegacao.

