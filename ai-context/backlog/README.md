# Índice do Backlog

Este diretório registra funcionalidades, melhorias, correções e referências técnicas para priorização e acompanhamento do ciclo de vida do OneElo.

Os documentos abaixo estão ordenados pela data em que foram adicionados ao repositório, do mais recente para o mais antigo, acompanhados de seu status real de implementação frente à base de código.

---

## Novembro de 2026

| Criação | Documento | Assunto | Status no Código |
|---|---|---|---|
| 11/11/2026 | [novo-membro-auto-cadastro.md](novo-membro-auto-cadastro.md) | **FT-018: Auto-Cadastro Público de Novos Membros (com Triagem)** | ⚪ **Pendente / Próximo Foco** (Link/QR Code público de recepção com aprovação pastoral) |
| 10/11/2026 | [importacao-membros-planilha.md](importacao-membros-planilha.md) | **FT-016: Importação de Membros em Lote (Excel/CSV)** | ✅ **Implementado** (Parser ExcelJS, preview dry-run, template oficial, detecção de duplicidades e exclusão em lote) |
| 10/11/2026 | [modulo-infantil.md](modulo-infantil.md) | **FT-017: Ministério Infantil Ágil (Aulas, Alergias e Cuidados)** | ⚪ **Pendente** (Apoio pedagógico e segurança sem hardware) |

---

## Outubro de 2026

| Criação | Documento | Assunto | Status no Código |
|---|---|---|---|
| 09/10/2026 | [exportacao-pdf.md](exportacao-pdf.md) | Exportação síncrona de PDF e imagens para Escalas e Agenda | ✅ **Implementado** (unificado PDF/PNG via PR #210) |

---

## Julho de 2026

| Criação | Documento | Assunto | Status no Código |
|---|---|---|---|
| 22/07/2026 | [central-documentos.md](central-documentos.md) | Central de documentos, Carteirinhas de Membros e Exportações | ✅ **Implementado** (Fila assíncrona, Supabase Storage, Carteirinha Digital estilo CNH, lote A4 duplex e QR Code) |
| 22/07/2026 | [financeiro-patrimonial.md](financeiro-patrimonial.md) | Módulo financeiro, permissões e patrimônio | 🟡 **MVP Implementado** (Contas, categorias, lançamentos, relatórios, permissões); Patrimônio e conciliação despriorizados |
| 18/07/2026 | [tenant-branded-experience.md](tenant-branded-experience.md) | Experiência personalizada da igreja por tenant | 🟡 **Parcial** (PWA dinâmico por tenant ativo; co-branding despriorizado) |
| 17/07/2026 | [phone-password-login.md](phone-password-login.md) | Login com telefone e senha | ✅ **Implementado** (E.164, login unificado por email/telefone, Meu Perfil) |
| 17/07/2026 | [notification-center.md](notification-center.md) | Central e infraestrutura robusta de notificações | ✅ **Implementado** (Persistência, retentativas, inbox in-app, regras e preferências via PRs #212/#213) |
| 15/07/2026 | [escala-evento-vinculo.md](escala-evento-vinculo.md) | Vínculo entre escalas e eventos | ✅ **Implementado** (`requerEscala`, modo EVENTOS em escalas, vínculo `EscalaDia -> Evento`) |
| 13/07/2026 | [social-oauth-login.md](social-oauth-login.md) | Login social com OAuth | ✅ **Implementado** (Google OAuth funcional e vinculado ao User) |
| 11/07/2026 | [midia-membros-tenant.md](midia-membros-tenant.md) | Mídia de membros e tenant | ✅ **Implementado** (Upload de logo no admin e foto no perfil via Supabase Storage) |

---

## Junho de 2026

| Criação | Documento | Assunto | Status no Código |
|---|---|---|---|
| 05/06/2026 | [features-roadmap.md](features-roadmap.md) | Features de produto pós-MVP & Super Admin | 🟡 **FT-000 Super Admin e FT-002 Calendários Implementados**; demais pós-MVP despriorizados |
| 03/06/2026 | [security.md](security.md) | Correções de segurança pendentes | ✅ **Implementado** (IP real em auditoria `SEC-001` e cookies seguros `SEC-002`) |
| 03/06/2026 | [permissions-matrix.md](permissions-matrix.md) | Matriz de permissões por role e recurso | 📖 **Documentado** (Referência ativa de RBAC) |
| 03/06/2026 | [improvements.md](improvements.md) | Melhorias gerais e débito técnico | 🟢 **8 de 8 implementados** (IMP-001 até IMP-009 todos concluídos) |

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
