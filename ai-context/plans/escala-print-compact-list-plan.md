# Plano: Layout de Lista Compacta para Impressão com Poucas Funções

Status: **implementado no fluxo `Imprimir` do navegador; validacao manual em diferentes navegadores permanece sem registro**

Este documento trata do fallback `window.print()` e e independente do renderer server-side de PDF/PNG descrito em [exportacao-pdf-plan.md](exportacao-pdf-plan.md). A condicao para uma funcao ja existe em `apps/web/src/components/app/escala-print-grid.tsx`, com estilos em `apps/web/src/app/globals.css`. Os valores de largura atuais foram ajustados no codigo (45% para o quadro; colunas de Dia/Data em 9%/15%) e diferem dos valores inicialmente propostos abaixo.

## Problema

A impressão de escalas com apenas 1 função (ex: "Escala Pregadores CCRV - Agosto 2026") apresenta uma tabela desequilibrada:
- Coluna "Dia": 4% (~11mm)
- Coluna "Data": 7% (~19mm)  
- Coluna da função: ~89% (~247mm)

Isso cria uma coluna gigante para poucos nomes, resultando em uma impressão visualmente estranha.

## Solução

Implementar um layout de lista compacta para escalas com 1 função, mantendo a tabela atual para 2+ funções.

## Arquivos a Modificar

### 1. `apps/web/src/components/app/escala-print-grid.tsx`

**Adicionar componente `EscalaPrintList`** para renderizar layout de lista quando `funcoes.length === 1`:

```tsx
function EscalaPrintList({ escala }: EscalaPrintGridProps) {
  const funcoes = getFuncoes(escala);
  const dias = getDias(escala);
  const funcao = funcoes[0]; // única função

  return (
    <div className="print-list-frame">
      <table className="print-schedule-table print-list-table">
        <thead>
          <tr>
            <th className="print-day-column">Dia</th>
            <th className="print-date-column">Data</th>
            <th>{funcao.nome}</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((dia) => {
            const oculto = isFuncaoOculta(dia, funcao.id);
            const nomes = getMemberNames(dia, funcao.id);
            return (
              <tr key={dia.id}>
                <td className={`print-day-column${isSundayDia(dia) ? ' print-schedule-sunday-cell' : ''}`}>
                  {getWeekdayLabel(dia)}
                </td>
                <td className={`print-date-column${isSundayDia(dia) ? ' print-schedule-sunday-cell' : ''}`}>
                  {formatDate(dia.data, 'dd/MM/yyyy')}
                </td>
                <td>{oculto ? 'Indisponivel' : nomes || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**Modificar `EscalaPrintGrid`** para usar o novo componente:

```tsx
export function EscalaPrintGrid({ escala }: EscalaPrintGridProps) {
  const funcoes = getFuncoes(escala);
  const dias = getDias(escala);

  if (funcoes.length === 0 || dias.length === 0) {
    return (
      <div className="print-empty">
        Esta escala ainda nao possui funcoes ou dias cadastrados.
      </div>
    );
  }

  // Layout de lista para 1 função
  if (funcoes.length === 1) {
    return <EscalaPrintList escala={escala} />;
  }

  // Tabela para 2+ funções (código atual)
  return (
    <div className="print-table-frame">
      <table className="print-schedule-table print-schedule-grid">
        {/* ... código existente ... */}
      </table>
    </div>
  );
}
```

### 2. `apps/web/src/app/globals.css`

**Adicionar estilos para o layout de lista** dentro de `@media print`:

```css
/* Layout de lista para 1 função */
.print-list-frame {
  border: 1.5px solid var(--print-color-border-strong);
  border-radius: 8px;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
  max-width: 50%; /* Limitar largura para não ocupar toda a página */
  margin: 0 auto; /* Centralizar na página */
}

.print-list-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  border: 0;
  font-size: var(--print-font-size-table);
  line-height: var(--print-line-height-table);
}

.print-list-table th,
.print-list-table td {
  border: 0;
  border-bottom: var(--print-border-width) solid var(--print-color-border);
  padding: var(--print-space-cell-y) var(--print-space-cell-x);
  vertical-align: middle;
  text-align: center;
  color: var(--print-color-strong);
}

.print-list-table th {
  background: var(--print-color-table-header) !important;
  font-size: var(--print-font-size-table-header);
  font-weight: 800;
  color: var(--print-color-heading);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  border-bottom: 1.5px solid var(--print-color-border-strong);
}

.print-list-table th + th,
.print-list-table td + td {
  border-left: var(--print-border-width) solid #e2e8f0;
}

.print-list-table tbody tr:last-child td {
  border-bottom: 0;
}

.print-list-table tbody tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-list-table tbody tr:nth-child(even) td {
  background: var(--print-color-zebra) !important;
}

.print-list-table tbody tr:nth-child(even) td.print-day-column,
.print-list-table tbody tr:nth-child(even) td.print-date-column {
  background: var(--print-color-fixed-cell) !important;
}

/* Ajustar larguras para lista */
.print-list-table .print-day-column {
  width: 15%;
}

.print-list-table .print-date-column {
  width: 25%;
}

.print-list-table td:not(.print-day-column):not(.print-date-column) {
  text-align: left;
  font-weight: 600;
}
```

## Benefícios

1. **Visual equilibrado**: Com apenas 1 função, a tabela terá largura máxima de 50% e ficará centralizada
2. **Melhor aproveitamento do espaço**: Colunas "Dia" e "Data" terão larguras maiores (15% e 25% respectivamente)
3. **Nomes mais legíveis**: A coluna da função ficará à esquerda com mais espaço proporcional
4. **Consistência**: Mantém a estrutura de tabela mas com dimensões adequadas

## Validação

1. Gerar impressão da "Escala Pregadores CCRV - Agosto 2026" (1 função)
2. Verificar se a tabela está centralizada e com largura adequada
3. Verificar escalas com 2+ funções continuam funcionando normalmente
4. Testar em diferentes navegadores (Chrome, Firefox, Edge)
5. Verificar impressão em A4 landscape e portrait

## Dependências

- Nenhuma dependência nova
- Apenas modificação de componentes existentes
- CSS existente serve como base

## Riscos

- **Baixo**: A mudança é isolada ao layout de impressão
- **Mitigação**: Manter comportamento atual para 2+ funções
