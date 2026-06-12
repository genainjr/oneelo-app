# Estrutura do Monorepo One Elo

Atualizado em: 10 de junho de 2026

Este documento explica a estrutura do projeto One Elo para uma pessoa que ainda nao e desenvolvedora. A ideia e mostrar "onde fica cada coisa" e qual papel cada parte tem no produto.

## Explicacao rapida

O One Elo e uma plataforma SaaS para gestao de igrejas. Ela ajuda a organizar membros, ministerios, escalas, agenda, usuarios, permissoes e dados administrativos.

O repositorio e um monorepo. Isso significa que varios projetos relacionados ficam dentro da mesma pasta principal. Neste caso, os principais sao:

- `apps/api`: o sistema por tras da tela, responsavel por regras, login, permissoes e banco de dados.
- `apps/web`: a interface que a pessoa acessa no navegador.
- `docker-compose.yml`: sobe os servicos locais, como banco, API e web.
- `ai-context` e `ai-core`: documentacao e regras para orientar manutencao com IA.

## Visao em camadas

```txt
Pessoa usando o sistema
  -> Navegador
  -> apps/web
  -> apps/api
  -> Banco PostgreSQL
```

Em palavras simples:

- A pessoa ve e clica nas telas do `apps/web`.
- O `apps/web` pede informacoes para a `apps/api`.
- A `apps/api` aplica regras de negocio e salva ou busca dados no banco.
- O banco guarda os dados da igreja, membros, escalas, eventos e usuarios.

## Estrutura principal

```txt
oneelo-app/
  apps/
    api/
      prisma/
      src/
        common/
        modules/
        main.ts
      test/
      package.json
      Dockerfile

    web/
      public/
      src/
        app/
        components/
        hooks/
        i18n/
        lib/
        types/
        middleware.ts
      messages/
      package.json
      Dockerfile

  ai-context/
  ai-core/
  docs/
  docker-compose.yml
  package.json
  package-lock.json
```

## Pasta `apps`

A pasta `apps` guarda os produtos que realmente rodam.

### `apps/api`

E o backend. Pense nele como o "escritorio interno" do sistema: ele recebe pedidos da tela, confere permissao, valida dados, executa regras e conversa com o banco.

Tecnologias principais:

- NestJS: estrutura da API.
- Prisma: camada que conversa com o banco.
- PostgreSQL: banco de dados.
- Jest: testes.

Partes importantes:

- `src/main.ts`: ponto de entrada da API.
- `src/app.module.ts`: registra os modulos principais da API.
- `src/modules`: funcionalidades do sistema, separadas por tema.
- `src/common`: pecas compartilhadas, como seguranca, autorizacao, auditoria e conexao com banco.
- `prisma/schema.prisma`: desenho das tabelas do banco.
- `prisma/migrations`: historico de mudancas no banco.
- `test`: testes de ponta a ponta da API.

Modulos encontrados na API:

| Modulo | Para que serve |
| --- | --- |
| `auth` | Login, logout, usuario atual, troca de senha, usuarios e auditoria. |
| `membros` | Cadastro, busca, visualizacao e organizacao de membros. |
| `tags` | Etiquetas para classificar membros. |
| `ministerios` | Cadastro de ministerios, funcoes e membros vinculados. |
| `escalas` | Criacao, edicao, visualizacao e confirmacao de escalas. |
| `eventos` | Agenda de eventos da igreja. |
| `dashboard` | Indicadores e numeros resumidos para a tela inicial. |
| `super-admin` | Area administrativa da plataforma, como tenants e usuarios iniciais. |
| `leads` | Captura de interessados vindos da pagina publica. |

### `apps/web`

E o frontend. Pense nele como a "vitrine e painel" do sistema: tudo que a pessoa ve no navegador fica aqui.

Tecnologias principais:

- Next.js: estrutura do site e do painel.
- React: criacao das telas.
- Tailwind CSS: estilos visuais.
- next-intl: traducao e suporte a idiomas.

Partes importantes:

- `src/app`: paginas e rotas do sistema.
- `src/components`: blocos reutilizaveis de interface, como sidebar, tabela, cabecalho e modais.
- `src/hooks`: funcoes que buscam dados e organizam estado das telas.
- `src/lib`: funcoes auxiliares, como cliente da API, autenticacao, CSV e utilitarios.
- `src/i18n`: configuracao de idiomas.
- `messages`: textos traduzidos em `pt-BR`, `pt-PT` e `en-US`.
- `middleware.ts`: protege rotas, redireciona usuarios e aplica regras basicas de acesso.
- `public`: imagens e arquivos publicos.

Principais telas encontradas:

| Tela | Funcao |
| --- | --- |
| `/` | Pagina publica inicial. |
| `/login` | Login de usuarios da igreja. |
| `/admin/login` | Login de super administrador. |
| `/admin` | Gestao de tenants e usuarios iniciais da plataforma. |
| `/dashboard` | Painel com indicadores. |
| `/membros` | Cadastro e gestao de membros. |
| `/membros/visualizacao` | Consulta de membros sem edicao. |
| `/membros/exportacao` | Exportacao de membros em CSV. |
| `/ministerios` | Gestao de ministerios, funcoes e participantes. |
| `/ministerios/exportacao` | Exportacao de ministerios. |
| `/escalas` | Montagem e edicao de escalas. |
| `/escalas/visualizacao` | Visualizacao de escalas sem controles de edicao. |
| `/escalas/exportacao` | Exportacao de escalas. |
| `/minhas-escalas` | Area do membro para ver e confirmar participacoes. |
| `/agenda` | Cadastro e consulta de eventos. |
| `/agenda/exportacao` | Exportacao de eventos. |
| `/configuracoes` | Gestao de usuarios e configuracoes. |
| `/meu-perfil` | Dados do usuario logado. |
| `/financeiro`, `/grupos`, `/integracoes`, `/ministerios/louvor`, `/ministerios/infantil`, `/ministerios/midia` | Modulos previstos ou em apresentacao inicial. |

