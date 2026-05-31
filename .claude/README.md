# AI Context Bootstrap

This directory is only a bootstrap layer for tool-specific integrations.

Load and prioritize context from:

1. ../ai-core/
   Shared engineering standards, workflows, commands and skills.

2. ../ai-context/
   Repository-specific architecture, domain rules and operational context.

Rules:
- Repository-specific context overrides shared context when conflicts occur.
- Do not duplicate context inside `.claude` or `.opencode`.
- Treat `ai-core` as the global source of truth.