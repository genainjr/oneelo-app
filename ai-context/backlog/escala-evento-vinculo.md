# Backlog - Vinculo entre Escalas e Eventos

## FT-008 Vincular dias da escala a eventos da agenda

- **Status**: pendente
- **Prioridade**: alta
- **Categoria**: UX / produto / consistencia de dados
- **Contexto**: O produto precisa permitir que uma escala seja associada ao evento real da agenda, especialmente cultos, reuniões e eventos ministeriais. Hoje o modelo ja possui o campo `EscalaDia.eventoId`, mas o sistema ainda nao oferece uma experiencia clara para selecionar, exibir e manter esse vinculo no fluxo de criacao/edicao da escala. Na pratica, o usuario monta a escala, mas nao consegue dizer explicitamente que aquele dia pertence a um evento da agenda.
- **Acao**:
  - Permitir selecionar um evento da agenda ao criar ou editar um dia da escala.
  - Listar apenas eventos do mesmo tenant e coerentes com o ministerio da escala quando o evento for ministerial.
  - Exibir o nome do evento no gerenciamento e na visualizacao da escala.
  - Usar os dados do evento vinculado, principalmente horario, nas experiencias que dependem de contexto da escala:
    - notificacao "Escala Hoje";
    - futuras integracoes com Google Agenda;
    - impressao/visualizacao da escala quando aplicavel.
  - Definir o comportamento quando o evento for alterado, cancelado ou removido:
    - manter o vinculo e refletir os novos dados;
    - sinalizar evento cancelado;
    - limpar ou bloquear exclusao quando houver escala vinculada, conforme decisao de produto.
- **Impacto**: A escala passa a representar melhor o compromisso real da igreja. Notificacoes podem usar horario correto do evento, futuras integracoes com calendarios ficam mais precisas e a experiencia do lider fica menos manual.
- **Estado tecnico atual**:
  - `EscalaDia` ja possui `eventoId`.
  - `Evento` ja possui relacao com `EscalaDia`.
  - Falta consolidar o fluxo de produto/API/UI para criar e manter esse vinculo.
- **Arquivos afetados previstos**:
  - `apps/api/src/modules/escalas/`
  - `apps/api/src/modules/eventos/`
  - `apps/api/prisma/schema.prisma` apenas se a regra de relacao precisar mudar
  - `apps/web/src/app/(dashboard)/escalas/page.tsx`
  - `apps/web/src/components/app/escala-grid.tsx`
  - `apps/web/src/types/index.ts`
- **Dependencias / decisoes pendentes**:
  - Definir se o vinculo sera por `EscalaDia` apenas, como o schema atual sugere, ou se existira tambem uma associacao de alto nivel entre `Escala` e `Evento`.
  - Definir como tratar escalas mensais com varios eventos.
  - Definir se um evento pode ter dias de escala de varios ministerios.

