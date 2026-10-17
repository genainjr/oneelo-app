# Plano - Performance da exportacao de Escalas (PDF/PNG)

Status geral: implementado localmente (validado com testes unitarios, build e benchmark comparativo; pronto para medicao final no Render Free)
Ultima atualizacao: 2026-10-17
Branch: `feature/escala-export-performance`

## Objetivo

Reduzir a latencia da exportacao de Escalas, principalmente do PNG semanal, sem voltar a reiniciar a API por consumo de memoria na hospedagem gratuita.

Este plano continua o [plano de estabilidade de memoria](escala-export-memory-stability-plan.md), que reverteu as otimizacoes anteriores, e complementa o [plano de exportacao de PDF e imagens](exportacao-pdf-plan.md).

## Contexto

### Ambiente de producao

- API NestJS no Render, plano **Free**: ~512 MB de RAM, CPU compartilhada (~0,1 vCPU) e hibernacao apos inatividade.
- Frontend no Vercel.
- O renderer usa Playwright/Chromium dentro do mesmo container da API.

### Uso real

- **PNG e o formato principal.** Toda semana, os membros acessam o sistema, geram a imagem da semana desejada e compartilham.
- **PDF e mensal** e tem uso esporadico.
- Hoje o PNG gera **todas as semanas** do periodo, mesmo quando o usuario precisa de apenas uma.

### Historico das tentativas

| Commit | Mudanca | Resultado |
|---|---|---|
| `20f1b4e` | Chromium persistente entre requisicoes; PNGs buscados em paralelo | Mais rapido, mas com Chromium residente e picos de memoria |
| `2f265c5` | Chromium iniciado no boot; pre-cache automatico de PDF e PNGs ao carregar ou filtrar a tela | Clique instantaneo, mas cada visita disparava varias renderizacoes nao solicitadas |
| `756c44f` | Reversao: Chromium por requisicao, fila serial, sem pre-cache, PNG sequencial | Memoria estavel e exportacao lenta |

Diagnostico: o estouro veio da combinacao de **Chromium residente + renderizacao especulativa + paralelismo**. O cache de arquivos gerados nao era o problema.

### Gargalos do estado atual

1. Cada semana em PNG e uma requisicao. Cada requisicao repete `findVisualizacao`, monta o input completo e abre e fecha um Chromium novo. Um mes com 5 semanas faz 5 inicializacoes em serie.
2. `chromium.launch` roda sem flags de baixa memoria. Em container, o `/dev/shm` pequeno pode derrubar ou degradar o renderer.
3. Os logos (Lookup Labs e tenant) sao baixados da rede a cada renderizacao, com espera de ate 3 s.
4. A fila serial nao tem limite de tamanho nem timeout por renderizacao.
5. A imagem Docker instala o Chromium completo, mas apenas o headless shell e usado.

Arquivos principais:

- `apps/api/src/modules/escalas/export/escala-document-renderer.service.ts`
- `apps/api/src/modules/escalas/export/escala-document-renderer.service.spec.ts`
- `apps/api/src/modules/escalas/export/escala-document.types.ts`
- `apps/api/src/modules/escalas/escalas.service.ts` (`exportar`)
- `apps/api/src/modules/escalas/escalas.controller.ts` (`GET /escalas/exportacao`)
- `apps/api/src/modules/escalas/dto/export-escala.dto.ts`
- `apps/api/Dockerfile`
- `apps/api/assets/LogoLookupLabs.png`
- `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`
- `apps/web/src/lib/api.ts`

## Decisoes

- **Nao reativar** o Chromium no boot nem o pre-cache automatico na UI. Renderizacao so acontece apos acao explicita do usuario.
- **Uma renderizacao por vez** por instancia continua sendo a regra.
- **Cachear o resultado, nao o renderizador.** Buffers de PDF/PNG sao pequenos e podem ser mantidos com limite de bytes e TTL. O Chromium nao fica residente.
- **O PNG semanal e o caso principal.** O usuario escolhe a semana antes de gerar; "Todas as semanas" fica como opcao secundaria.
- **Lote de PNGs em JSON com base64.** Na opcao "Todas", as imagens vem numa unica requisicao JSON. Para poucas imagens pequenas, o aumento de ~33% compensa a ausencia de ZIP e de dependencias novas. O usuario nao percebe diferenca.
- **Toda etapa e medida em producao** (RSS e tempos) antes de avancar para a proxima.
- Engines sem Chromium (ex.: `satori` + `resvg` para PNG) ficam fora deste plano. So entram se as metricas mostrarem que as etapas 1 a 4 nao bastam.

## Etapas de Desenvolvimento

### Etapa 0 - Medicao e baseline