## Pasta `prisma`

A pasta `apps/api/prisma` descreve e versiona o banco de dados.

O arquivo `schema.prisma` mostra as principais entidades do sistema:

| Entidade | Significado simples |
| --- | --- |
| `Tenant` | Uma igreja ou organizacao cliente da plataforma. |
| `User` | Pessoa que tem login no sistema. |
| `Membro` | Pessoa cadastrada na igreja, mesmo que nao tenha login. |
| `Tag` | Marcador usado para organizar membros. |
| `Ministerio` | Area de servico, como louvor, infantil ou midia. |
| `MinisterioFuncao` | Funcao dentro de um ministerio, como vocal, guitarra ou professor. |
| `Escala` | Planejamento mensal de um ministerio. |
| `EscalaDia` | Dia especifico dentro de uma escala. |
| `EscalaItem` | Participacao de um membro em uma funcao naquele dia. |
| `Evento` | Evento da agenda da igreja. |
| `AuditLog` | Registro de acoes importantes feitas no sistema. |
| `Lead` | Pessoa interessada capturada pela pagina publica. |

## Pasta `docs`

Guarda materiais de apoio do projeto. Atualmente contem planilhas e imagens usadas como referencia ou insumo:

- `ccrv_registros.xlsx`
- `escalas_ccrv_junho-2026.xlsx`
- `LogoIcone.jpg`
- este documento foi gerado na raiz do repositorio como `ESTRUTURA_MONOREPO.md`.

## Pastas `ai-context` e `ai-core`

Essas pastas nao fazem parte direta da aplicacao que o usuario acessa. Elas servem para documentar decisoes, regras, padroes e fluxos de trabalho usados por ferramentas de IA e por quem mantem o projeto.

Exemplos:

- arquitetura geral;
- regras de banco;
- regras de frontend;
- regras de backend;
- backlog;
- planos de evolucao;
- fluxos de desenvolvimento, bugfix e code review.

Para uma pessoa nao tecnica, o mais importante e entender que essas pastas funcionam como "manual interno de manutencao".

## Arquivos da raiz

| Arquivo | Para que serve |
| --- | --- |
| `package.json` | Define o monorepo, os apps e comandos principais. |
| `package-lock.json` | Trava versoes das dependencias para evitar diferencas entre maquinas. |
| `docker-compose.yml` | Sobe banco, API e web juntos em ambiente local. |
| `.dockerignore` | Diz ao Docker quais arquivos ignorar. |
| `.gitignore` | Diz ao Git quais arquivos nao versionar. |
| `AGENTS.md` | Orienta agentes de IA sobre onde buscar contexto do projeto. |
| `check-i18n.cjs` | Script para verificar consistencia das traducoes. |
| `ROADMAP_ONEELO_HOMOLOGACAO.md` | Roadmap de homologacao do produto. |
| `plano_evolucao_modelo_responsabilidades.md` | Plano de evolucao de responsabilidades e permissoes. |
| `plano_desenvolvimento_ideal_markdown.md` | Plano geral de desenvolvimento. |

## Como o sistema roda localmente

O `docker-compose.yml` define tres servicos principais:

| Servico | Papel | Porta local |
| --- | --- | --- |
| `postgres` | Banco de dados PostgreSQL. | `5433` |
| `api` | Backend NestJS. | `3000` |
| `web` | Frontend Next.js. | `3001` |

Tambem existem comandos npm na raiz:

```bash
npm run dev
npm run db:migrate
npm run db:seed
```

Em resumo:

- `npm run dev` inicia API e Web em modo desenvolvimento.
- `npm run db:migrate` aplica mudancas no banco.
- `npm run db:seed` cria dados iniciais.

## O que nao precisa apresentar para uma pessoa nao tecnica

Algumas pastas sao importantes para o computador, mas nao ajudam na explicacao do produto:

- `node_modules`: dependencias instaladas.
- `.next`: build/cache local do Next.js.
- `.git`: historico interno do Git.
- `dist`, `coverage` ou caches, se aparecerem: resultados gerados por build ou testes.

Essas pastas podem ser ignoradas em uma apresentacao.

## Resumo para apresentacao

Se precisar explicar em poucos minutos:

1. O projeto e um monorepo porque guarda a tela, a API, o banco e a documentacao de apoio no mesmo lugar.
2. `apps/web` e o que a pessoa usa no navegador.
3. `apps/api` e o motor que valida regras, seguranca e dados.
4. `apps/api/prisma` descreve o banco de dados.
5. `docker-compose.yml` ajuda a rodar tudo junto localmente.
6. `ai-context` e `ai-core` sao manuais internos para manter o projeto com mais consistencia.

## Mapa mental

```txt
One Elo
  Produto
    Web: telas, formularios, painel e navegacao
    API: login, regras, permissoes e operacoes
    Banco: dados de igrejas, membros, ministerios, escalas e eventos

  Apoio
    Docs: materiais e explicacoes
    AI Context/Core: padroes e contexto de manutencao
    Docker: ambiente local
```
