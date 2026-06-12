# Plano de Desenvolvimento - Refatoracao para OneElo Design System

Fonte:

- `ai-context/frontend/ods-compliance-matrix.md`
- `ai-core/skills/oneelo-design-system/`
- `ai-context/frontend/design-system-inventory.md`
- `ai-context/frontend/design-system-pattern-analysis.md`

Objetivo: refatorar gradualmente o frontend para aderir ao OneElo Design System (ODS), eliminando duplicidades sem alterar regras de negocio.

---

## Status Das Fases

| Fase | Status | Evidencia |
|---|---|---|
| Fase 0 - Preparacao e Baseline | Concluida | `ai-context/plans/ods-phase-0-baseline.md` |
| Fase 1 - Fundacoes Compartilhadas | Concluida | `ai-context/plans/ods-phase-1-foundations-report.md` |
| Fase 2 - Confirmacoes e Feedback | Concluida | `ai-context/plans/ods-phase-2-feedback-report.md` |
| Fase 3 - Exportacoes | Nao iniciada | Aguardando inicio |
| Fase 4 - Tabelas e Listagens | Nao iniciada | Aguardando fases anteriores |
| Fase 5 - Modais CRUD | Nao iniciada | Aguardando fases anteriores |
| Fase 6 - Filtros | Nao iniciada | Aguardando fases anteriores |
| Fase 7 - Visualizacoes e Metricas | Nao iniciada | Aguardando fases anteriores |
| Fase 8 - Permissoes e Navegacao | Nao iniciada | Aguardando fases anteriores |
| Fase 9 - Validacao Final | Nao iniciada | Aguardando fases anteriores |

---

## Principios

- Nao mudar comportamento de negocio durante refatoracao visual/estrutural.
- Refatorar primeiro componentes compartilhados, depois telas.
- Preservar rotas existentes.
- Preservar contratos atuais de API.
- Manter backend como fonte de verdade de autorizacao.
- Evitar big bang: cada fase deve ser testavel isoladamente.

---

## Fase 0 - Preparacao e Baseline

### Objetivo

Criar uma base segura para comparar antes/depois das refatoracoes.

### Escopo

- Mapear screenshots das principais telas.
- Registrar fluxos criticos por modulo.
- Garantir build/lint/testes atuais como baseline.

### Tarefas

1. Definir lista de rotas para validacao visual:
   - `/dashboard`
   - `/membros`
   - `/membros/visualizacao`
   - `/ministerios`
   - `/escalas`
   - `/escalas/visualizacao`
   - `/agenda`
   - `/configuracoes`
   - `/minhas-escalas`
   - `/meu-perfil`
   - `/admin`
2. Registrar estados esperados:
   - loading;
   - vazio;
   - erro;
   - com dados;
   - permissao sem edicao.
3. Validar `npm run lint` e, se existir, build/testes.

### Criterios de aceite

- Baseline documentado.
- Rotas criticas listadas.
- Nenhuma alteracao funcional aplicada.

---

## Fase 1 - Fundacoes Compartilhadas do ODS

### Objetivo

Criar ou consolidar componentes compartilhados que ja existem conceitualmente no produto.

### Escopo

- Modal shell.
- Confirmacao destrutiva.
- Campo/form field padronizado.
- Filtro shell.
- Cards de metrica.
- Labels/status centralizados.

### Tarefas

1. Consolidar um shell de modal baseado em `MembroModal` e `UsuarioModal`.
2. Criar padrao de confirmacao custom baseado no modal de desativacao de usuario.
3. Extrair campos reutilizaveis apenas quando houver repeticao direta:
   - input com label;
   - select com label;
   - textarea com label;
   - password field.
4. Consolidar `StatCard` para substituir `StatBox` e metricas locais.
5. Revisar `lib/utils.ts` como fonte de labels/cores de status.
6. Documentar uso do shell de filtros sem alterar todos os filtros ainda.

### Criterios de aceite

