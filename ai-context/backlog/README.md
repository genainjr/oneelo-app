# Índice do Backlog

Este diretório registra funcionalidades, melhorias, correções e referências técnicas para priorização e acompanhamento do ciclo de vida do OneElo.

Os documentos abaixo estão ordenados pela data em que foram adicionados ao repositório, do mais recente para o mais antigo, acompanhados de seu status real de implementação frente à base de código.

---

## Outubro de 2026

| Criação | Documento | Assunto | Status no Código |
|---|---|---|---|
| 09/10/2026 | [exportacao-pdf.md](exportacao-pdf.md) | Exportação síncrona de PDF e imagens para Escalas e Agenda | ⏳ **Em andamento / Fase final** (branch `feature/unified-share-pdf-png`) |

---

## Julho de 2026

| Criação | Documento | Assunto | Status no Código |
|---|---|---|---|
| 22/07/2026 | [financeiro-patrimonial.md](financeiro-patrimonial.md) | Módulo financeiro, permissões e patrimônio | 🟡 **MVP Implementado** (Contas, categorias, lançamentos, permissões); Patrimônio e conciliação pendentes |
| 22/07/2026 | [central-documentos.md](central-documentos.md) | Central de documentos e geração assíncrona de arquivos | ⚪ **Pendente** (Geração síncrona priorizada primeiro via FT-015) |
| 18/07/2026 | [tenant-branded-experience.md](tenant-branded-experience.md) | Experiência personalizada da igreja por tenant | 🟡 **Parcial** (PWA dinâmico por tenant ativo; co-branding completo pendente) |
| 17/07/2026 | [phone-password-login.md](phone-password-login.md) | Login com telefone e senha | ✅ **Implementado** (E.164, login unificado por email/telefone, Meu Perfil) |
| 17/07/2026 | [notification-center.md](notification-center.md) | Central e infraestrutura robusta de notificações | 🟡 **Parcial** (Web Push ativo com crons de lembrete/aniversário; UI e fila central pendentes) |
| 15/07/2026 | [escala-evento-vinculo.md](escala-evento-vinculo.md) | Vínculo entre escalas e eventos | ✅ **Implementado** (`requerEscala`, modo EVENTOS em escalas, vínculo `EscalaDia -> Evento`) |
| 13/07/2026 | [social-oauth-login.md](social-oauth-login.md) | Login social com OAuth | ✅ **Implementado** (Google OAuth funcional e vinculado ao User) |
| 11/07/2026 | [midia-membros-tenant.md](midia-membros-tenant.md) | Mídia de membros e tenant | ✅ **Implementado** (Upload de logo no admin e foto no perfil via Supabase Storage) |

---

## Junho de 2026

| Criação | Documento | Assunto | Status no Código |
|---|---|---|---|
| 05/06/2026 | [features-roadmap.md](features-roadmap.md) | Features de produto pós-MVP & Super Admin | 🟡 **FT-000 Super Admin Implementado**; Features pós-MVP (WhatsApp, Louvor, IA) pendentes |
| 03/06/2026 | [security.md](security.md) | Correções de segurança pendentes | ✅ **Implementado** (IP real em auditoria `SEC-001` e cookies seguros `SEC-002`) |
| 03/06/2026 | [permissions-matrix.md](permissions-matrix.md) | Matriz de permissões por role e recurso | 📖 **Documentado** (Referência ativa de RBAC) |
| 03/06/2026 | [improvements.md](improvements.md) | Melhorias gerais e débito técnico | 🟡 **6 de 8 implementados** (IMP-001, 002, 004, 005, 006, 009 prontos; IMP-007, 008 pendentes) |

---

## Formato recomendado para novas entradas

```markdown
### [ID] Título curto

- **Prioridade**: alta | média | baixa
- **Categoria**: segurança | performance | DX | UX | infraestrutura | produto
- **Contexto**: por que existe e como foi identificado
- **Ação**: o que precisa ser feito
- **Impacto**: o que melhora após a entrega
```
