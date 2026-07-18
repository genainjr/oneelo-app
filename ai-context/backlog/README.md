# Backlog Técnico

Este diretório registra correções, melhorias e débitos técnicos identificados durante o desenvolvimento. Serve como referência para priorização e contexto em futuras sessões de trabalho.

## Formato das Entradas

Cada item segue o formato:

```markdown
### [ID] Título curto
- **Prioridade**: alta | média | baixa
- **Categoria**: segurança | performance | DX | UX | infraestrutura
- **Contexto**: Por que existe e como foi identificado
- **Ação**: O que precisa ser feito
- **Impacto**: O que melhora após a correção
```

## Arquivos

- **[security.md](security.md)** — Correções de segurança pendentes
- **[improvements.md](improvements.md)** — Melhorias gerais e débito técnico
- **[features-roadmap.md](features-roadmap.md)** — Features de produto pós-MVP (WhatsApp, Google Agenda, IA, módulos de ministério)
- **[permissions-matrix.md](permissions-matrix.md)** — Matriz de permissões por role e recurso (referência para implementação)
- **[phone-password-login.md](phone-password-login.md)** — Login por número de telefone e senha, preservando e-mail/senha e login social
- **[notification-center.md](notification-center.md)** — Central robusta de notificações, processamento confiável, histórico e comunicados gerais/ministeriais