Status: concluido

- [x] Registrar em log estruturado, por exportacao: formato, pagina(s), tempo de consulta, tempo de launch, tempo de render, tamanho do buffer, RSS antes e depois e tamanho da fila.
- [x] Seguir os padroes de `ai-context/observability/logging.md`.
- [x] Coletar baseline de referencia: PDF mensal e PNG de um mes com 5 semanas.
- [x] Registrar o baseline neste plano.

Resultado obtido (baseline antes das otimizacoes, escala mensal com 6 funcoes, 10 eventos e 5 semanas):

- **PDF mensal (2 paginas):** `1.266 ms` (`96.748 bytes`, RSS `+10,5 MiB`).
- **PNG sequencial (5 semanas, 5 requisicoes/launches em serie):** `5.043 ms` total (`922 ms`, `1.068 ms`, `849 ms`, `983 ms`, `1.219 ms`; ~`88 KB` por PNG; RSS acumulado `+17,6 MiB`).

### Etapa 1 - Renderer enxuto e protegido

Status: concluido

- [x] Adicionar flags de baixa memoria ao `chromium.launch` (`--disable-dev-shm-usage`, `--disable-gpu`, `--no-sandbox` + `--no-zygote` no Linux, `--renderer-process-limit=1`, `--disable-extensions`, `--disable-background-networking`, `--disable-default-apps`, `--disable-sync`, `--mute-audio`, `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`, `--js-flags=--max-old-space-size=128`).
- [x] Embutir o logo da Lookup Labs como data URI lido uma unica vez do disco ou de um asset da API (`apps/api/assets/LogoLookupLabs.png`).
- [x] Embutir o logo do tenant como data URI, com suporte a arquivos de ate 5 MB (`MAX_IMAGE_SIZE`), otimizacao automatica via `sharp` (`240x240` PNG) e cache em memoria pequeno (LRU limitado a 25 entradas e TTL de 30 min).
- [x] Bloquear requisicoes externas durante a renderizacao (`Content-Security-Policy` restritiva + `--host-resolver-rules`) e remover a espera por imagens (`waitForFunction`).
- [x] Limitar a fila (ate 3 aguardando). Acima do limite, responder `503` com `Retry-After: 5`.
- [x] Adicionar timeout por renderizacao (25 s), fechando o browser a forca quando estourar.
- [x] Tratar `503` no frontend com mensagem amigavel.
- [x] Instalar apenas o headless shell no Dockerfile (`npx playwright install --with-deps --only-shell chromium`).
- [x] Validar build da API e do web.
- [x] Medir e comparar com o baseline.

### Etapa 2 - Escolha da semana no PNG

Status: concluido

- [x] Expor a lista de semanas disponiveis para o filtro atual, com indice, intervalo e rotulo, derivada da mesma regra de `createWeeklyPages` e `formatWeekPeriod`.
- [x] Na escolha "Compartilhar como > Imagem", exibir a selecao de semana, pre-selecionando a semana atual ou a proxima com eventos.
- [x] Gerar apenas o PNG da semana escolhida (uma requisicao e uma renderizacao).
- [x] Manter a opcao "Todas as semanas".
- [x] Preservar o fluxo atual de compartilhamento nativo e o fallback de download.
- [x] Seguir `EXPORT_STANDARD.md` e os padroes do ODS para o seletor.
- [x] Validar em desktop e mobile.

### Etapa 3 - Lote de PNGs em uma requisicao

Status: concluido

- [x] Adicionar modo de lote ao contrato de exportacao para `formato=png` (`pagina=todas`).
- [x] No backend, abrir um unico browser e uma unica aba e renderizar as semanas em sequencia, liberando cada buffer apos a serializacao.
- [x] Responder em JSON: `{ files: [{ fileName, mimeType, base64 }], pageCount }`.
- [x] No frontend, converter para `File[]` e usar o mesmo fluxo de compartilhamento e download.
- [x] Remover a busca sequencial por pagina usada em "Todas as semanas".
- [x] Validar build e medir.

### Etapa 4 - Cache de resultado

Status: concluido

- [x] Criar cache em memoria no backend, com limite em bytes (`15 MB`) e TTL (`10 min`).
- [x] Usar como chave o hash SHA-256 do formato, da pagina e do `EscalaDocumentInput` serializado. Qualquer alteracao na escala gera uma chave nova.
- [x] Devolver `ETag` com o hash e responder `304` para `If-None-Match` igual, sem renderizar.
- [x] Manter no frontend um cache de blobs por filtro, formato e semana durante a sessao da tela, invalidado ao recarregar as escalas.
- [x] Garantir que o cache respeita o tenant e as permissoes (a chave deriva do input ja filtrado por `findVisualizacao`).
- [x] Validar build e medir hits e misses.

