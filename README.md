# Canon Codex

Canon Codex é uma wiki local para criar, organizar e apresentar universos ficcionais e campanhas
de RPG. Cada mundo tem seus registros (personagens, locais, eventos e outros tipos), um calendário
próprio, linhas do tempo, um canvas de relacionamentos, quadros, cenas projetáveis e trilha sonora.

Tudo roda no seu computador: os dados ficam num banco SQLite local, sem conta, nuvem ou
publicação. Os limites dessa fronteira estão em
[operação e privacidade](docs/reference/operations-and-privacy.md).

## Instalar

Requisitos: Node.js `>=24.15.0` (24 LTS recomendado) e pnpm.

```bash
git clone https://github.com/Eni19/Canon_Codex.git
cd Canon_Codex
pnpm install
pnpm dev
```

Abra <http://localhost:3000>. Num banco novo, o app cria o mundo inicial `Canon Codex`. Daí em
diante, siga o [guia de uso](docs/user-guide/index.md).

No Windows, `Iniciar Canon Codex.cmd` faz o mesmo com um duplo clique: instala as dependências se
`node_modules/` não existir, roda `pnpm dev --port 3000` e abre o navegador quando a porta
responde. Se o servidor já estiver rodando, apenas abre o navegador. Fechar a janela encerra o
servidor.

## Onde ficam os dados

O banco padrão é `workspace/canon-codex.sqlite`. A pasta `workspace/` é privada e fica fora do
Git; trate o banco e seus backups como dados pessoais. Para usar outro lugar, crie um
`.env.local` a partir do `.env.example`:

```env
WIKI_WORKSPACE_DIR=C:\Dados\meus-codex
```

Todas as variáveis estão em [configuração](docs/reference/configuration.md).

**Tem uma biblioteca antiga em arquivos JSON?** A página inicial mostra um aviso de migração e
nada é apagado. Com o servidor parado e uma cópia da pasta feita, rode `pnpm storage preview` e
`pnpm storage import`, como descrito em [SQLite local](docs/data/sqlite.md).

## Comandos

```bash
pnpm dev        # desenvolvimento
pnpm build      # build de produção
pnpm start      # servidor de produção, depois do build
pnpm typecheck  # TypeScript sem emissão
pnpm lint       # ESLint
pnpm test       # Vitest
pnpm storage    # prévia, importação e backup do SQLite (pnpm storage --help)
pnpm docs:check # links, âncoras e caminhos citados na documentação
```

## Documentação

- [Guia de uso](docs/user-guide/index.md): o que o app faz e como usar cada parte.
- [Contribuir](CONTRIBUTING.md): do clone ao primeiro PR.
- [Índice da documentação](docs/README.md): todas as páginas, por pasta.
- [PROJECT.md](PROJECT.md): regras de arquitetura e convenções de mudança.
- [Glossário](CONTEXT.md): os termos do domínio.
- [Issues](https://github.com/Eni19/Canon_Codex/issues): trabalho em andamento, bugs e ideias.
