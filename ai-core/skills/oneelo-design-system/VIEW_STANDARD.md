# ODS - View Standard

## Objetivo

Definir o padrao unico para paginas de visualizacao, consulta e detalhes read-only no OneElo, usando os padroes encontrados em `membros/visualizacao`, `escalas/visualizacao`, `minhas-escalas`, `meu-perfil`, `dashboard` e `ComingSoon`.

## Estrutura padrao

1. `PageHeader` com titulo e descricao.
2. Resumo opcional com metricas.
3. Filtros opcionais quando a visualizacao consultar colecoes.
4. Conteudo read-only:
   - tabela/lista para entidades simples;
   - grade para escalas;
   - cards para participacoes ou eventos;
   - drawer para detalhes laterais.
5. `EmptyState` para ausencia de dados.
6. Erro inline com retry.

## Componentes obrigatorios

- `PageHeader`
- `EmptyState`
- Estado de `loading`
- Estado de `error`
- Visualizacao sem controles de edicao quando a rota for read-only

Para detalhe lateral:

- `MemberProfileDrawer` como referencia de padrao de drawer.

Para grade read-only de escala:

- `EscalaReadonlyGrid`

## Componentes opcionais

- `StatCard` para metricas.
- Filtros com aplicar, limpar e recarregar.
- Botao de imprimir em visualizacoes printaveis.
- Drawer de detalhes.
- Cards read-only quando a informacao for mais natural como participacao ou evento.
- `ComingSoon` para modulos futuros.

## Regras de UX

- Nao mostrar botoes de edicao em rotas de visualizacao.
- Usar linguagem de consulta: "consulte", "acompanhe", "visualizacao".
- Mostrar metricas antes da lista quando elas ajudam a leitura.
- Permitir abrir detalhes sem mudar para modo de edicao.
- Em mobile, trocar tabelas densas por cards quando a tabela nao couber bem.
- Usar `EmptyState` quando nao houver resultados.
- Manter acao secundaria, como imprimir, no `PageHeader`.

## Regras de navegacao

- Rotas read-only devem usar sufixo `/visualizacao` quando forem alternativa a rota de gerenciamento.
- A sidebar deve separar "Gerenciar", "Visualizacao" e "Exportacao" quando o modulo tiver essas variacoes.
- BASIC comum nao deve acessar visualizacoes administrativas.
- BASIC lider/co-lider pode acessar visualizacoes de ministerios/escalas apenas no escopo permitido.
- `/minhas-escalas` e uma visualizacao do membro, nao uma rota administrativa.

## Exemplos de uso

### Visualizacao read-only com metricas

```tsx
<PageHeader
  title="Visualizacao de membros"
  description="Consulte membros, contatos e participacao sem editar."
/>

<div className="grid">
  <StatCard title="Ativos" value={stats.ativos} icon={icon} />
  <StatCard title="Sem telefone" value={stats.semContato} icon={icon} />
</div>
```

### Visualizacao read-only com drawer

```tsx
<DataTable
  columns={columns}
  data={items}
  loading={loading}
  emptyTitle="Nenhum membro encontrado"
/>

<MemberProfileDrawer
  membro={selected}
  onClose={() => setSelected(null)}
/>
```

### Visualizacao de escala

```tsx
<PageHeader title="Visualizacao de escalas" action={<button>Imprimir</button>} />

{escalas.map((escala) => (
  <EscalaReadonlyGrid key={escala.id} escala={escala} />
))}
```

## Anti-padroes identificados na auditoria

- `StatBox` local duplicando `StatCard`.
- Tabela read-only manual quando `DataTable` poderia ser adaptado.
- Filtros read-only visualmente diferentes dos filtros CRUD.
- Cards de metricas locais em `/minhas-escalas` e `/escalas/visualizacao`.
- Mistura de rotas read-only e gerenciais sem padrao uniforme em alguns modulos.