### Etapa 5 - Fechamento

Status: concluido

- [x] Atualizar status e checklist deste plano.
- [x] Registrar arquivos alterados, validacoes e metricas antes e depois.
- [x] Registrar riscos residuais.
- [x] Avaliar, com base nas metricas, se e necessario abrir um plano para engine de PNG sem Chromium.

## Metricas Antes vs Depois (mesma escala mensal de 5 semanas)

| Cenario | Antes (Baseline) | Depois (Otimizado) | Ganho |
|---|---|---|---|
| **PNG semanal (caso principal)** | `5.043 ms` (gerava as 5 semanas) / `922 ms` (1a semana) | **`453 ms`** (`launchMs: 123 ms`, `renderMs: 180 ms`, `rssDelta: +1,6 MiB`) | **-91%** no fluxo do usuario (**-51%** por render individual) |
| **PNG "Todas as semanas" (5 semanas)** | `5.043 ms` (5 requisicoes e 5 launches em serie) | **`663 ms`** (`launchMs: 54 ms`, `renderMs: 511 ms`, 1 requisicao e 1 launch) | **-87%** |
| **PDF mensal (2 paginas A4)** | `1.266 ms` | **`685 ms`** (`launchMs: 82 ms`, `renderMs: 439 ms`) | **-46%** |
| **Reexportacao (Cache Hit em memoria)** | `922 ms - 5.043 ms` | **`0,71 ms`** (`launchMs: 0`, `renderMs: 0`, `rssDelta: 0 MiB`) | **>99,9%** |
| **Revalidacao HTTP (`ETag` / `304`)** | N/A | **`0,38 ms`** (`bufferBytes: 0`, sem abrir Chromium) | **>99,9%** |

### Nota tecnica importante descoberta durante a implementacao

- O uso de `--no-zygote` sem `--no-sandbox` ou fora do Linux trava o compositor de captura de `page.screenshot()`. Por isso, `--no-sandbox` e `--no-zygote` sao aplicados condicionalmente em `process.platform === 'linux'`.
- O uso de `page.route('**/*', ...)` no Playwright adicionava ~18 s no `page.close()` / `browser.close()` devido ao teardown do interceptor CDP Fetch. A substituicao por `Content-Security-Policy` estrita (`default-src 'none'; img-src data:; style-src 'unsafe-inline'`) combinada com `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1` bloqueia qualquer rede externa sem overhead no fechamento do browser (~100-150 ms).

### Avaliacao sobre engine sem Chromium (`satori` + `resvg`)

- Com a reducao do PNG semanal para `~453 ms` (e `<1 ms` em cache) e do lote de 5 semanas para `~663 ms` em um unico launch, **nao e necessario** introduzir uma engine paralela sem Chromium neste momento. Caso o monitoramento dos logs estruturados `escala_export` no Render Free aponte contencao de CPU em horarios de pico apos o deploy, a migracao apenas do PNG para `satori` + `resvg` pode ser reavaliada em plano dedicado.

## Criterios de Aceitacao

- A API nao reinicia por memoria durante exportacoes no Render Free.
- O PNG de uma semana e gerado com uma unica renderizacao.
- "Todas as semanas" usa uma unica requisicao e um unico launch.
- Nenhuma renderizacao ocorre sem acao explicita do usuario.
- Exportacoes repetidas com os mesmos dados sao servidas pelo cache.
- O compartilhamento nativo e o fallback de download continuam funcionando em mobile e desktop.
- Layout e conteudo de PDF e PNG permanecem iguais aos atuais.
- Permissoes e isolamento por tenant permanecem inalterados.

## Riscos e Cuidados

- Flags como `--single-process` reduzem memoria, mas sao instaveis no Playwright. Nao usar sem medicao.
- O cache em memoria e perdido quando a instancia hiberna ou reinicia. Isso e aceitavel.
- O base64 aumenta o payload em ~33%. Reavaliar se o numero de semanas por lote crescer.
- O `navigator.share` exige ativacao do usuario. Etapas assincronas longas antes do share podem fazer o navegador recusar; manter o botao explicito de compartilhar como fallback.
- O primeiro acesso apos a hibernacao do Render continua lento (cold start do container). Isso esta fora do controle deste plano.
- A selecao de semana deve usar a mesma regra de agrupamento do renderer, para evitar divergencia de indices.

## Fora de Escopo

- Engine de renderizacao sem Chromium.
- Mover a renderizacao para outro servico ou para funcao serverless.
- Mudanca de plano de hospedagem.
- Exportacao da Agenda.
- Alteracoes visuais nos templates de PDF/PNG.

