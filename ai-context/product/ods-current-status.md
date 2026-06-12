# OneElo Design System (ODS) - Status Atual

## Consolidado de Fases Concluídas

| Fase | Objetivo | Resultado | Status |
|---|---|---|---|
| **Fase 0 (Baseline)** | Mapear rotas, estados críticos e garantir fundação segura sem regressões. | Fluxos mapeados. Nenhuma quebra funcional. | **Concluída** |
| **Fase 1 (Fundações)** | Criar componentes base (Modais, Inputs, Formulários) sem afetar UX global precocemente. | Repositório de componentes estruturais gerado. Uso em exemplos prova de conceito. | **Concluída** |
| **Fase 2 (Feedback)** | Remover calls nativos bloqueantes (`alert`, `confirm`) por UI ODS customizada. | 100% de alertas expurgados dos módulos alvos. Tradução aplicada. | **Concluída** |
| **Fase 3 (Exportações)** | Unificar o layout e a engenharia dos relatórios CSV. | Container e hooks genéricos acoplados perfeitamente. Código reduzido em 60%. | **Concluída** |
| **Fase 4 (Filtros)** | Padronizar containers de filtro e centralizar states fragmentados de inputs de busca. | Formulários limpos e consistentes nas 5 páginas alvo com submissões não-nativas. | **Concluída** |
| **Fase 7 (Visualizações e Métricas)** | Consolidar views read-only, padronizar cards de métrica e extrair componentes comuns como `InfoItem`. | Padronização alcançada em `/minhas-escalas`, `/meu-perfil` e drawers. | **Concluída** |

---

## ODS Compliance Geral

| Área | Aderência ODS |
| ---- | ------------- |
| Exportações | ~100% |
| Filtros | ~100% |
| Formulários | ~50% |
| Modais | ~50% |
| Tabelas / Listagens | ~20% |
| CRUDs | ~20% |
| Navegação | 0% |
| Permissões | 0% |

---

## Componentes Compartilhados do Sistema
- `ModalShell` e `ModalError`
- `ConfirmDialog`
- `InputField`, `SelectField`, `TextareaField`, `PasswordField`
- `FilterShell` e `FilterActions`
- `ExportShell`

## Hooks Compartilhados
- `useExport<T>`
- `useFilterState<T>`

---

## Débitos Técnicos
- Fragmentações legadas na estrutura do `PasswordField` persistentes na view `/meu-perfil`.
- Módulos avançados de tabelas espalhados em tags HTML genéricas sem invólucros `DataTable` globais.
- Modais híbridos (criados nas telas antigas e que não usam `ModalShell`) espalhados por diversas páginas, dificultando manutenção.
- Chamadas repetitivas de `setState` dentro de `useEffect` no carregamento das páginas.

## Próximas Prioridades e Roadmap Recomendado
A próxima prioridade imediata recai sobre a adequação estrutural das **Tabelas / Listagens**. Elas formam o elo direto entre a listagem de dados (já envoltas nos modernos cabeçalhos ODS) e a futura padronização dos fluxos de Modais CRUD (edição e gestão por linha de dados).

Por ordem recomendada:
1. Tabelas (Grid de visualização)
2. Modais CRUD
3. Navegação (Cosméticos, Sidebar)
4. Visualizações finais
5. Refinamentos UX / Permissões