- Componentes compartilhados prontos.
- Nenhuma tela critica quebrada.
- ODS usado como criterio de implementacao.

### Riscos

- Refatorar componente compartilhado pode afetar muitas telas se aplicado cedo demais.
- Evitar substituir todos os modais nesta fase.

---

## Fase 2 - Refatorar Confirmacoes, Alertas e Feedback

### Objetivo

Eliminar `alert()` e `confirm()` como padrao futuro.

### Modulos alvo

- Membros
- Ministerios
- Agenda
- Escalas

### Tarefas

1. Substituir confirmacoes nativas por confirmacao custom.
2. Substituir `alert()` de erro/sucesso por feedback inline ou toast/padrao existente se consolidado.
3. Padronizar mensagens de erro em:
   - erro de carregamento;
   - erro de formulario;
   - erro de acao destrutiva.

### Criterios de aceite

- Nenhum novo fluxo usa `alert()`/`confirm()`.
- Acoes destrutivas usam confirmacao visual consistente.
- Erros permanecem visiveis sem bloquear o navegador.

---

## Fase 3 - Refatorar Exportacoes

### Objetivo

Eliminar duplicidade entre as quatro paginas de exportacao.

### Modulos alvo

- `/membros/exportacao`
- `/ministerios/exportacao`
- `/escalas/exportacao`
- `/agenda/exportacao`

### Tarefas

1. Criar estrutura compartilhada para:
   - formato;
   - selecao de campos;
   - selecionar todos;
   - limpar;
   - resumo;
   - botao exportar CSV.
2. Manter `downloadCsv`.
3. Centralizar formatacao de data e status onde ja houver utilitario.
4. Preservar `ALL_FIELDS` especifico por modulo, mas padronizar contrato.

### Criterios de aceite

- As quatro telas continuam com mesma UX.
- Duplicacao estrutural reduzida.
- CSV gerado permanece equivalente.

---

## Fase 4 - Refatorar Tabelas e Listagens

### Objetivo

Usar `DataTable` como padrao principal para entidades tabulares.

### Modulos alvo

- `/admin`
- `/membros/visualizacao`
- `/membros`
- `/configuracoes`

### Tarefas

1. Avaliar adaptacao da tabela de tenants para `DataTable`.
2. Avaliar adaptacao da visualizacao de membros para `DataTable` no desktop.
3. Manter cards mobile quando necessarios.
4. Centralizar badges de status/role usando utilitarios existentes.
5. Garantir empty/loading consistentes.

### Criterios de aceite

- Tabelas simples usam `DataTable`.
- Tabelas read-only seguem ODS ou justificam excecao.
- Nenhuma regressao de acoes por linha.

---

## Fase 5 - Refatorar Modais CRUD

### Objetivo

Eliminar shells de modal duplicados.

### Modulos alvo

- Agenda
- Escalas
- Ministerios
- Super Admin
- Tags de membros

### Tarefas

1. Migrar modal de evento para shell ODS.
2. Migrar modal de criar escala para shell ODS.
3. Migrar modais de tenant/usuario Super Admin para shell ODS.
4. Avaliar modal de ministerios como caso complexo com tabs, mantendo tabs justificadas.
5. Migrar modal de tag para shell pequeno padronizado.

### Criterios de aceite

- Modais mantem comportamento atual.
- Header, corpo, erro e footer seguem padrao.
- Forms longos mantem corpo rolavel.

---

## Fase 6 - Refatorar Filtros

### Objetivo

Padronizar filtros sem alterar contratos de query.

### Modulos alvo

- `/membros`
- `/membros/visualizacao`
- `/agenda`
- `/escalas`
- `/escalas/visualizacao`

### Tarefas

1. Consolidar layout de filtro em card para listas.
2. Manter toolbar compacta apenas quando fizer sentido operacional, como `/escalas`.
3. Padronizar botoes:
   - Aplicar;
   - Limpar;
   - Recarregar quando aplicavel.
4. Manter chips/tags como variacao permitida para membros.

### Criterios de aceite

