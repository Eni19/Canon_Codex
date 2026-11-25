# ADR-001: Armazenamento local-first atrás de interfaces de repositório

## Estado atual em 24/11/2026

O SQLite embarcado é o driver padrão. O adaptador filesystem mantém compatibilidade com
bibliotecas em arquivos ao selecionar `PERSISTENCE_DRIVER=filesystem`. O diretório padrão
`workspace/` contém dados privados e está excluído pelo Git. Veja
[ADR-006](ADR-006-sqlite-storage.md) e [SQLite local](../data/sqlite.md).

## Contexto

O MVP precisa rodar no computador do usuário, com dados sob controle local. As interfaces de
repositório mantêm domínio e UI independentes das escolhas de armazenamento. Postgres, object
storage, múltiplos usuários e colaboração seguem como possibilidades de evolução.

## Decisão

- Os cinco contratos em `src/repositories/contracts/` são `WorldRepository`, `AssetStore`,
  `BoardRepository`, `SceneRepository` e `PlaylistRepository`. Componentes, Server Actions e
  Route Handlers acessam a persistência pelas factories em `src/repositories/index.ts`.
- O adaptador SQLite usa `node:sqlite` e requer Node.js `>=24.15.0`, com a versão 24 LTS
  recomendada. O banco padrão é `workspace/canon-codex.sqlite`, ou
  `canon-codex.sqlite` dentro de `WIKI_WORKSPACE_DIR`. `SQLITE_DATABASE_PATH` pode definir
  diretamente o caminho do banco.
- O adaptador filesystem grava em `workspace/worlds/<world-slug>/` conforme o
  [modelo de dados legado](../data/storage.md). A mudança de driver preserva UUIDs e referências
  de domínio mediante importação explícita.
- O Route Handler de assets entrega os bytes e o MIME devolvidos pelo contrato. O adaptador
  SQLite guarda os binários como BLOBs. Veja [ADR-003](ADR-003-asset-identifiers.md).

## Alternativas consideradas na decisão original

- **JSON/filesystem** foi a implementação inicial pela facilidade de inspecionar e copiar uma
  biblioteca de arquivos. Permanece disponível como driver legado.
- **SQLite embarcado** já era considerado pela capacidade de consultar dados relacionados e
  proteger gravações com transações. O [ADR-006](ADR-006-sqlite-storage.md) registra sua adoção.
- **IndexedDB/localStorage** restringiria o controle da biblioteca a um perfil do navegador.
- **Banco hospedado** exigiria infraestrutura e acesso à rede para a operação da wiki.

## Consequências

O SQLite usa transações para mutações que envolvem vários registros. A reconciliação de
referências de Linha do Tempo e Evento de origem é um exemplo. O repositório também pode ler
metadados, conteúdo e revisão de artigos na mesma transação. No filesystem legado, o lock do
mundo serializa a reconciliação e cada documento é substituído atomicamente, com retomada
idempotente após uma interrupção. Veja [Ciclo de vida no filesystem](../data/storage.md#reconciliação-de-registros-em-linhas-do-tempo-tl-10).

A conversão de datas guarda histórico para recuperar os dados afetados. O procedimento de backup
da biblioteca completa depende do driver. Consulte [SQLite local](../data/sqlite.md) ou
[Backup do filesystem](../data/backup-and-restore.md).
