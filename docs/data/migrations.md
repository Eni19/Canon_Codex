# Migrações e compatibilidade

> **Estado:** implementado · **Última verificação:** 26/11/2026, constantes de versão em
> `src/domain/` e registry em `src/repositories/filesystem/migrations.ts`.

Veja [SQLite](sqlite.md) para migrar a biblioteca. As versões documentadas aqui também são
validadas pelo importador. Os procedimentos que citam arquivos descrevem o driver legado.
No SQLite, a conversão de datas e a recuperação operam em transações, com histórico no banco.

As migrações de mundo, entidade, conteúdo e asset são aplicadas em memória na leitura pelo registry de
[`src/lib/migrations/registry.ts`](../../src/lib/migrations/registry.ts). O registry usa
`schemaVersion`; se o campo faltar, trata o registro como versão 1. Ele executa cada função
sequencialmente até `currentVersion` e depois passa o resultado pelo schema Zod.

Uma migração ausente, JSON ilegível, transformação que falha ou resultado que não passa no schema
interrompe a leitura. A leitura normal não grava de volta o resultado. A exceção documentada é o
importador de mundos, que copia a pasta e grava o `world.json` já migrado no destino.

## Versões atuais

Esta tabela é a fonte única das versões de schema citadas na documentação. Os outros documentos
linkam para cá em vez de repetir o número. Ao subir uma constante, atualize esta tabela no mesmo commit.

| Registro | Versão atual | Constante no código |
| --- | ---: | --- |
| `World` | 24 | `WORLD_SCHEMA_VERSION` em [`src/domain/worlds/world.ts`](../../src/domain/worlds/world.ts) |
| `Entity` | 4 | `ENTITY_SCHEMA_VERSION` em [`src/domain/entities/entity.ts`](../../src/domain/entities/entity.ts) |
| `ContentDocument` | 2 | `CONTENT_SCHEMA_VERSION` em [`src/domain/content/contentDocument.ts`](../../src/domain/content/contentDocument.ts) |
| Linha do tempo | 2 | `TIMELINE_SCHEMA_VERSION` em [`src/domain/timelines/timeline.ts`](../../src/domain/timelines/timeline.ts) |
| Grafo de relacionamentos | 4 | `schemaVersion: 4` em [`src/domain/relations/graphSettings.ts`](../../src/domain/relations/graphSettings.ts) |
| `Asset` | 1 | `ASSET_SCHEMA_VERSION` em [`src/domain/assets/asset.ts`](../../src/domain/assets/asset.ts) |
| `BoardDocument` | 1 | `BOARD_SCHEMA_VERSION` em [`src/domain/boards/board.ts`](../../src/domain/boards/board.ts) |
| `Scene` | 1 | `SCENE_SCHEMA_VERSION` em [`src/domain/scenes/scene.ts`](../../src/domain/scenes/scene.ts) |
| Canvas do quadro (`canvasSnapshot`) | 1 | `BOARD_CANVAS_VERSION` em [`src/domain/boards/boardCanvas.ts`](../../src/domain/boards/boardCanvas.ts) |
| Canvas da cena (`canvasSnapshot`) | 1 | `SCENE_CANVAS_VERSION` em [`src/domain/scenes/sceneCanvas.ts`](../../src/domain/scenes/sceneCanvas.ts) |
| `Playlist` | 1 | `PLAYLIST_SCHEMA_VERSION` em [`src/domain/playlists/playlist.ts`](../../src/domain/playlists/playlist.ts) |

## Linha do Tempo: v1 → v2

`timeline.json` usa o parser local `parseTimelineData` em
[`src/domain/timelines/timeline.ts`](../../src/domain/timelines/timeline.ts), fora do registry geral.
O leitor valida arquivos v1, acrescenta `title: null`, `note: null`, `minimumScale: null` e
`showCover: true` a cada aparição, e expõe o documento como v2 em memória. A leitura não regrava o
arquivo; a próxima inclusão ou edição persiste a versão 2. Versões desconhecidas falham. Uma linha
legada sem `timeline.json` é lida como vazia.

## Canvas da cena: snapshot tldraw → canon-scene-canvas v1

O campo `canvasSnapshot` da `Scene` continua opaco para o schema da cena, então
`SCENE_SCHEMA_VERSION` não muda. O conteúdo passou a ter formato próprio, lido por
`readSceneCanvas` em [`src/domain/scenes/sceneCanvas.ts`](../../src/domain/scenes/sceneCanvas.ts):

    {
      "format": "canon-scene-canvas",
      "version": 1,
      "shapes": [
        {"id": "shape:a", "kind": "poi", "x": 0, "y": 0, "rotation": 0, "w": 180, "h": 38,
         "poiId": "<uuid>", "visibility": "visible"},
        {"id": "shape:b", "kind": "token", "x": 0, "y": 0, "rotation": 0, "w": 180, "h": 280,
         "entityId": "<uuid>", "representation": "cutout", "visibility": "visible",
         "locked": false, "flipX": false}
      ],
      "legacyTldraw": {}
    }

