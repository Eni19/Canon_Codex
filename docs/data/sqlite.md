# Armazenamento em SQLite

> **Estado:** implementado · **Última verificação:** 26/11/2026, tabelas em
> `src/repositories/sqlite/schema.ts` e comandos `preview`, `import` e `backup` de
> `scripts/sqlite-storage.ts`.

SQLite é o driver padrão. Uma biblioteca usa um arquivo `canon-codex.sqlite`, que reúne os
mundos, registros, documentos, imagens, quadros, cenas, playlists, lixeira e históricos de conversão
e troca de origem. O servidor cria um mundo inicial na primeira abertura de uma biblioteca nova.
Se encontrar a árvore legada no caminho padrão, pede a migração explícita antes de inicializar.

O arquivo padrão fica dentro de `WIKI_WORKSPACE_DIR`. Para apontar para outro banco, defina
`SQLITE_DATABASE_PATH` em `.env.local` e reinicie. O aplicativo usa `node:sqlite`. Use Node 24 LTS
atualizado, com versão mínima 24.15.0.
Em sistemas que oferecem permissões POSIX, novos bancos e arquivos publicados pela CLI são criados
com leitura e gravação para o proprietário.

## Migrar uma biblioteca de arquivos

Pare o servidor que grava na origem e mantenha uma cópia privada do legado. Use caminhos explícitos.
O destino deve ser um **arquivo novo** em um diretório já existente, fora da pasta legada e em um
sistema de arquivos local com suporte a hard links. Os caminhos a seguir são ilustrativos.

```sh
pnpm storage preview /dados/codex-legado
pnpm storage import /dados/codex-legado /dados/codex-sqlite/canon-codex.sqlite
```

A prévia inventaria documentos e contabiliza alvos ausentes nas relações, aparições e origens,
além de origens que referenciam um registro de outro tipo. Os erros mostram o arquivo que precisa
de revisão, como um ID duplicado, um original ausente ou uma operação de calendário interrompida.
A importação valida um banco temporário antes de publicar o destino. A origem permanece disponível para inspeção e para
operar com `PERSISTENCE_DRIVER=filesystem`. A biblioteca antiga contém o estado até a migração.
Edições posteriores existem apenas no SQLite. **Carregar pasta** continua disponível na interface
para adicionar um ou mais mundos ativos do formato antigo.

Para ativar o banco importado, use estas variáveis em `.env.local`.

```dotenv
PERSISTENCE_DRIVER=sqlite
SQLITE_DATABASE_PATH=/dados/codex-sqlite/canon-codex.sqlite
```

## Backup e restauração

```sh
pnpm storage backup /dados/codex-sqlite/canon-codex.sqlite /backups/canon-codex.sqlite
```

O comando abre a origem somente para leitura, cria um snapshot consistente com a API de backup
do SQLite e verifica integridade e chaves estrangeiras. O destino deve ser novo e atender às mesmas
condições de publicação da importação. Para restaurar, preserve o backup original, gere outra cópia
com o mesmo comando e aponte `SQLITE_DATABASE_PATH` para essa cópia. Abra a biblioteca e confira
mundos, imagens e documentos. Para mover a biblioteca inteira a outra instalação, use o backup.
O aplicativo ainda não oferece exportação de um mundo isolado em formato legado.

## Schema e leitura de artigos

O schema SQL tem versão própria, separada de `schemaVersion` dos documentos. Mundos e registros
preservam seus IDs. Relações e aparições ficam em tabelas com escopo de mundo e ordem explícita.
O SQLite conserva os JSONs de calendário, campos personalizados, documentos Tiptap, o canvas
dos quadros e das cenas. Imagens e variantes são BLOBs separados dos metadados.

Operações compostas usam uma transação SQLite. A lixeira é representada por exclusão lógica.
A remoção de um registro da lista ativa preserva suas aparições enquanto o registro existir na lixeira.
A conversão de datas legadas preserva sua prévia e permite restaurar o estado anterior quando os
registros convertidos continuam compatíveis com o backup.

A leitura interna `SqliteWorldRepository.listArticleSources` entrega metadados, conteúdo e revisão
numérica por mundo ativo, com cursor por UUID e limite por página. A revisão muda com gravações de
metadados e conteúdo. Isso prepara a indexação incremental descrita no
[ADR-006](../architecture/ADR-006-sqlite-storage.md). A indexação semântica e o chat são planejados.
