# AI Context Bootstrap

This repository uses a centralized AI context structure.

Load and prioritize context from:

1. ./ai-core/
   Shared engineering standards, workflows, commands and skills.

2. ./ai-context/
   Repository-specific architecture, domain rules and operational context.

Rules:

- Repository-specific context overrides shared context when conflicts occur.
- Do not duplicate context inside AGENTS.md.
- Treat ai-core as the global source of truth.
- Always read both directories before proposing architectural or code changes.
- Follow repository conventions before introducing new patterns.
- Before any implementation, confirm the work is starting from `development`, update it if needed, and create a descriptive feature branch. Do not edit code before that check.
