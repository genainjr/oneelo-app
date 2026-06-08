# Plano — Landing Page

> Status: concluído
> Última atualização: 2026-06-07

## Etapas

- [x] 1. Schema Prisma — model Lead + migration
- [x] 2. LeadsModule (dto → service → controller)
- [x] 3. AppModule → registrar LeadsModule
- [x] 4. Landing Page — page.tsx (todas as seções)

---

## Escopo

- **Visual:** Light moderno (white/gray-50, acentos indigo-600)
- **Formulário:** Salva no banco (tabela `Lead`)
- **i18n:** Apenas PT-BR por enquanto

---

## Seções

```
Navbar    → logo + botão "Entrar"
Hero      → headline + subheadline + CTA
Módulos   → Membros, Ministérios, Escalas, Agenda
Benefícios → 3 colunas
Planos    → Gratuito / Básico / Profissional
Formulário → Solicitar Demonstração (salva lead no banco)
Footer    → copyright Lookup Labs
```

---

## Backend

```prisma
model Lead {
  id        String   @id @default(uuid())
  nome      String
  email     String
  telefone  String?
  mensagem  String?
  createdAt DateTime @default(now())
}
```

Endpoint: `POST /leads` — público (`@Public()`), sem autenticação.

---

## Arquivos

| Arquivo | Ação |
|---|---|
| `apps/api/prisma/schema.prisma` | Adicionar model Lead |
| Migration Prisma | add_leads_table |
| `apps/api/src/modules/leads/leads.module.ts` | Novo |
| `apps/api/src/modules/leads/leads.controller.ts` | POST /leads |
| `apps/api/src/modules/leads/leads.service.ts` | Salva no banco |
| `apps/api/src/modules/leads/dto/create-lead.dto.ts` | Validação |
| `apps/api/src/app.module.ts` | Registrar LeadsModule |
| `apps/web/src/app/page.tsx` | Landing Page completa |
