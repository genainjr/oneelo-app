# Backlog - Exportacao de PDF e Imagens

### FT-015 Exportacao de PDF e Imagens de Escalas e Agenda

- **Prioridade**: alta
- **Status**: implementado (unificado PDF e PNG para Escalas e Agenda com Playwright/Chromium via PR #210)
- **Fase**: entregue
- **Categoria**: produto / exportacao / documentos
- **Esforco estimado**: medio
- **Contexto**: as visualizacoes de Escalas e Agenda usavam `window.print()` e CSS de impressao no navegador, dependendo do driver e papel de cada maquina. A funcionalidade migrou para geracao sincrona no backend com Playwright e Chromium headless.
- **Acao**: implementado renderer sincrono de PDF e PNG com seletor de semanas, download direto e modal de compartilhamento integrado no frontend.
- **Impacto**: arquivos consistentes em formato A4, com layout oficial do OneElo, independentes do navegador do usuario.

## Objetivo

Permitir que um usuario autorizado gere e baixe o PDF ou imagens PNG atuais de uma Escala ou da Agenda diretamente pelo sistema.
