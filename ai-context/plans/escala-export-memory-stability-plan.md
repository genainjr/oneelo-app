# Plano - Estabilidade de memoria da exportacao de Escalas

Status: concluido

Continuacao: [Plano - Performance da exportacao de Escalas](escala-export-performance-plan.md).

## Objetivo

Impedir que exportacoes PDF/PNG reiniciem a API de producao por consumo de memoria, sem introduzir fila persistente ou armazenamento de documentos.

## Decisoes

- A API abre o Chromium apenas durante uma renderizacao e o fecha ao final.
- Uma fila em memoria permite somente uma renderizacao Playwright por instancia.
- A UI nao pre-carrega documentos; PDF ou PNG so e gerado apos escolha explicita do usuario.
- O compartilhamento nativo continua sendo uma segunda acao explicita, depois que o arquivo foi preparado, preservando a ativacao exigida em navegadores mobile.
- PNGs sao buscados sequencialmente para nao criar rajadas de requisicoes de renderizacao.

## Checklist

- [x] Remover inicializacao persistente do Chromium no boot.
- [x] Serializar renderizacoes e liberar recursos mesmo em erro.
- [x] Remover pre-cache automatico e compartilhamento automatico da UI.
- [x] Buscar paginas PNG sequencialmente.
- [x] Validar build da API e do web.
