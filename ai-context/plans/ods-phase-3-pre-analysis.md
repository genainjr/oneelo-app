# Pré-Análise ODS - Fase 3: Exportações

## Estado Atual das Exportações

Foram identificadas 4 páginas de exportação no sistema. Os módulos de Usuários e Configurações não possuem funcionalidade de exportação no estado atual da base de código.

| Módulo | Arquivo | Serviço / Hook de Dados | Componente | Formato |
|---|---|---|---|---|
| Membros | `membros/exportacao/page.tsx` | `useMembros()` | Página inline (Next.js) | CSV |
| Ministérios | `ministerios/exportacao/page.tsx` | `useMinisterios()` | Página inline (Next.js) | CSV |
| Escalas | `escalas/exportacao/page.tsx` | `useEscalas()` | Página inline (Next.js) | CSV |
| Agenda | `agenda/exportacao/page.tsx` | `useEventos()` | Página inline (Next.js) | CSV |
| Usuários | N/A | N/A | Ausente | N/A |
| Configurações | N/A | N/A | Ausente | N/A |

### UX (Experiência do Usuário)
- **Início:** O usuário inicia a ação acessando uma página dedicada de exportação, comumente via menu lateral (`/membros/exportacao`, etc.).
- **Feedback durante processamento:** Há um aviso textual *"Carregando dados..."* no resumo enquanto a request via hook está pendente. O botão "Exportar" fica desabilitado.
- **Feedback de sucesso:** Não há toast visual; o sucesso é a emissão nativa do download pelo navegador do arquivo `arquivo-YYYY-MM-DD.csv`.
- **Feedback de erro:** Inexistente. Caso a API retorne um erro ou a request falhe permanentemente, não há tratativa visual (ModalError ou banner) instruindo o usuário.

## Estrutura e Problemas Encontrados

O padrão de implementação foi feito a partir da cópia direta da mesma página ("Copiar e Colar"). 

### Duplicações Encontradas
1. **Componentes:** A interface de "Formato", "Campos" (grid de checkboxes), bloco de "Resumo" (ícones azuis, info text) e o "Botão de Ação" (Exportar CSV) são idênticos, repetidos 4 vezes nas páginas correspondentes.
2. **Código de Estado:** A lógica com `useState` e a função `toggleField` para controlar campos marcados foram recopiadas em todos os arquivos.
3. **Lógica de Mapeamento:** O preparo para `downloadCsv` (mapear `active.map` em `headers` e popular `rows` baseando-se no `ALL_FIELDS`) também é um bloco clonado.
4. **Serviços:** A única parte compartilhada é a utilidade `downloadCsv` de `src/lib/csv.ts`. A obtenção de dados depende de buscar **todos** os registros via hooks da interface, o que pode pesar quando o banco de dados crescer.

### Riscos
- **Escalabilidade (Frontend):** Se quisermos adicionar um botão `XLSX` (atualmente com a flag *em breve* e *disabled*), precisaríamos alterar 4 arquivos diferentes na mão.
- **Escalabilidade (Backend):** Atualmente, os hooks de dados (ex: `useMembros()`) tentam puxar todo o payload para a memória do navegador, o que causará crash em contas/planos maiores. Idealmente, exportações deveriam ser um endpoint no backend.
- **Tratamento de Exceções:** Sem tratamento explícito de erro, uma falha na montagem das rotas ou payload corrompido quebra a página sem feedback semântico.

## Aderência ODS
- Utiliza **PageHeader** de forma correta.
- ODS de modais e inputs (`ModalShell`, `ConfirmDialog`, `InputField`, `FilterShell`) não se aplicam diretamente pois a exportação atua como uma página isolada de "assistente" (wizard) inline e não carrega filtros dinâmicos de listagem ou deleção.

## Estratégia Recomendada para a Fase 3

A criação de um componente casca compartilhado: `ExportShell` ou `ExportPageTemplate`.

1. **Componente Compartilhado de Exportação (`ExportShell`)**
   - Propriedades: `title`, `description`, `fields` (lista de chaves/labels), `data` (lista de itens brutos), `loading` (boolean), `onFormatData` (função injetada que ensina a transformar um `item` no array de strings da linha).
   - Abstrai todo o layout HTML (radio de CSV/XLSX, listagem de checkboxes de campos, caixa de sumário, botão de exportar).

2. **Hook ou Utilitário Compartilhado**
   - Centralizar a inteligência de exportação CSV (`downloadCsv` já faz parte do trabalho, mas poderia ser embrulhado em um `useExport` que padronize a flag de formatação).

3. **Arquivos que serão impactados:**
   - [NOVO] `apps/web/src/components/app/export-shell.tsx`
   - [ALTERADO] `apps/web/src/app/(dashboard)/membros/exportacao/page.tsx`
   - [ALTERADO] `apps/web/src/app/(dashboard)/ministerios/exportacao/page.tsx`
   - [ALTERADO] `apps/web/src/app/(dashboard)/escalas/exportacao/page.tsx`
   - [ALTERADO] `apps/web/src/app/(dashboard)/agenda/exportacao/page.tsx`

### Estimativa de Complexidade
**Baixa**. Trata-se predominantemente de extração de JSX para um componente abstrato e injeção de "slots" e callbacks. Não há alteração de comportamento de API nem quebra de tipagens, além da refatoração clássica. Previsto para ser completado em um ciclo ágil e rápido.
