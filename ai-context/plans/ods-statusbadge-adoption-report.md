# Relatório — Adoção do `StatusBadge` (ODS)

Data: 2026-06-17
Branch: `refactor/ods-statusbadge-adoption` (a partir de `development`)
Status: ✅ **CONCLUÍDA** — `tsc --noEmit` exit 0, `next build` exit 0
Referência de padrão: `/configuracoes` (uso original do `StatusBadge`) + `feature-development.md`

---

## 1. Objetivo

Padronizar todas as *pills de status* inline da aplicação no componente único `StatusBadge`
(`components/app/status-badge.tsx`), seguindo o mesmo padrão já adotado em `/configuracoes`:

```tsx
<StatusBadge label={<label resolvido>} className={<cores + overrides>} />
```

O `StatusBadge` é presentation-only (não conhece domínio). Labels e cores continuam vindo de
`lib/utils` (`STATUS_*_LABEL` / `STATUS_*_COLOR`) ou de mapas locais do módulo — exatamente como
a referência `/configuracoes` usa seu mapa local `badges`.

---

## 2. Escopo migrado

10 pills de status em 7 arquivos. Todas eram `<span>` cru com `rounded-full`/`rounded-lg` +
`${STATUS_*_COLOR}`:

| Arquivo | Pills | Mapa de status |
|---|---|---|
| `app/(dashboard)/membros/visualizacao/page.tsx` | 2 (coluna `DataTable` + badge mobile) | `STATUS_MEMBRO` |
| `app/(dashboard)/minhas-escalas/page.tsx` | 2 (escala + confirmação) | `STATUS_ESCALA`, `STATUS_CONFIRMACAO` |
| `app/(dashboard)/escalas/visualizacao/page.tsx` | 1 (status da escala) | `STATUS_ESCALA` |
| `app/(dashboard)/escalas/page.tsx` | 2 (card de lista + cabeçalho detalhe) | `STATUS_COLORS` local |
| `app/(dashboard)/meu-perfil/page.tsx` | 1 (status do membro) | `STATUS_MEMBRO` |
| `components/app/escala-shared.tsx` | 1 (`MemberChip` — confirmação) | `STATUS_CONFIRMACAO` |
| `components/app/member-profile-drawer.tsx` | 1 (campo "Status" do drawer) | `STATUS_MEMBRO` |

Com `/configuracoes` (que já usava o componente), o `StatusBadge` passa a ser o padrão único de
pill de status em **8 arquivos**.

---

## 3. Fidelidade visual

O `StatusBadge` usa `cn` (= `twMerge(clsx(...))`), então classes conflitantes passadas via
`className` **sobrescrevem** a base de forma limpa (sem duplicação de utilitários). A base é
`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full`; cada migração preservou
o visual original passando apenas os *overrides* necessários:

| Origem (span) | `className` passado ao `StatusBadge` |
|---|---|
| `rounded-full px-2 py-0.5 text-xs font-bold` | `font-bold` (resto = base) |
| `rounded-full px-2.5 py-1 text-xs font-bold` | `px-2.5 py-1 font-bold` |
| `px-1.5 py-0.5 text-[10px] font-bold` (MemberChip) | `mt-1 px-1.5 py-0.5 text-[10px] font-bold` |
| `text-[11px] font-semibold px-2 py-0.5 border` | `text-[11px] border` |
| `text-xs font-bold px-2.5 py-1 border` | `px-2.5 py-1 font-bold border` |
| `rounded-lg px-2.5 py-1 text-xs font-bold` (meu-perfil) | `rounded-lg px-2.5 py-1 font-bold` |

Nenhuma cor, label ou tamanho foi alterado — apenas a marcação foi unificada.

---

## 4. Regras de negócio

Nenhuma regra de negócio, contrato de API, schema, autenticação ou permissão alterada.
Mudança puramente de apresentação. Os mapas de label/cor (`lib/utils` e o `STATUS_COLORS` local
de `escalas/page.tsx`) permanecem como fonte de verdade.

---

## 5. Validação

| Validação | Resultado |
|---|---|
| Pills inline de status remanescentes (grep `<span ... STATUS_*_COLOR`) | 0 ✅ |
| `tsc --noEmit` | ✅ Exit 0 |
| `next build` | ✅ Exit 0 — 28 rotas compiladas |
| Delta de lint introduzido | ✅ Zero (só troca de marcação; sem `any`/efeitos novos) |

---

## 6. Notas

- `STATUS_EVENTO_COLOR` existe em `lib/utils` mas não é renderizado como pill inline em nenhuma
  tela — nada a migrar.
- Badges que **não** são status (indicador "tem membro vinculado" em `/configuracoes`, contador
  "N participações" em `/escalas/visualizacao`, avatares/contadores) foram deixados inline
  intencionalmente — não são superfícies de status.

---

## 7. Conclusão

`StatusBadge` é agora o padrão único de pill de status do OneElo. A adoção seguiu o padrão da
implementação anterior (`/configuracoes`), sem regressão visual ou de negócio.
