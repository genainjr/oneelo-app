# Design de Solução ODS - Fase 3: Exportações

## 1. Estrutura do `ExportShell`

**Responsabilidade**: Fornecer a interface gráfica (UI) padronizada do OneElo Design System para processos de exportação (wizard de formulário inline). Não deve conter lógica de estado complexa além de repassar as intenções de clique (dumb component).

**Props**:
- `title` (string): Título da página (ex: "Exportação de Membros").
- `description` (string): Descrição abaixo do título.
- `fields` (Array<{ key: string, label: string }>): Lista total de campos disponíveis.
- `selectedFields` (Array<string>): Chaves dos campos que estão selecionados no momento.
- `onToggleField` (function(key: string)): Callback executado ao marcar/desmarcar um campo.
- `onSelectAll` (function): Callback executado ao clicar em "Selecionar todos".
- `onClear` (function): Callback executado ao clicar em "Limpar".
- `onExport` (function): Callback executado ao clicar no botão final "Exportar CSV".
- `loading` (boolean): Flag indicando se a busca inicial dos dados pela API ainda está ocorrendo.
- `totalItems` (number): Número total de entidades retornadas (para exibição no bloco de resumo).

**Dependências**:
- `PageHeader` (reutilização interna).

**Reutilização Esperada**: 100% de reaproveitamento nas páginas de Membros, Ministérios, Escalas, Agenda, e qualquer nova entidade futuramente exportável.

---

## 2. Estrutura do `useExportCsv`

**Responsabilidade**: Centralizar todo o gerenciamento de estado da seleção de campos e abstrair a preparação de matrizes (headers/rows) para o utilitário nativo de download, despoluindo as páginas.

**Argumentos (Parâmetros do Hook)**:
- `fields` (Array<{ key: string, label: string }>): Lista total de campos disponíveis.
- `data` (Array<any>): O payload bruto que veio da API.
- `filenamePrefix` (string): Prefixo do nome do arquivo final (ex: `"membros"`).
- `rowMapper` (function(item: any, activeFields: Array<{key, label}>)): Callback delegada de volta à página para que a mesma formate apenas os campos especiais do seu escopo em uma string.

**Retorno**:
- `selectedFields` (Array<string>): Estado interno das chaves marcadas.
- `toggleField` (function): Altera o status do checkbox de uma chave.
- `selectAll` (function): Seleciona todos os campos iterados do parâmetro original.
- `clearAll` (function): Limpa o array de selecionados.
- `handleExport` (function): Monta os cabeçalhos (`active.map`), executa a map interna com a `rowMapper` chamando o utilitário `downloadCsv(filename, headers, rows)` do diretório `/lib/csv.ts`.

**Reutilização Esperada**: Usado em todas as 4 páginas correntes. Facilita muito a testabilidade unitária.

---

## 3. Estrutura das `ExportConfigs`

**Responsabilidade**: Dicionários contendo o mapeamento de metadados (`ALL_FIELDS`, formats, constants) de cada entidade. Podem permanecer declarados diretamente na respectiva página de exportação (ou extraídos num arquivo de `constants.ts` local) porque são regras puras de negócio exclusivas daquele módulo.

**Padrão**:
```typescript
const MEMBROS_EXPORT_FIELDS = [
  { key: 'nome', label: 'Nome' },
  ...
];

function mapMembrosRow(membro, activeFields) {
  // Lógica de "se a chave for X, formate a data; senão string pura".
}
```

---

## 4. Estratégia de Migração das 4 Páginas

Para as quatro páginas alvo (`Membros`, `Ministérios`, `Escalas`, `Agenda`), a alteração trará transformações unificadas:

- **O que será mantido/reutilizado:**
  - O hook de fetch dos dados (`useMembros()`, `useEventos()`, etc).
  - O objeto estático de mapeamento `ALL_FIELDS`.
  - A formatação condicional das colunas (Ex: conversão da data via `toLocaleDateString` ou utilitários locais).
  
- **O que será removido (código morto deletado):**
  - Toda a estrutura `<div className="max-w-2xl mx-auto">...` manual, radio boxes estáticos e cards SVG repetidos.
  - A declaração isolada de `useState` para campos.
  - A função de delegação `handleExport` manual, o loop `rows = data.map()` idêntico espalhado.

- **Como ficarão após a migração:**
  Cada página consistirá basicamente num arquivo de 30-40 linhas:
  1. Declara as constantes `ALL_FIELDS`.
  2. Invoca o fetch (`const { membros, loading } = useMembros()`).
  3. Invoca o assistente de CSV (`const exportHook = useExportCsv({...})`).
  4. Retorna simplesmente `<ExportShell {...exportHook} loading={loading} totalItems={membros.length} />`.

---

## Resultados Esperados

### Benefícios esperados
- **Escalabilidade Imediata:** Adicionar suporte a PDF ou XLSX exigiria alterar 1 arquivo (`ExportShell`), em contrapartida a ter que buscar manualmente os 4 layouts de páginas.
- **Padronização Visual (ODS):** Garantia de que todos os módulos respeitam estritamente a margem, espaçamento e a tipografia das caixas cinzas e modais definidos em um único componente raiz.
- **Limpeza Front-End:** Responsabilidades devidamente separadas (O Shell desenha, o Hook lida com o estado e o mapeamento de arquivos, a Página lida com as regras de negócio).

### Redução estimada de código duplicado
- Estima-se a remoção de ~300 a ~350 linhas de código duplicado (JSX + State Logic em 4 arquivos), para apenas ~120 linhas novas centralizadas no Hook e Shell. Uma redução de cerca de **60% do tamanho dos arquivos originais** afetados na refatoração.

### Riscos
- Mapeamento reativo indevido (loops infinitos se a função `rowMapper` for redeclarada em cada render sem o uso de referências estáveis ou fora do escopo do React). Isso será mitigado mantendo a função de mapping ou estática fora da renderização.

### Plano de implementação em etapas
1. Criar o componente `ExportShell` em `src/components/app/export-shell.tsx`.
2. Criar o custom hook `useExportCsv` em `src/hooks/use-export-csv.ts`.
3. Validar a tipagem do hook no `tsc`.
4. Refatorar a primeira página (ex: Membros) usando o novo setup, testar o download do CSV no console.
5. Aplicar o padrão simultaneamente para Ministérios, Escalas e Agenda.
6. Limpar imports não utilizados, e validar com o Linters e o Build de Produção final.
