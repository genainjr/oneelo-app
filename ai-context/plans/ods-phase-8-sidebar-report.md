# Relatório — Fase 8: Sidebar / Navegação (ODS)

Data: 2026-06-18
Branch: `refactor/ods-phase-8-sidebar` (a partir de `development`)
Status: ✅ **CONCLUÍDA** — `tsc --noEmit` exit 0, `next build` exit 0 (28 rotas)
Workflow: `feature-development.md` — 3 commits separados por concern.

---

## Objetivo

Refinar a navegação lateral (maior superfície visível do app) com melhorias visuais e de
interação de **baixo risco e alto retorno**, seguindo a filosofia ODS. A sidebar já era madura
(colapso, drawer mobile, accordion de seções, estados ativos, troca de idioma, visibilidade por
papel), então a Fase 8 foram **refinamentos cirúrgicos**, não um redesenho.

---

## 1. Badge "Em breve" padronizado com `StatusBadge`

Commit: `1c8438d`

**Problema:** o pill "Em breve" (`comingSoon`) era um `<span>` inline **duplicado em 3 lugares**
(item de topo, filho expandido, filho no flyout do modo colapsado). Usava
`bg-indigo-900 text-indigo-400` sobre o fundo `bg-indigo-950` — **contraste baixíssimo**, quase
ilegível.

**Solução:**
- Os 3 spans → componente único `StatusBadge` do ODS (continua a adoção da padronização de pills).
- Contraste corrigido via constante `SOON_BADGE_CLASS`: `bg-indigo-500/25 text-indigo-200`,
  legível sobre o fundo escuro, mantendo o tamanho compacto (`text-[10px] rounded-md`).

---

## 2. Cabeçalhos de grupo na navegação

Commit: `6312f25`

**Problema:** a navegação era uma lista plana de itens + seções, sem agrupamento visual,
dificultando a escaneabilidade num menu já razoavelmente longo.

**Solução:**
- Novo campo opcional `NavItem.groupStart` (chave i18n `nav.*`) que marca o início de um grupo.
- Cabeçalhos discretos em maiúsculas renderizados acima dos blocos:

| Grupo | Itens |
|---|---|
| **Gestão** | Membros / Ministérios / Escalas / Agenda |
| **Módulos** | Grupos / Financeiro / Integrações (itens "Em breve") |
| **Conta** | Meu Perfil / Configurações |

- Estilo `text-[10px] uppercase tracking-wider text-indigo-500/80` — sutil, sem competir com os itens.
- Só aparecem no **modo expandido** (ocultos no colapsado, onde não há labels).
- Usuários **BASIC** não recebem cabeçalhos (lista curta — evita um cabeçalho solto).
- Chaves `groupManagement` / `groupModules` / `groupAccount` adicionadas aos **3 locales**
  (pt-BR, pt-PT, en-US).

---

## 3. Polish de interação e foco

Commit: `4c57cc0`

**Problema:** os itens usavam `transition-all` (anima também propriedades de layout, potencial
jank) e não tinham indicação de foco por teclado.

**Solução:**
- `transition-all` → `transition-colors` nos 4 itens de navegação interativos (transição de cor
  mais limpa; a largura do `<aside>` mantém seu `transition-all duration-300`).
- Anel de foco por teclado (`focus-visible:ring-2 ring-inset ring-indigo-400`) nos links e botões
  de navegação (parent expandido, parent colapsado, filhos expandidos, filhos no flyout e leaf),
  melhorando a acessibilidade sem alterar o visual no uso com mouse.

---

## Validação

| Validação | Resultado |
|---|---|
| `tsc --noEmit` | ✅ Exit 0 |
| `next build` | ✅ Exit 0 — 28 rotas, compilado em 2.8s |
| Regra de negócio / API / schema | ✅ Inalteradas (mudança puramente visual/UI) |
| JSON de mensagens | ✅ Sem churn (+5/−1 por locale) |

---

## Próximos passos sugeridos

- **Alinhamento `/membros`**: a tela de **gerenciamento** e a de **visualização** divergem em
  detalhes (faixa de StatCards ausente no gerenciamento; inputs de filtro com raio/padding
  diferentes — `rounded-xl px-4` vs `rounded-lg px-3`; caixas de aviso `rounded-2xl` vs
  `rounded-lg`; container `max-w-7xl` vs largura cheia). Causa-raiz: **inputs de filtro não são um
  componente compartilhado** (cada página escreve o seu `<input>`). Tratar em branch separada.
- Polimento adicional do estado ativo (barra-acento lateral / tint mais suave) — opcional.
