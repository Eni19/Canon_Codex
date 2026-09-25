# Auditoria documental e matriz de evidências

Auditoria realizada em **23/09/2026**, a partir do código, dos testes e da configuração presentes
neste repositório. A pasta `workspace/` não foi lida nem copiada: ela é dado privado e está
ignorada pelo Git.

## Inventário verificável

### Interfaces de página

| Rota | Fonte |
| --- | --- |
| `/` | `src/app/(wiki)/page.tsx` |
| `/codex` | `src/app/(wiki)/codex/page.tsx` |
| `/calendar` | `src/app/(wiki)/calendar/page.tsx` |
| `/all` | `src/app/(wiki)/all/page.tsx` |
| `/<entityType>` | `src/app/(wiki)/[entityType]/page.tsx` |
| `/<entityType>/new` | `src/app/(wiki)/[entityType]/new/page.tsx` |
| `/entity/<entityId>` | `src/app/(wiki)/entity/[entityId]/page.tsx` |
| `/entity/<entityId>/edit` | `src/app/(wiki)/entity/[entityId]/edit/page.tsx` |
| `/boards` | `src/app/(wiki)/boards/page.tsx` |
| `/boards/<boardId>` | `src/app/(wiki)/boards/[boardId]/page.tsx` |
| `/scenes` | `src/app/(wiki)/scenes/page.tsx` |
| `/scenes/<sceneId>` | `src/app/(wiki)/scenes/[sceneId]/page.tsx` |
| `/projection/<sessionId>` | `src/app/projection/[sessionId]/page.tsx` |
| `/display/entity/<entityId>` | `src/app/display/entity/[entityId]/page.tsx` |

`src/app/(wiki)/layout.tsx` envolve as páginas Wiki, lê o mundo ativo e monta o chrome da
aplicação. O grupo de rota não aparece na URL.

### Server Actions

| Fluxo | Funções | Fonte |
| --- | --- | --- |
| Biblioteca de Codex | `openWorldAction`, `createWorldAction`, `importWorldAction`, `manageWorldAction` | `src/app/actions/worlds.ts` |
| Calendário do mundo | `updateCalendarAction` | `src/app/actions/calendar.ts` |
| Entidades e conteúdo | `createEntityAction`, `updateEntityAction`, `deleteEntityAction` | `src/app/actions/entities.ts` |
| Imagens | `importCoverImageAction`, `importCosmologySymbolAction`, `removeCoverImageAction` | `src/app/actions/assets.ts` |
| Relações | `addRelationAction`, `removeRelationAction` | `src/app/actions/relations.ts` |
| Quadros | `createBoardAction`, `deleteBoardAction` | `src/app/actions/boards.ts` |
| Cenas | `createSceneAction`, `duplicateSceneAction`, `deleteSceneAction` | `src/app/actions/scenes.ts` |

### Route Handlers

| Método e rota | Fonte | Consumidor interno verificado |
| --- | --- | --- |
| `POST /api/assets` | `src/app/api/assets/route.ts` | editor, quadros e importação de imagens |
| `GET /api/assets/[assetId]/[variant]` | `src/app/api/assets/[assetId]/[variant]/route.ts` | `assetVariantUrl`, `next/image` desativado para esses assets e galerias |
| `GET /api/entities/search` | `src/app/api/entities/search/route.ts` | command palette, editor e busca de quadros |
| `GET /api/entities/[entityId]/summary` | `src/app/api/entities/[entityId]/summary/route.ts` | nenhum consumidor local encontrado na auditoria |
| `PUT /api/boards/[boardId]` | `src/app/api/boards/[boardId]/route.ts` | `InvestigationBoard` |
| `PUT /api/scenes/[sceneId]` | `src/app/api/scenes/[sceneId]/route.ts` | `SceneRunner` |

Essas rotas são interfaces internas da aplicação. Não há contrato de API pública, autenticação ou
política de compatibilidade versionada.

### Contratos e esquemas

| Área | Fonte |
| --- | --- |
| Mundos, entidades, conteúdo e relações | `src/repositories/contracts/worldRepository.ts` |
| Assets | `src/repositories/contracts/assetStore.ts` |
| Quadros | `src/repositories/contracts/boardRepository.ts` |
| Cenas | `src/repositories/contracts/sceneRepository.ts` |
| Mundo e tipos semeados | `src/domain/worlds/world.ts`, `src/domain/worlds/defaultWorldSeed.ts` |
| Entidade e definição de tipo | `src/domain/entities/entity.ts`, `src/domain/entities/entityType.ts` |
| Relações | `src/domain/relations/relation.ts` |
| Conteúdo | `src/domain/content/contentDocument.ts` |
| Assets | `src/domain/assets/asset.ts`, `src/domain/assets/mimeType.ts` |
| Quadros | `src/domain/boards/board.ts` |
| Cenas e grade | `src/domain/scenes/scene.ts` |
| Projeção | `src/domain/projection/projection.ts` |
| Dados específicos | `src/domain/entities/{locationPoint,evidenceFinding,organizationGroup,artifactDetail,conceptBlock}.ts` |

Versões atuais verificadas: `World` 17, `Entity` 4, `ContentDocument` 2, `Asset` 1, `Board` 1
e `Scene` 1. As fontes canônicas são os esquemas Zod, não esta tabela.

### Testes