- `shapes` está em ordem de desenho (o primeiro fica mais ao fundo). O fundo não é guardado: vem
  de `background` da cena. `x`/`y` são o canto superior esquerdo e a rotação (radianos) gira em
  torno desse ponto, a mesma convenção do tldraw.
- `null` é uma cena nova, sem formas.
- Um snapshot do tldraw (`{ document: { store } }`) é convertido em memória: entram as formas
  `scene-token` e `scene-poi`, ordenadas pelo índice do tldraw; `meta.flipX` vira `flipX`;
  valores ausentes recebem os padrões do editor; outros tipos são ignorados.
- A leitura não grava. O primeiro salvamento depois de uma alteração grava o formato novo, com o
  documento tldraw original intacto em `legacyTldraw`. Para voltar ao editor anterior, basta
  devolver `legacyTldraw` ao campo `canvasSnapshot`; perdem-se só as alterações feitas depois.
- Um canvas que não é legível (nem formato Canon nem snapshot tldraw) não abre o editor e não é
  sobrescrito. `PUT /api/scenes/<sceneId>` só aceita o formato novo.
- Builds anteriores a esta mudança não abrem cenas já gravadas no formato novo.

## Canvas do quadro: snapshot tldraw → canon-board-canvas v1

Mesmo esquema do canvas da cena: o `canvasSnapshot` do `BoardDocument` continua opaco para o schema
do quadro (`BOARD_SCHEMA_VERSION` não muda) e é lido por `readBoardCanvas` em
[`src/domain/boards/boardCanvas.ts`](../../src/domain/boards/boardCanvas.ts).

    {
      "format": "canon-board-canvas",
      "version": 1,
      "shapes": [
        {"id": "shape:a", "kind": "card", "x": 0, "y": 0, "rotation": 0, "opacity": 1, "locked": false,
         "w": 280, "h": 170, "entityId": "<uuid>", "viewMode": "card", "showImage": true,
         "showType": true, "showTags": true, "showStatus": true, "customLabel": ""},
        {"id": "shape:b", "kind": "arrow", "x": 0, "y": 0, "rotation": 0, "opacity": 1, "locked": false,
         "start": {"x": 0, "y": 0}, "end": {"x": 200, "y": 0}, "bend": 0, "color": "black",
         "labelColor": "black", "size": "m", "font": "draw", "dash": "draw", "arrowheadStart": "none",
         "arrowheadEnd": "arrow", "text": "", "labelPosition": 0.5, "scale": 1,
         "startBinding": {"shapeId": "shape:a", "anchor": {"x": 0.5, "y": 0.5}, "isPrecise": false, "isExact": false},
         "endBinding": null}
      ],
      "legacyTldraw": {}
    }

- `shapes` está em ordem de desenho. Tipos: `card` (cartão de registro), `text`, `arrow`,
  `note`, `geo` (20 formas geométricas), `draw` (pontos `[x, y, pressão]`), `line`, `image`
  (com o UUID do asset do Canon em `assetId`) e `legacy`. Cores, tamanhos, fontes, preenchimentos
  e traços usam os nomes do tldraw.
- Na conversão, os vínculos das setas (registros `binding` do tldraw) passam para dentro da seta
  (`startBinding`/`endBinding`); vínculos para formas que não existem são descartados. O
  `richText` de textos e rótulos vira texto simples, um parágrafo por linha: negrito, itálico e
  links se perdem.
- Notas, formas geométricas, linhas e imagens do tldraw são convertidas; a imagem usa o
  `meta.wikiAssetId` do registro `asset` correspondente. Desenhos livres (pontos codificados em
  base64 pelo tldraw), imagens sem asset do Canon e outros tipos viram `legacy`: o registro
  original fica intacto em `record` e o quadro mostra uma caixa tracejada no lugar.
- A leitura não grava. O primeiro salvamento depois de uma alteração grava o formato novo, com o
  documento tldraw original intacto em `legacyTldraw`. Para voltar ao editor anterior, basta
  devolver `legacyTldraw` ao campo `canvasSnapshot`; perdem-se só as alterações feitas depois.
- Um canvas ilegível não abre o editor e não é sobrescrito. `PUT /api/boards/<boardId>` só aceita
  o formato novo. Builds anteriores a esta mudança não abrem quadros já gravados no formato novo.

## Grafo de relacionamentos: v1/v2/v3 → v4

