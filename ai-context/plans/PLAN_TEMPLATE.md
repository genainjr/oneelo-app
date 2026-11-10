# Template Oficial de Plano de Desenvolvimento

> **Atenção (Obrigatório para IAs e Desenvolvedores):**  
> Todo plano de desenvolvimento criado ou atualizado em `ai-context/plans/` deve seguir rigorosamente a estrutura deste template.  
>
> ### Regras Inegociáveis de Formatação e Checklists (`- [ ]`):
> 1. **Seção Obrigatória de Etapas:** É obrigatório ter a seção `## Etapas de Desenvolvimento` dividida em subseções numeradas sequencialmente (`### Etapa 0 - ...`, `### Etapa 1 - ...`) com `Status: [planejado | em andamento | concluido]`.
> 2. **Proibido Bullets Simples sem Checkbox nas Etapas:** Dentro de `## Etapas de Desenvolvimento`, **TODOS os itens, sub-itens indentados (`  - [ ]`) e o próprio `Critério de validação da etapa` DEVEM possuir caixa de marcação `- [ ]`**. É estritamente proibido usar marcadores simples (`- `) ou listas numeradas sem `[ ]`.
> 3. **Granularidade por Arquivo / Módulo (Proibido Condensar):** Nunca agrupe múltiplos arquivos ou telas em um único checkbox genérico (ex: *errado:* `- [ ] Atualizar as 12 páginas do dashboard`). Desmembre em checkboxes individuais por arquivo ou módulo para permitir marcação incremental (`[x]`) durante o desenvolvimento.
> 4. **Critérios de Aceite Gerais Verificáveis:** Todos os itens da seção `## Critérios de Aceite Gerais` também devem usar checkboxes (`- [ ]`) para conferência final.

---

```markdown
# Plano - [Nome da Funcionalidade / Correção]

Status geral: [planejado | em andamento | concluido]  
Data de criação: AAAA-MM-DD  
Branch sugerida para implementação: feature/nome-da-feature  

## Planos e Referências Relacionados

- [Documento de Contexto / Padrão ODS](caminho-relativo.md)
- [Backlog Relacionado](caminho-relativo.md)

---

## 1. Objetivo da Entrega

[Descrição clara e concisa do que será entregue, o problema resolvido e os resultados esperados para o usuário e para o sistema.]

---

## 2. Contexto e Diagnóstico

[Diagnóstico do estado atual do código, regras de negócio envolvidas, limitações identificadas e justificativa das mudanças propostas.]

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

[Decisões técnicas fundamentadas: componentes compartilhados a utilizar/criar, contratos de API/DTOs, estratégias de banco/cache/performance, matriz de riscos e regras de isolamento multitenant e segurança.]

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - [Preparação / Baseline / Infraestrutura] (Opcional quando aplicável)
Status: [planejado | em andamento | concluido]

- [ ] Tarefa verificável 1
- [ ] Tarefa verificável 2
- [ ] Critério de validação da etapa: [Comando de teste, build ou verificação específica para comprovar a conclusão da etapa]

### Etapa 1 - [Primeira Entrega Lógica ou Componente Base]
Status: [planejado | em andamento | concluido]

- [ ] Tarefa principal 1 (`caminho/do/arquivo.ts`):
  - [ ] Sub-tarefa específica 1.1 (sempre com `- [ ]`, nunca bullet simples)
  - [ ] Sub-tarefa específica 1.2
- [ ] Tarefa principal 2 (`caminho/do/outro-arquivo.tsx`)
- [ ] Critério de validação da etapa: [Como validar o resultado antes de pedir autorização para a próxima etapa]

### Etapa 2 - [Segunda Entrega / Integração Granular por Módulo]
Status: [planejado | em andamento | concluido]

- [ ] Atualizar módulo/tela A (`caminho/tela-a.tsx`)
- [ ] Atualizar módulo/tela B (`caminho/tela-b.tsx`)
- [ ] Atualizar módulo/tela C (`caminho/tela-c.tsx`)
- [ ] Critério de validação da etapa: [Como validar o resultado antes de pedir autorização para a próxima etapa]

### Etapa 3 - [Terceira Entrega / Telas ou Endpoints Complementares]
Status: [planejado | em andamento | concluido]

- [ ] Tarefa verificável 1
- [ ] Tarefa verificável 2
- [ ] Critério de validação da etapa: [Como validar o resultado antes de pedir autorização para a próxima etapa]

### Etapa 4 - [Validação, Testes, Documentação e Build Final]
Status: [planejado | em andamento | concluido]

- [ ] Atualizar documentação relevante em `ai-context/` ou `ai-core/`
- [ ] Executar bateria de testes automatizados (`npm test`)
- [ ] Validar build de produção (`npm run build` nos pacotes afetados)
- [ ] Validação integrada de fluxos (desktop e mobile)
- [ ] Critério de validação da etapa: [Build passando sem erros e cobertura de cenários críticos]

---

## 5. Critérios de Aceite Gerais

- [ ] [Critério funcional 1]
- [ ] [Critério de UX / consistência visual com o Design System]
- [ ] [Critério de performance / segurança / não-regressão]
```
