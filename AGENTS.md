<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Canon Codex

Leia antes de mudar qualquer coisa:

- [PROJECT.md](PROJECT.md): regras de arquitetura e convenções de mudança.
- [CONTEXT.md](CONTEXT.md): termos do domínio; use-os em código, docs e mensagens.
- [Como documentar](docs/contributing/documentation.md): toda mudança de código, dados, migração,
  API, Server Action ou configuração avalia e atualiza as páginas afetadas na mesma tarefa, pela
  tabela "Quando atualizar". Se nenhuma página mudar, diga o motivo no resumo; não presuma que
  mudança de contrato é neutra.
- [Commits e branches](docs/contributing/commits.md): commits pequenos, em português, no formato
  `tipo(escopo): resumo`, com `Refs #N`.

Antes de encerrar uma tarefa que mexeu em `.md`, rode `pnpm docs:check`.

Não copie dados reais de `workspace/` para documentação, exemplos ou testes; use dados sintéticos.

