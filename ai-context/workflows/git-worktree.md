# Workflow: Desenvolvimento Paralelo com Git Worktree

Este workflow define as regras e o passo a passo obrigatório para trabalhar em múltiplas branches simultaneamente no mesmo computador, especialmente quando múltiplos agentes de IA ou tarefas concorrentes (como um BUGFIX urgente durante o desenvolvimento de uma FEATURE) estão em andamento.

---

## 1. O Problema da Troca de Branch no Mesmo Diretório

Em um repositório Git padrão, uma única pasta só pode ter uma branch ativa (`HEAD`) por vez.

Quando um agente ou desenvolvedor executa `git checkout <outra-branch>` ou `git stash`:
- Todos os arquivos do diretório de trabalho são substituídos instantaneamente pelos arquivos da outra branch.
- Sessões concorrentes de IA perdem o contexto, arquivos modificados sem commit vão para o stash ou são perdidos.
- Servidores de desenvolvimento ativos (`next dev`, `nest start`) sofrem recargas inesperadas ou quebram.

---

## 2. Regra Obrigatória para Tarefas Concorrentes

> [!IMPORTANT]
> **Nunca execute `git checkout` para outra branch de trabalho dentro da pasta principal se houver uma feature em andamento ou outro agente ativo.**
> Em vez disso, use **`git worktree`** para criar um diretório de trabalho irmão isolado.

---

## 3. Passo a Passo do Git Worktree

### A. Criando um Worktree para Bugfix ou Tarefa Paralela

Estando na pasta principal do projeto (`oneelo-app`):

```bash
# 1. Garanta que as referências remotas estão atualizadas
git fetch origin

# Caso A: A branch de bugfix já existe remotamente ou localmente
git worktree add ../oneelo-bugfix feature/nome-da-branch

# Caso B: Criando uma nova branch de bugfix a partir de development
git worktree add -b fix/descricao-do-bug ../oneelo-bugfix origin/development
```

### B. Trabalhando no Diretório Isolado

Abra o novo diretório em outro terminal ou sessão da IDE:

```bash
cd ../oneelo-bugfix

# Executar validações ou iniciar os serviços
# Dica: se o servidor da pasta principal estiver ocupando a porta 3000/3001, rode em portas alternativas:
npm run dev -w apps/web -- -p 3002
```

O agente que estiver trabalhando no bugfix opera **100% isolado** dentro de `../oneelo-bugfix`, sem afetar os arquivos, branches ou stashes da pasta `oneelo-app`.

### C. Concluindo e Removendo o Worktree

Após finalizar a implementação, testar e commitar:

```bash
# Dentro de ../oneelo-bugfix:
git add .
git commit -m "fix(modulo): descricao objetiva do ajuste"
git push -u origin <nome-da-branch>

# Retorne à pasta principal:
cd ../oneelo-app

# Remova o worktree com segurança:
git worktree remove ../oneelo-bugfix
```

Se o diretório tiver sido excluído manualmente, você pode limpar os ponteiros do Git executando:
```bash
git worktree prune
```

### D. Listando os Worktrees Ativos

Para conferir quais diretórios e branches estão abertos:
```bash
git worktree list
```

---

## 4. Diretrizes para Agentes de IA

1. Ao receber uma tarefa enquanto outra estiver pendente ou em branch diferente:
   - Verifique `git branch --show-current` e `git status`.
   - Se a branch atual for diferente da branch da tarefa solicitada e houver trabalho não commitado, **não faça stash nem checkout direto**.
   - Avise o usuário e utilize `git worktree add` para operar no diretório correspondente.
2. Cada sessão de agente deve atuar exclusivamente no diretório de trabalho associado à sua branch.
