<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Manutenção documental do Canon Codex

- Em toda mudança de código, dados persistidos, migração, API, Server Action, integração ou
  configuração, avalie o impacto em README, PROJECT.md, ADRs e guias em `docs/`.
- Atualize as páginas afetadas na mesma tarefa, mantendo afirmações separadas entre implementado,
  planejado e não verificado.
- Se a análise concluir que nenhuma página precisa mudar, registre explicitamente o motivo no
  resumo da tarefa ou no relatório de mudança; não presuma que mudanças de contrato são
  documentais neutras.
- Não copie dados reais de `workspace/` para documentação, exemplos ou testes.

## Privacidade do workspace

- `workspace/` e todos os seus descendentes são dados privados do usuário e estão fora do escopo da IA.
- Trate esse caminho como indisponível: não liste, pesquise, abra, leia, indexe, resuma, copie, cite
  nem use qualquer conteúdo dele como contexto, exemplo, teste ou evidência.
- Para testes e exemplos, use somente dados sintéticos em diretórios temporários ou arquivos fora de
  `workspace/`. A política correspondente também está registrada em `.aiignore`.