Os testes incluídos por `vitest.config.mts` são `src/**/*.test.ts`:

- `src/services/worlds/worldLibrary.test.ts` — criação, renomeação, exclusão em `trash` e importação;
- `src/repositories/filesystem/fileSystemWorldRepository.test.ts` — entidades, conteúdo,
  relações, backlinks, concorrência e exclusão lógica;
- `src/repositories/filesystem/fileSystemAssetStore.test.ts` — imagens, thumbnails, tipos e `trash`;
- `src/repositories/filesystem/fileSystemBoardRepository.test.ts` — snapshots e exclusão;
- `src/repositories/filesystem/fileSystemSceneRepository.test.ts` — persistência e duplicação;
- `src/repositories/filesystem/migrations.test.ts` e `src/lib/migrations/registry.test.ts` — migrações;
- `src/domain/worlds/calendar.test.ts` — cálculo, validação e formatação de calendários;
- `src/lib/fs/atomicWrite.test.ts` — escrita atômica;
- `src/lib/projection/projection-state-builder.test.ts` — filtragem de dados ocultos na projeção;
- `src/services/assets/isAssetReferenced.test.ts` — referências de assets;
- `src/domain/entities/conceptBlock.test.ts` — blocos de conceito.

## Matriz de afirmações existentes

| Afirmação/documento | Fonte atual | Classificação | Ação/documento de destino |
| --- | --- | --- | --- |
| O app é uma wiki local para worldbuilding/RPG | `README.md`, rotas Wiki e `src/domain/` | correta | manter no `README.md` |
| Há múltiplos Codex, criação, importação, renomeação e exclusão | `src/services/worlds/worldLibrary.ts`, `src/app/actions/worlds.ts`, testes | correta, com exclusão em `trash` | detalhar em `docs/user-guide/worlds.md` e `docs/data/backup-and-restore.md` |
| Existem aproximadamente 13 tipos | ADR-002 | desatualizada | corrigir ADR-002; catálogo em `docs/user-guide/entities.md` |
| Não existem layouts/componentes próprios por tipo | ADR-002 e `PROJECT.md` | desatualizada | registrar a decisão histórica e o estado híbrido atual em ADR-002 e arquitetura |
| Conteúdo tem um único `body` | ADR-004 | desatualizada | documentar `pages[]` e migração v1→v2 em ADR-004 e `docs/data/migrations.md` |
| Só existem `WorldRepository` e `AssetStore` | ADR-001 e `PROJECT.md` | desatualizada | documentar também `BoardRepository` e `SceneRepository` |
| `workspace/` pode ser versionado em Git | `PROJECT.md` | contraditória com `.gitignore` | corrigir `PROJECT.md`, README e operações |
| A escrita fica em `src/lib/fs/atomicWriteJson.ts` | `PROJECT.md` e ADR-001 | caminho desatualizado | apontar para `src/lib/fs/atomicWrite.ts` |
| Todos os componentes e ações passam por contratos | `PROJECT.md`, `src/repositories/index.ts` | parcialmente correta | manter como regra arquitetural; registrar exceções de `worldLibrary` e handlers que usam filesystem auxiliar |
| Exclusão é sempre soft-delete e há ação separada permanente | `PROJECT.md` | parcialmente verificável | documentar que o código atual só expõe soft-delete; não há ação permanente/restauração |
| Assets são protegidos por cookie/autenticação | comentário em `next.config.ts` e ADR-003 | cookie verificado, autenticação não existente | qualificar em `docs/operations-and-privacy.md` e ADR-003 |
| Há banco relacional, migração SQL ou storage remoto | nenhum arquivo local | não verificável/não implementado | declarar ausência em `docs/data/storage.md` e `docs/operations-and-privacy.md` |
| Busca usa índice persistido | `src/services/search/searchEntities.ts` | desatualizada se inferida dos ADRs | documentar varredura em memória e Fuse.js |
| Backlinks são fonte persistida | `src/repositories/contracts/worldRepository.ts` e repositório filesystem | desatualizada se inferida de `PROJECT.md` | documentar como dado derivado em `docs/data/storage.md` |
| Há rastreador externo de trabalho | `.github/` ausente e nenhum tracker conectado | não verificado | criar `docs/work-items.md` somente com lacunas comprovadas |

## Rastreador e limites da auditoria

O repositório tem apenas o remoto Git `origin`; não há `.github/`, issue tracker conectado ou fonte
local de status além do histórico Git. O histórico não foi usado para inventar backlog. Decisões
pendentes e verificações ausentes ficam em [work-items.md](work-items.md).

As colunas e afirmações desta auditoria serão atualizadas ao final da implementação documental,
marcando os destinos resolvidos e as lacunas que dependem de decisão externa.

## Status final das ações

Resolvido nesta execução: índice e entrada do README; correções de PROJECT.md; notas de estado dos
ADRs 001–005; arquitetura; guias de uso; armazenamento e migrações; backup/importação/restauração;
referência HTTP/configuração; desenvolvimento/testes/operação; regra de manutenção no AGENTS.md.

Dependem de decisão externa ou implementação futura: política de restauração e purge, decisão sobre
apresentações específicas versus catálogo totalmente genérico, confirmação de
NEXT_PUBLIC_TLDRAW_LICENSE_KEY e qualquer operação fora de localhost. Esses itens estão
rastreados com evidência em [work-items.md](work-items.md).
