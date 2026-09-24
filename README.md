# Canon Codex

Canon Codex é uma wiki local para criar, organizar e apresentar universos ficcionais. A versão
atual roda como uma aplicação Next.js local, grava mundos em JSON, oferece um calendário configurável
por mundo e registros de personagens, locais, organizações, criaturas, evidências, artefatos, cosmologia, eventos e
narrativas, além de editor, relações, busca, quadros e cenas projetáveis.

Esta documentação descreve o comportamento implementado em **23/09/2026**. Autenticação,
colaboração remota, banco relacional, armazenamento em nuvem e publicação pública não fazem parte
da versão verificada.

## Começar

Requisitos verificados no projeto:

- Node.js `>=20.9.0` (requisito declarado pelo Next.js `16.3.4` instalado);
- pnpm, preferencialmente a versão declarada em `package.json` (`12.3.4`).

```bash
git clone https://github.com/Eni19/Canon_Codex.git
cd Canon_Codex
pnpm install
pnpm dev
```

Abra <http://localhost:3000>. Na primeira leitura, a aplicação cria um mundo semente chamado
`Canon Codex` quando ainda não existe `workspace/worlds/`. Para uma instalação isolada, veja
[Configuração](docs/reference/configuration.md).

Comandos disponíveis:

```bash
pnpm dev        # desenvolvimento
pnpm build      # build de produção
pnpm start      # servidor local de produção, depois de pnpm build
pnpm typecheck  # TypeScript sem emissão
pnpm lint       # ESLint
pnpm test       # Vitest em modo run
```

## Dados e privacidade

O conteúdo fica em `WIKI_WORKSPACE_DIR` ou, por padrão, em `workspace/` na raiz do projeto. Essa
pasta inclui mundos, entidades, conteúdo, imagens, quadros, cenas e `trash/`; está explicitamente
ignorada pelo Git. Não publique nem versiona esse diretório sem uma política de privacidade própria.

O backup e a recuperação manual estão descritos em
[Backup e restauração](docs/data/backup-and-restore.md). O caminho pode ser alterado com um
`.env.local` privado:

```env
WIKI_WORKSPACE_DIR=C:\Dados\meus-codex
PERSISTENCE_DRIVER=filesystem
```

## Guias

- [Índice do guia de uso](docs/user-guide/index.md): mundos, calendário, entidades, editor, quadros, cenas e projeção.
- [Visão de arquitetura](docs/architecture/overview.md): camadas, fluxos e limites.
- [Armazenamento](docs/data/storage.md) e [migrações](docs/data/migrations.md): arquivos, esquemas e versões.
- [Referência HTTP e Server Actions](docs/reference/http-and-actions.md).
- [Desenvolvimento](docs/development.md), [testes](docs/testing.md) e
  [operação e privacidade](docs/operations-and-privacy.md).
- [ADRs](docs/architecture/): decisões históricas e estado atual.
- [Auditoria documental](docs/documentation-audit.md), [trabalho e lacunas](docs/work-items.md),
  [ideias de evolução](docs/ideas.md) e [registro de bugs](docs/bugs.md).
- [Relatório desta execução](docs/documentation-report.md).

## Arquitetura em uma frase

O App Router e as Server Actions orquestram a aplicação; componentes React cuidam da interface;
`domain/` define esquemas Zod e o cálculo do calendário sem I/O; contratos em `repositories/contracts/` isolam a persistência;
e a única implementação disponível é filesystem em `repositories/filesystem/`, selecionada por
`PERSISTENCE_DRIVER`.

Para manter essa fronteira, toda mudança de código, dados, APIs ou configuração deve avaliar e
atualizar a documentação afetada na mesma tarefa. Essa regra também está em
[`AGENTS.md`](AGENTS.md).
