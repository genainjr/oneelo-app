# Plano — Módulos Financeiro e Grupo de Crescimento

> Status: em andamento
> Última atualização: 2026-06-08

## Etapas

- [x] 1. i18n — `nav.groups` e `nav.finance` nos 3 arquivos de mensagens
- [x] 2. Sidebar — ícones + 2 novos navItems top-level (`/grupos`, `/financeiro`)
- [x] 3. Página `/grupos` — ComingSoon com features detalhadas
- [x] 4. Página `/financeiro` — ComingSoon com features detalhadas
- [ ] 5. Commit + push

---

## Localização no Sidebar

```
Dashboard
Membros          → accordion
Ministérios      → accordion
Escalas          → accordion
Agenda           → accordion
─────────────────────────────
Grupo de Crescimento  ← novo (top-level, comingSoon)
Financeiro            ← novo (top-level, comingSoon)
─────────────────────────────
Integrações      → top-level, comingSoon
Configurações    → admin only
```

Motivo: Financeiro e Grupos são domínios transversais à toda a igreja,
não subtipos de ministério. Terão accordion próprio (Gerenciar + Exportação)
quando forem desenvolvidos — por ora ficam como top-level "em breve".

---

## Conteúdo das Telas

### Grupo de Crescimento (`/grupos`)
- **Fase:** 4
- **Descrição:** Gerencie células e grupos pequenos, acompanhe frequência,
  crescimento e multiplicação dos grupos da sua igreja.
- **Features:**
  - Cadastro de grupos — Registre líderes, membros e endereço de cada grupo
  - Controle de frequência — Lance presença por encontro e veja o histórico
  - Relatório de crescimento — Acompanhe a evolução de membros por período
  - Multiplicação de grupos — Registre divisões e veja a árvore de crescimento
  - Agenda de encontros — Sincronize os encontros com a agenda da igreja
  - Integração com Membros — Vincule cada participante ao seu cadastro pastoral

### Financeiro e Patrimonial (`/financeiro`)
- **Fase:** 4
- **Descrição:** Controle dízimos, ofertas, despesas e patrimônio da sua
  igreja com visibilidade completa das finanças.
- **Features:**
  - Dízimos e ofertas — Registre entradas por culto com identificação do contribuinte
  - Controle de despesas — Categorize e aprove despesas com comprovante digital
  - Gestão de patrimônio — Cadastre imóveis e equipamentos com valor e status
  - Relatórios financeiros — DRE mensal, fluxo de caixa e comparativos anuais
  - Conciliação bancária — Importe extratos e reconcilie automaticamente
  - Acesso por perfil — Tesoureiro, contador e pastor com visões distintas

---

## Arquivos

| Arquivo | Ação | Status |
|---|---|---|
| `apps/web/messages/pt-BR.json` | + `nav.groups`, `nav.finance` | ✅ |
| `apps/web/messages/pt-PT.json` | + `nav.groups`, `nav.finance` | ✅ |
| `apps/web/messages/en-US.json` | + `nav.groups`, `nav.finance` | ✅ |
| `apps/web/src/components/app/sidebar.tsx` | + ícones + navItems | ✅ |
| `apps/web/src/app/(dashboard)/grupos/page.tsx` | novo | ✅ |
| `apps/web/src/app/(dashboard)/financeiro/page.tsx` | novo | ✅ |
