# Desenvolvimento

## Preparar o ambiente

Execute:

    pnpm install
    pnpm dev

O servidor de desenvolvimento fica em http://localhost:3000 por padrão. Use .env.local para
WIKI_WORKSPACE_DIR e PERSISTENCE_DRIVER; não use o workspace privado de outra pessoa em ensaios.
O cache local `.pnpm-store/` é ignorado pelo Git e não integra os arquivos da aplicação.
Pacotes locais em `world-packs/` também permanecem fora do versionamento.

Comandos do package.json:

| Comando | Finalidade |
| --- | --- |
| pnpm dev | Next.js em desenvolvimento |
| pnpm build | build de produção |
| pnpm start | servidor local de produção após build |
| pnpm typecheck | tsc --noEmit |
| pnpm lint | ESLint |
| pnpm test | vitest run |
| pnpm test:watch | Vitest interativo |
| pnpm docs:check | verifica links relativos, âncoras e caminhos `src/` citados entre crases nos arquivos Markdown |
| pnpm storage preview <origem> | prévia da importação de uma biblioteca JSON legada, sem gravar |
| pnpm storage import <origem> <novo-banco> | importa a biblioteca legada para um novo arquivo SQLite |
| pnpm storage backup <banco> <novo-backup> | copia o banco SQLite para um novo arquivo de backup |

## Organização do trabalho

Comece identificando a camada afetada:

- contrato e schema em src/domain/ e src/repositories/contracts/;
- regra de uso em src/services/ ou src/app/actions/;
- página e interação em src/app/ e src/components/;
- schema SQL e persistência em src/repositories/sqlite/; arquivos legados em src/repositories/filesystem/;
- upload e leitura HTTP em src/app/api/.

Componentes React não devem importar node:fs diretamente nem montar caminhos de workspace.
Mudanças devem usar a factory/contrato adequado. A regra atual é arquitetural, embora alguns
serviços de biblioteca e handlers tenham I/O auxiliar necessário: consulte
[visão de arquitetura](../architecture/overview.md) antes de ampliar essa exceção.

## Mudança de domínio

Para adicionar ou mudar um campo persistido:

1. atualize o schema Zod e a constante de versão se a forma persistida mudar;
2. escreva uma migração sequencial em src/repositories/filesystem/migrations.ts quando houver
   dados legados suportados;
3. atualize criação, leitura, patch e qualquer formulário;
4. adicione teste de registro atual, registro legado e falha de validação;
5. atualize [storage](../data/storage.md), [migrações](../data/migrations.md), guias e referência HTTP
   quando o contrato externo mudar.
6. rode `pnpm docs:check` para conferir links, âncoras e caminhos citados.

Para um novo tipo de entidade, uma definição genérica em world.json pode ser suficiente. Um
renderizador, editor ou regra específica exige código em components/entities, testes e atualização
do catálogo em docs/user-guide/entities.md.

## Mudança de persistência

Preserve os contratos. Mudanças de schema SQL devem acrescentar uma migração em
`src/repositories/sqlite/schema.ts`. Atualize [armazenamento SQLite](../data/sqlite.md) e verifique a
importação e o backup usando bancos temporários.

## Mudança de interface ou API

Ao alterar uma rota, ação, payload ou erro:

1. atualize o consumidor interno;
2. atualize docs/reference/http-and-actions.md;
3. confirme se o comportamento de seleção do mundo e os limites de erro continuam verdadeiros;
4. execute typecheck, lint e testes proporcionais.

## Regra documental

Toda mudança de código, dados, API, migração ou configuração deve avaliar o impacto em README,
PROJECT.md, ADRs e docs. Atualize as páginas afetadas na mesma tarefa. Se nenhuma página mudar,
registre explicitamente a justificativa no resumo da mudança.
