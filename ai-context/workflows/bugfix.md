# Workflow de Bugfix

Este workflow deve ser seguido para correções de bugs, hotfixes e ajustes emergenciais.

---

## 1. Padrão de Branch e Isolamento

1. Sempre partir da branch `development` atualizada.
2. Criar uma branch descritiva com o prefixo `fix/` (ou `hotfix/`).
3. **Se houver outra feature ou agente trabalhando na pasta principal:**
   - **NÃO** trocar de branch na pasta principal (`git checkout`).
   - Use obrigatoriamente o workflow de **[`git worktree`](./git-worktree.md)** para criar uma pasta de trabalho irmã:
     ```bash
     git fetch origin
     git worktree add -b fix/descricao-do-bug ../oneelo-bugfix origin/development
     ```
4. Se o repositório estiver limpo e sem outros agentes ativos:
   ```bash
   git checkout development
   git pull origin development
   git checkout -b fix/descricao-do-bug
   ```

---

## 2. Investigação e Diagnóstico

Antes de alterar código:

1. **Reproduzir o erro**: Compreender o cenário exato descrito pelo usuário ou pelo log.
2. **Identificar a causa raiz**: Rastrear services, controllers, interfaces e fluxos no frontend.
3. **Verificar escopo**: Garantir que a correção atinja a causa raiz sem introduzir regressões ou efeitos colaterais em módulos adjacentes.

---

## 3. Implementação da Correção

- Manter a intervenção cirúrgica e enxuta, focando especificamente no problema relatado.
- Seguir os padrões arquiteturais estabelecidos em `ai-core/` e `ai-context/`.
- Preservar tipagens fortes e integridade de comentários e documentações.

---

## 4. Validação e Testes

Antes de finalizar:

1. Rodar os testes automatizados relevantes:
   ```bash
   npm test -w apps/api
   ```
2. Executar o build para validação de tipos e compilação:
   ```bash
   npm run build -w apps/web
   ```
3. Testar manualmente o cenário que causou a falha.

---

## 5. Finalização e Limpeza

1. Commitar com mensagem semântica:
   ```bash
   git add .
   git commit -m "fix(modulo): descricao clara da correcao"
   git push -u origin fix/descricao-do-bug
   ```
2. Se o bugfix foi feito em um `git worktree`:
   ```bash
   cd ../oneelo-app
   git worktree remove ../oneelo-bugfix
   ```
3. Informar ao usuário:
   - Causa raiz identificada;
   - Arquivos alterados;
   - Testes e validações executados;
   - Link do PR ou confirmação do push.