- Filtros semelhantes parecem e se comportam de forma semelhante.
- Filtros especializados continuam justificados.
- Nenhuma query muda sem necessidade.

---

## Fase 7 - Refatorar Visualizacoes e Metricas

### Objetivo

Consolidar views read-only e cards de metrica.

### Modulos alvo

- `/membros/visualizacao`
- `/escalas/visualizacao`
- `/minhas-escalas`
- `/meu-perfil`
- `/dashboard`

### Tarefas

1. Substituir `StatBox` e metricas locais por `StatCard` ou variante documentada.
2. Revisar `MemberProfileDrawer` como padrao de drawer.
3. Reduzir duplicacao entre `EscalaGrid` e `EscalaReadonlyGrid` onde for seguro.
4. Extrair `Info` e `PasswordField` de perfil se houver uso repetido confirmado.

### Criterios de aceite

- Metricas usam um padrao unico.
- Views read-only nao exibem controles de edicao.
- Drawers e detalhes seguem padrao consistente.

---

## Fase 8 - Permissoes e Navegacao

### Objetivo

Reduzir regras de permissao espalhadas e manter a sidebar alinhada ao ODS.

### Modulos alvo

- `DashboardLayout`
- `Sidebar`
- Paginas que buscam `/api/auth/me`

### Tarefas

1. Mapear todas as buscas de `/api/auth/me`.
2. Avaliar centralizacao do usuario atual em hook/contexto, sem mudar autorizacao backend.
3. Padronizar nomes de flags:
   - `canManage`;
   - `canCreate`;
   - `canManageSelected...`.
4. Revisar visibilidade de exportacao por perfil.
5. Revisar BASIC comum e BASIC lider/co-lider.

### Criterios de aceite

- Regras de visibilidade ficam previsiveis.
- Sidebar continua alinhada ao documento de navegacao.
- Acoes bloqueadas nao aparecem para usuarios sem permissao visual.

---

## Fase 9 - Validacao Final

### Objetivo

Garantir que a refatoracao ODS nao alterou comportamento esperado.

### Tarefas

1. Rodar lint/build/testes disponiveis.
2. Validar rotas criticas em desktop e mobile.
3. Validar perfis:
   - ADMIN;
   - STAFF;
   - BASIC comum;
   - BASIC lider/co-lider;
   - SUPER_ADMIN.
4. Validar CRUDs principais:
   - membros;
   - ministerios;
   - escalas;
   - agenda;
   - usuarios;
   - tenants.
5. Validar exportacoes CSV.

### Criterios de aceite

- Nenhuma regressao funcional conhecida.
- Matriz de conformidade atualizada.
- ODS passa a ser referencia para novas telas.

---

## Ordem Recomendada de Execucao

1. Fase 0 - Preparacao e Baseline.
2. Fase 1 - Fundacoes Compartilhadas.
3. Fase 2 - Confirmacoes e Feedback.
4. Fase 3 - Exportacoes.
5. Fase 4 - Tabelas e Listagens.
6. Fase 5 - Modais CRUD.
7. Fase 6 - Filtros.
8. Fase 7 - Visualizacoes e Metricas.
9. Fase 8 - Permissoes e Navegacao.
10. Fase 9 - Validacao Final.

---

## Priorizacao por Modulo

| Prioridade | Modulos | Motivo |
|---|---|---|
| Alta | Super Admin, Agenda, Ministerios, Escalas | Maior duplicacao estrutural e maior concentracao de modais/acoes inline |
| Media | Membros, Membros Visualizacao, Minhas Escalas, Meu Perfil | Ja usam parte do ODS, mas possuem duplicacoes locais |
| Baixa | Exportacoes, ComingSoon | UX consistente; principal ganho e estrutural |

---

## Fora de Escopo Inicial

- Alterar contratos de API.
- Alterar regras de negocio.
- Reescrever layouts globais.
- Criar novo design visual sem base no inventario.
- Trocar biblioteca de UI.
- Alterar autorizacao backend.