`relationship-graph.json` usa schema próprio na versão 4; sua ausência representa organização
automática, filtros, catálogo, anotações e pastas vazios, sem criar arquivo na leitura. As versões
1 a 3 são convertidas em memória e começam sem pastas: a versão 1 inicia com catálogo vazio
e as versões 1 e 2 iniciam sem setas livres. Revisão, posições, filtros, estilos e anotações existentes
são preservados; o próximo salvamento modificado grava a versão 4. O leitor aceita anotações v3
com ou sem IDs de cartões nas pontas e tipos com ou sem sentido padrão. Builds anteriores à v4
podem recusar o novo formato. Relações sem o campo opcional `bidirectional` mantêm a leitura
original de `directional`.

## Mundo: v1 → v24

Registry: `worldMigrations` em
[`src/repositories/filesystem/migrations.ts`](../../src/repositories/filesystem/migrations.ts).

| De | Para | Transformação principal |
| ---: | ---: | --- |
| 1 | 2 | adiciona `profile` a personagem quando ausente |
| 2 | 3 | adiciona `personality` a personagem |
| 3 | 4 | converte `personality` para textarea e adiciona `currentLocation` |
| 4 | 5 | oculta documento/pista da barra e adiciona campos de evidência |
| 5 | 6 | adiciona líderes, objetivos e ideais de organização |
| 6 | 7 | adiciona natureza e apresentação de imagem de criatura |
| 7 | 8 | oculta caso, corrige rótulo de fenômeno, amplia evento e troca `relatedCase` por `relatedEvent` |
| 8 | 9 | adiciona conto e cosmologia |
| 9 | 10 | completa e ordena propriedades de artefato |
| 10 | 11 | completa e ordena propriedades de cosmologia |
| 11 | 12 | transforma conto em registro literário atual, com campos de abertura e notas |
| 12 | 13 | normaliza propriedades de conceito para categoria e resumo |
| 13 | 14 | repete a normalização de conceito, removendo definições antigas de notação/paperStyle |
| 14 | 15 | oculta fenômeno e adiciona espécies e natureza/medicina |
| 15 | 16 | adiciona o calendário convencional por mundo quando o campo ainda não existe |
| 16 | 17 | faz o dia bissexto do calendário inicial ser 29/02, define a referência do dia da semana e preserva regras intercalares personalizadas |
| 17 | 18 | habilita o vínculo opcional `originEventId`; não atribui um Evento em mundos existentes |
| 18 | 19 | adiciona `timelineScaleDefaults` por tipo, sem alterar aparições ou datas |
| 19 | 20 | remove as definições `originLocation` de Personagem e `relatedLocations` de Evento; ordena membros antes dos líderes de Organização e restringe líderes com `optionsFrom: 'members'` |
| 20 | 21 | remove as definições `profile` (Perfil) e `firstAppearance` (Primeira aparição) de Personagem |
| 21 | 22 | adiciona `calendarMoons` vazio, preservando calendário e demais dados |
| 22 | 23 | adiciona estações e marcos vazios, Hoje em aberto e aparência padrão Codex, preservando o calendário e as luas |
| 23 | 24 | acrescenta sete definições opcionais às fichas, preservando definições com a mesma chave e os dados das entidades |

Mundos v16 criados na `main` antes da integração podem não ter calendário. O passo v16→v17
acrescenta o calendário convencional quando ausente; os passos seguintes acrescentam os padrões
da linha do tempo. Mundos v19 também recebem a limpeza das referências no passo v19→v20.
Ao editar uma ficha, propriedades antigas fora do formulário continuam nas chaves originais de metadata.json. Origem e local atual podem divergir. Perfil e primeira aparição também continuam disponíveis nos metadados após salvar. A matriz aprovada mantém os campos existentes e acrescenta sete opcionais, sem pares para consolidar.

A migração v23 → v24 acrescenta sete definições opcionais às fichas. Preserva definições com a mesma chave e os dados das entidades.

O seed atual já é v24, define 17 tipos, começa sem luas, estações ou marcos e inclui o calendário convencional (meses gregorianos,
24 horas, sete dias e regra bissexta). Migrações de mundo preservam definições customizadas
quando o código explicitamente procura uma propriedade existente, mas alterações manuais de
`world.json` continuam sujeitas ao `EntityTypeDefinitionSchema`.

## Entidade: v1 → v4

`entityMigrations` faz três passos:

- v1→v2: somente atualiza a versão;
- v2→v3: converte entidades `case` em `event`, mapeia status/data/envolvidos e troca
  `relatedCase` de evidência/pista por `relatedEvent`;
- v3→v4: converte tipos legados de blocos de conceito (`definition`, `note`, `rule`, `example`,
  `terms`, `formula`, `sketch`, `question`) para os tipos atuais de `ConceptBlocksSchema`.

