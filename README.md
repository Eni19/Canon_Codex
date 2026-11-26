# Canon Codex

Canon Codex é uma wiki local para criar, organizar e apresentar universos ficcionais. A aplicação
Next.js guarda a biblioteca em SQLite e oferece calendário por mundo, linhas do tempo em canvas
espacial, registros com editor de conteúdo, relações, busca, quadros e cenas projetáveis.

Esta documentação inclui o TL-12, com apresentação editorial, movimento discreto e navegação
acessível nas duas vistas de Linha do Tempo, verificado em **14/10/2026**. Autenticação,
colaboração remota, armazenamento em nuvem e publicação pública permanecem fora do escopo local.

## Começar

### Requisitos

- Node.js `>=24.15.0`, com a versão 24 LTS recomendada;
- pnpm, preferencialmente a versão declarada em `package.json` (`12.3.4`).

```bash
git clone https://github.com/Eni19/Canon_Codex.git
cd Canon_Codex
pnpm install
pnpm dev
```

Abra <http://localhost:3000>. Na primeira leitura, a aplicação cria um mundo semente chamado
`Canon Codex` quando a biblioteca SQLite é inicializada. Para configurar o local dos dados ou
importar uma biblioteca existente, veja [SQLite local](docs/data/sqlite.md).

### Já tem uma biblioteca em arquivos?

Desde a adoção do SQLite, uma biblioteca antiga (pastas de mundos em JSON no `workspace/`) não é
aberta automaticamente: a página inicial mostra um aviso de migração em vez dos mundos. Nada é
apagado. Com o servidor parado, faça uma cópia da pasta e rode:

```bash
pnpm storage preview <pasta-legada>
pnpm storage import <pasta-legada> <diretório-novo>/canon-codex.sqlite
```

Depois aponte `SQLITE_DATABASE_PATH` para o banco gerado. Para adiar a migração, defina
`PERSISTENCE_DRIVER=filesystem` em `.env.local` e o app volta a ler os arquivos. Detalhes em
[SQLite local](docs/data/sqlite.md).

### Comandos

```bash
pnpm dev        # desenvolvimento
pnpm build      # build de produção
pnpm start      # servidor local de produção, depois de pnpm build
pnpm typecheck  # TypeScript sem emissão
pnpm lint       # ESLint
pnpm test       # Vitest em modo run
```

## Dados e privacidade

Linhas com centenas de aparições usam páginas de até 50 cartões e editor sob demanda. O
[perfil com 500 aparições](docs/performance/timeline-500.md) registra medidas e verificações em
desktop e celular, com dados sintéticos.

Linhas do tempo preservam cartões de registros na lixeira com aviso de indisponibilidade.
Após ausência definitiva, a reconciliação remove suas aparições e limpa o vínculo de origem
sem alterar o calendário. Veja [Armazenamento SQLite](docs/data/sqlite.md).

O banco padrão é `workspace/canon-codex.sqlite`. Em um `.env.local` privado,
`WIKI_WORKSPACE_DIR` troca o diretório-base e `SQLITE_DATABASE_PATH` seleciona diretamente o
arquivo do banco. O diretório padrão `workspace/` é privado e está excluído pelo Git. Trate
também o banco, seus backups e sua origem legada como dados privados quando estiverem fora dele.

```env
WIKI_WORKSPACE_DIR=C:\Dados\meus-codex
```

Para abrir a biblioteca JSON legada, configure explicitamente `PERSISTENCE_DRIVER=filesystem`.
Consulte os procedimentos de importação e backup em [SQLite local](docs/data/sqlite.md) e o
procedimento de cópia da biblioteca em arquivos em [Backup e restauração do filesystem](docs/data/backup-and-restore.md).

## Guias

- [Biblioteca de mundos](docs/user-guide/worlds.md): criar, importar e arquivar pastas incompletas.

- [Canvas de relacionamentos](docs/user-guide/entities.md#referências-e-relações): área útil inteira, ferramentas contextuais, pastas no canto com navegação e movimentação por arraste, e salvamento automático por mundo. O [plano](docs/relationship-graph-plan.md) mantém a migração dos outros canvas condicionada à validação do grafo.
- [Validar com uma campanha real](docs/campaign-validation.md): roteiro do fluxo do mestre e onde registrar bugs e ideias.
- [Índice do guia de uso](docs/user-guide/index.md): mundos, calendário, entidades, editor, quadros, cenas e projeção.
- [Visão de arquitetura](docs/architecture/overview.md): camadas, fluxos e limites.
- [SQLite local](docs/data/sqlite.md): configuração, importação e backup.
- [Armazenamento legado](docs/data/storage.md) e [migrações](docs/data/migrations.md): arquivos, esquemas e versões.
- [Conversão de datas antigas](docs/data/migrations.md#datas-de-propriedades-durante-a-transição): prévia, backup e recuperação por mundo.
- [Referência HTTP e Server Actions](docs/reference/http-and-actions.md).
- [Desenvolvimento](docs/development.md), [testes](docs/testing.md) e
  [operação e privacidade](docs/operations-and-privacy.md).
- [ADRs](docs/architecture/): decisões históricas e estado atual.
- [Auditoria documental](docs/documentation-audit.md), [trabalho e lacunas](https://github.com/Eni19/Canon_Codex/issues),
  [ideias de evolução](https://github.com/Eni19/Canon_Codex/issues?q=is%3Aissue+is%3Aopen+label%3Abacklog) e [bugs abertos](https://github.com/Eni19/Canon_Codex/issues?q=is%3Aissue+is%3Aopen+label%3Abug).

## Arquitetura em uma frase

O App Router e as Server Actions orquestram a aplicação; componentes React cuidam da interface;
`domain/` define esquemas Zod e o cálculo do calendário sem I/O; contratos em `repositories/contracts/` isolam a persistência;
e `PERSISTENCE_DRIVER` seleciona o SQLite padrão em `repositories/sqlite/` ou o filesystem legado
em `repositories/filesystem/`.

Para manter essa fronteira, toda mudança de código, dados, APIs ou configuração deve avaliar e
atualizar a documentação afetada na mesma tarefa. Essa regra também está em
[`AGENTS.md`](AGENTS.md).
