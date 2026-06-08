# Plano — Accordion Genérico + Telas de Exportação

> Status: em andamento
> Última atualização: 2026-06-08

## Etapas

- [ ] 1. Utilitário CSV (`lib/csv.ts`)
- [ ] 2. i18n — adicionar `nav.export` nos 3 arquivos de mensagens
- [ ] 3. Sidebar — accordion genérico + novos `children` + ícone export
- [ ] 4. Página `membros/exportacao`
- [ ] 5. Página `escalas/exportacao`
- [ ] 6. Página `agenda/exportacao`
- [ ] 7. Página `ministerios/exportacao`
- [ ] 8. Commit + push

---

## Escopo

### Sidebar
- Substituir `ministeriosOpen: boolean` por `openSections: Record<string, boolean>`
- Membros, Escalas, Agenda ganham `children` (Gerenciar + Exportação)
- Ministérios mantém seus filhos existentes + Exportação
- `isActive` e `sectionActive` generalizados
- Novo ícone `ICONS.export`

### Páginas de exportação
- Exportação client-side usando hooks existentes — sem novo endpoint no backend
- Utilitário `downloadCsv` com BOM UTF-8 para compatibilidade com Excel
- Layout: formato (CSV / XLSX em breve) + campos selecionáveis + resumo de registros + botão exportar

### Campos por módulo
| Módulo | Campos |
|---|---|
| Membros | Nome, E-mail, WhatsApp, Status, Data nascimento, Data entrada, Tags |
| Escalas | Título, Ministério, Data início, Data fim, Status |
| Agenda | Título, Data, Horário, Local, Descrição |
| Ministérios | Nome, Líder, Nº membros, Nº funções |

---

## Arquivos

| Arquivo | Ação |
|---|---|
| `apps/web/src/lib/csv.ts` | Novo |
| `apps/web/messages/pt-BR.json` | + `nav.export` |
| `apps/web/messages/pt-PT.json` | + `nav.export` |
| `apps/web/messages/en-US.json` | + `nav.export` |
| `apps/web/src/components/app/sidebar.tsx` | Refactor |
| `apps/web/src/app/(dashboard)/membros/exportacao/page.tsx` | Novo |
| `apps/web/src/app/(dashboard)/escalas/exportacao/page.tsx` | Novo |
| `apps/web/src/app/(dashboard)/agenda/exportacao/page.tsx` | Novo |
| `apps/web/src/app/(dashboard)/ministerios/exportacao/page.tsx` | Novo |