Uma entidade legada convertida ainda precisa passar por `EntitySchema`. Não há migração automática
de referências externas, snapshots de quadros ou cenas quando uma entidade muda de tipo.

### Datas de propriedades durante a transição

O `EntitySchema` mantém `properties` aberto e não recebe uma nova versão para esta etapa. O contrato
de `kind: 'date'` é validado pela action e pelo domínio de calendário: o formato implementado é o
objeto `{ start, end? }` descrito em [storage](storage.md), com precisão por limite, aproximação e
validação contra o calendário do mundo. Strings ISO completas já persistidas continuam aceitas,
formatadas pelo calendário do mundo e editáveis; salvamentos comuns não as convertem.

A conversão explícita fica em `/calendar/migration`. Ela examina todos os campos `date` declarados
no mundo, inclusive tipos personalizados e entidades na lixeira; mostra exemplos e valores inválidos;
exige confirmação; e grava um backup dos metadados originais antes da primeira escrita. Cada arquivo
é substituído de forma atômica. Uma interrupção deixa um estado recuperável para retomar ou restaurar.
O manifesto do backup também guarda o relatório de exemplos e problemas da execução.
Valores não representáveis permanecem como strings para
revisão. A confirmação fica vinculada ao conteúdo atual dos arquivos, do calendário e das definições
de tipos do mundo. O manifesto possui versão e schema validados na leitura.

A conversão usa o ordinal da data ISO no calendário convencional inicial e encontra a posição
correspondente no calendário do mundo. Dias intercalares independentes são representados pelo ano e ID
da regra. Datas completas convertidas mantêm ordem e distância em dias;
uma segunda execução ignora os registros já convertidos.

Para executar:

1. Abra o mundo desejado, entre em **Calendário** e escolha **Prévia e conversão das datas antigas**.
2. Confira totais, exemplos antes/depois e a lista de valores para revisão. A prévia inclui a lixeira.
3. Marque a confirmação e escolha **Criar backup e converter**. Se os arquivos mudaram desde a
   prévia, recarregue a página e revise os novos resultados.
4. Se a operação falhar ou for interrompida, volte à mesma página e escolha **Retomar conversão**
   ou **Restaurar backup**. A restauração também fica disponível após uma conversão concluída.

O backup fica em `worlds/<world-dir>/date-migrations/<id>.json`, no mesmo armazenamento do mundo.
Ele contém os metadados originais dos arquivos alterados e o relatório da execução. A recuperação
recusa sobrescrever um registro editado posteriormente; resolva esse conflito antes de tentar de
novo. Para falha de disco ou perda do diretório do mundo, use um backup externo do workspace inteiro
conforme [Backup e restauração](backup-and-restore.md). Esta operação converte strings ISO completas;
ela não remarca datas já estruturadas após uma mudança de calendário nem libera alterações
estruturais enquanto houver datas preenchidas.

Durante a conversão, as gravações de metadados e calendário feitas pela aplicação esperam a
conclusão da operação. Antes de marcar o manifesto como concluído, o repositório verifica novamente
os arquivos, o calendário e as definições de tipos. Alterações diretas nos arquivos fora da
aplicação podem impedir a conclusão e exigir restauração seguida de nova prévia.

## Conteúdo: v1 → v2

`contentMigrations` converte o formato antigo
`{ format: 'tiptap-json', schemaVersion: 1, body }` em versão 2, criando
`pages: [{ id: 'principal', title: 'Principal', body }]` e removendo o campo antigo. O documento
continua limitado a 1–50 páginas e o corpo continua opaco ao domínio.

## Assets, quadros, cenas e playlists

- `assetMigrations` tem `currentVersion: 1` e nenhum passo. `AssetSchema` valida a versão atual;
  não existe conversão de assets legados.
- Quadros usam `BOARD_SCHEMA_VERSION = 1`, e cenas usam `SCENE_SCHEMA_VERSION = 1`, mas seus
  repositórios leem diretamente com `readJsonFile` + schema. Eles ainda não estão conectados ao
  registry de migrações. Playlists seguem o mesmo padrão com `PLAYLIST_SCHEMA_VERSION = 1`.
- Uma alteração futura de `BoardDocument` ou `Scene` precisa adicionar migração (ou registrar
  formalmente por que a compatibilidade não será mantida), testes de arquivos legados e atualização
  de [storage](storage.md) e [backup](backup-and-restore.md).

## Compatibilidade e rollback

Não há comando de downgrade, snapshot automático nem transação multi-arquivo. Uma migração aplicada
durante importação altera o `world.json` da cópia de destino, não a pasta de origem; por isso a
origem ou um backup anterior é o rollback disponível. Para qualquer ensaio, use um workspace
temporário e nunca o workspace pessoal.
