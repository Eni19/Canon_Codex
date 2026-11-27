# Referência HTTP e Server Actions

> **Estado:** implementado · **Última verificação:** 26/11/2026, todas as rotas de `src/app/api/` e
> todas as actions exportadas de `src/app/actions/` têm seção aqui.

Estas são interfaces internas da aplicação. O SQLite é o driver padrão. Detalhes de caminhos e
escritas de arquivos nesta referência descrevem o driver legado. Elas usam o mundo ativo
selecionado pelo cookie canon-codex-world; não há autenticação, versionamento ou promessa de
compatibilidade para consumidores externos.

O contrato interno `WorldRepository.getTimeline/getOriginEvent/createOriginEvent` reconcilia referências
a registros definitivamente ausentes antes de retornar. Isso pode gravar `world.json` e
`timeline.json`, avançar `updatedAt` e fazer uma action com versão antiga rejeitar a alteração
até atualizar a página. Não há endpoint novo de descarte ou restauração. Erros de inventário
ou validação interrompem a limpeza; veja [armazenamento](../data/storage.md#reconciliação-de-registros-em-linhas-do-tempo-tl-10).

`getWorld` continua uma leitura de metadados, sem depender da integridade das linhas ou da lixeira.
A criação de origem faz a limpeza antes da verificação de unicidade.

A vista de linha usa scale, q, type repetido e view na URL. Sem view, a interface abre horizontal.
page=<inteiro positivo> legado localiza inicialmente o grupo correspondente de 50; o mapa atual
não tem páginas. Busca substitui a entrada do histórico; demais filtros criam uma entrada.
Pan e zoom espacial são estado local e não gravam URL, documentos ou payloads de actions.
Filtros não reiniciam a câmera; trocar orientação é uma mudança explícita de layout.

## Route Handlers

### Download do calendário

`GET /api/calendar-pdf?year=<ano>&worldId=<id>` responde com um PDF para download do ano
selecionado para o mundo ativo. Retorna 400 para ano inválido, 409 quando o ID diverge do mundo
ativo e 422 para anos com mais de 5.000 dias. O arquivo usa `Cache-Control: private, no-store`.

### POST /api/assets

Consumidores: src/components/editor/upload-image.ts, upload de mídia do quadro e o campo de imagem
do formulário de entidade (src/components/entities/entity-editor/image-field.tsx), que envia a capa
ou o símbolo antes de o registro existir. Recebe
multipart/form-data com campo file.

- 400 {"error":"No file provided"} quando o campo não é arquivo ou está vazio;
- 400 {"error":"Unsupported image type: <mime>"} para MIME não suportado;
- 200 {"assetId":"<uuid>"} após copiar o original e gravar metadados;
- MIME aceitos pelo domínio: image/png, image/jpeg, image/webp, image/gif, image/svg+xml e
  image/avif;
- não há limite de tamanho explícito neste handler. O limite 2mb em next.config.ts é para
  Server Actions, não foi aplicado no código deste Route Handler.

Exemplo seguro, sem arquivo real:

    POST /api/assets
    Content-Type: multipart/form-data
    file=<imagem sintética>

    200
    {"assetId":"00000000-0000-4000-8000-000000000001"}

### GET /api/assets/[assetId]/[variant]

Consumidores incluem `assetVariantUrl`, páginas de entidade, galerias, quadros, cenas e o
calendário. A rota aceita `original`, `thumbnail`, `calendar-mobile` e `calendar-desktop`.

- 400 Invalid variant se a variante não for reconhecida;
- 404 Not found se o asset não existir no mundo ativo, a variante não existir ou não houver
  thumbnail gerada;
- 200 com os bytes da imagem e `Content-Type` igual ao MIME informado pelo repositório.
  As variantes derivadas usam `image/webp`;
- resposta inclui Cache-Control: public, max-age=31536000, immutable.

O handler chama `AssetStore.getVariant(worldId, assetId, variant)` para obter os bytes e o MIME.
No SQLite, a consulta lê o BLOB da variante associado ao asset ativo no mundo selecionado. O
cookie do mundo seleciona o contexto.

### POST /api/calendar-background

Recebe `multipart/form-data` com `file` e `worldId`. Aceita PNG, JPEG, WebP, GIF e AVIF de até
8 MB e 40 milhões de pixels. Em sucesso, retorna `200 {"assetId":"<uuid>"}`.

- 400 para arquivo ausente, incompatível ou inválido, inclusive se exceder os limites do arquivo.
- 409 se `worldId` divergir do mundo ativo.
- 413 quando o `Content-Length` ultrapassa o limite de 8 MB mais a margem de 64 KiB para o multipart.
- 500 quando a importação ou a geração das variantes falha.

Uma chamada a `AssetStore.importFromBuffer` com a finalidade `calendar-background` importa o
original e gera as variantes responsivas de até 768 e 1600 px. No SQLite, a importação grava as
variantes e os metadados em uma transação.

### GET /api/entities/search

Consumidores: command palette, sugestão @ do editor e busca lateral de quadros.

A resposta usa `Cache-Control: no-store`. Cada consulta lê os registros ativos do mundo
selecionado e reflete criações, renomeações e exclusões já concluídas.

Ao trocar a consulta na busca geral, a interface cancela a requisição anterior.
Uma resposta ou falha atrasada dessa requisição é descartada.

Parâmetros opcionais:

- q: texto fuzzy; vazio retorna os primeiros itens;
- type: filtra pelo ID do tipo;
- limit: inteiro limitado entre 1 e 100; o padrão é 8.

Resposta 200:

    [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "type": "character",
        "typeLabel": "Personagem",
        "typeIcon": "UserRound",
        "title": "Personagem Exemplo",
        "aliases": ["Exemplo"],
        "tags": ["teste"]
      }
    ]

A busca carrega entidades do mundo em memória por chamada. Dentro do filtro de tipo, os títulos
iguais ao termo aparecem primeiro, ignorando maiúsculas, minúsculas e espaços nas extremidades.
Consultas de até três caracteres encontram trechos literais, inclusive no meio do nome. Termos
mais longos admitem aproximação: `Auorra` encontra `Aurora`, que também pode ser buscada por seu apelido cadastrado.
O Fuse.js ordena os demais resultados por relevância, com maior peso para títulos, depois apelidos
e tags. O limite considera primeiro os títulos exatos. Falhas de leitura do mundo/repositório são exceções do servidor; o handler
não define um envelope de erro próprio.

### GET /api/entities/[entityId]/summary

Não há consumidor local encontrado na auditoria. Sem corpo ou query string.

- 200 {"id":"<uuid>","title":"Personagem Exemplo","type":"character"};
- 404 Not found se o ID não existir no mundo ativo.

### PUT /api/boards/[boardId]

Consumidor: InvestigationBoard. Recebe JSON com a propriedade obrigatória snapshot, o canvas no
formato `canon-board-canvas` validado por `BoardCanvasSchema`
([formato](../data/migrations.md#canvas-do-quadro-snapshot-tldraw--canon-board-canvas-v1)).

    {
      "snapshot": {"format": "canon-board-canvas", "version": 1, "shapes": []}
    }

- 400 {"error":"Snapshot ausente"} se a propriedade estiver ausente;
- 400 {"error":"Canvas inválido"} se o snapshot não passar no schema; nada é gravado. Snapshots
  antigos do tldraw também são recusados: a conversão só acontece na leitura;
- 200 {"updatedAt":"2026-09-23T12:00:00.000Z"} após validação e escrita atômica;
- JSON inválido ou board inexistente não têm tratamento próprio no handler e dependem da resposta
  de erro do Next.js.

### PUT /api/scenes/[sceneId]

Consumidor: SceneRunner. Recebe JSON com snapshot opcional e grid opcional. O snapshot é o canvas
da cena no formato `canon-scene-canvas` e deve seguir `SceneCanvasSchema`
([formato](../data/migrations.md#canvas-da-cena-snapshot-tldraw--canon-scene-canvas-v1)); a grade
deve seguir SceneGridSchema:

    {
      "snapshot": {"format": "canon-scene-canvas", "version": 1, "shapes": []},
      "grid": {
        "enabled": true,
        "type": "square",
        "cellSize": 70,
        "offsetX": 0,
        "offsetY": 0,
        "opacity": 0.25,
        "snapTokens": false
      }
    }

cellSize fica entre 20 e 300; opacity entre 0 e 1. Respostas:

- 400 {"error":"Canvas ou grade inválidos"} se o snapshot ou a grade não passarem no schema; nada
  é gravado. Snapshots antigos do tldraw também são recusados: a conversão só acontece na leitura;
- 200 {"updatedAt":"..."} após validação e escrita;
- JSON inválido ou cena inexistente propagam erro do handler, sem envelope/status específico.

### GET /api/playlists

Consumidor: `SoundtrackBrowser` (`src/components/soundtrack/soundtrack-browser.tsx`), que busca a
lista com `cache: 'no-store'`. Sem corpo ou query string.

- 200 com um array de `PlaylistSummary`: os campos da playlist sem `tracks`, mais `trackCount` e
  `previewExternalIds` (IDs do YouTube das quatro primeiras faixas, usados na capa do cartão);
- a lista contém só playlists não excluídas do mundo ativo, da mais recente para a mais antiga por
  `updatedAt`; um mundo sem playlists retorna `[]`;
- falhas de leitura são exceções do servidor, sem envelope de erro próprio no handler.

Exemplo sintético:

    [
      {
        "schemaVersion": 1,
        "id": "00000000-0000-4000-8000-000000000001",
        "worldId": "mundo-exemplo",
        "title": "Trilha de exemplo",
        "tags": ["ambiente"],
        "createdAt": "2026-11-01T12:00:00.000Z",
        "updatedAt": "2026-11-01T12:00:00.000Z",
        "trackCount": 1,
        "previewExternalIds": ["xxxxxxxxxxx"]
      }
    ]

### GET /api/playlists/[playlistId]

Consumidor: `SoundtrackBrowser`, ao abrir uma playlist para tocar. Sem corpo ou query string.

- 200 com a `Playlist` completa (`PlaylistSchema` em `src/domain/playlists/playlist.ts`), incluindo
  `tracks` com `provider: "youtube"`, `externalId`, `title`, `author` opcional e `addedAt`;
- 404 {"error":"Playlist não encontrada"} se o ID não existir ou estiver excluído no mundo ativo.

As faixas guardam apenas o ID do vídeo e metadados; nenhum áudio é baixado.

## Server Actions por fluxo

### Mundos

openWorldAction valida o ID e grava o cookie antes de redirecionar para /codex.
createWorldAction cria com seed e abre o mundo. importWorldAction descobre/copia uma ou mais
pastas, rejeita inválidos/IDs duplicados e abre o primeiro importado. manageWorldAction renomeia
ou exclui logicamente; se o removido era ativo, seleciona outro ou limpa o cookie.
No driver legado em arquivos, `archiveIncompleteWorldAction` recebe o nome de uma pasta da biblioteca,
recusa a operação se `world.json` já estiver presente, move a pasta para `trash/worlds/` e atualiza `/`.
A seleção do mundo ativo permanece a mesma.

`updateCalendarAction` recebe o calendário serializado e o `worldId` do formulário de `/calendar`,
valida o calendário com `CalendarSchema` e confere se o ID corresponde ao mundo ainda ativo antes de
gravar via `WorldRepository.updateCalendar`. Em sucesso retorna
estado `saved`; em JSON inválido, mês não positivo, origem inválida ou outra falha de schema retorna
uma mensagem de erro para o formulário. Também rejeita o envio quando o mundo ativo mudou desde a
abertura do formulário ou quando uma alteração estrutural encontra campos de data preenchidos no
mundo, inclusive na lixeira. Não é uma API pública; o `worldId` enviado pelo navegador é conferido contra
o mundo selecionado pelo cookie ativo.

As seções de configuração do calendário têm uma action cada, todas com o mesmo contrato:
`(estadoAnterior, formData) → CalendarActionState`. O formulário envia `worldId`, o valor novo
serializado em JSON e o valor esperado (o que a página leu) para detectar edição concorrente.
A action valida com o schema da seção, confere o mundo ativo, grava pelo `WorldRepository` e
revalida `/calendar`. Erros voltam como mensagem para o formulário, sem exceção.

| Action | Campo com o valor novo | Valores esperados | Schema |
| --- | --- | --- | --- |
| `updateCampaignTodayAction` | `date` e `operation` (`set` ou `advance`) | `expectedToday`, `expectedCalendar` | `CalendarExactDateSchema` |
| `updateCalendarAppearanceAction` | `appearance` | `expectedAppearance` | `CalendarAppearanceSchema` |
| `updateCalendarLandmarksAction` | `landmarks` | `expectedLandmarks`, `expectedCalendar` | `CalendarLandmarksSchema` |
| `updateCalendarSeasonsAction` | `seasons` | `expectedSeasons`, `expectedCalendar` | `CalendarSeasonsSchema` |
| `updateCalendarMoonsAction` | `moons` | `expectedMoons`, `expectedCalendar` | `CalendarMoonsSchema` |

`updateCampaignTodayAction` recusa `advance` quando o Hoje da campanha mudou desde a leitura e
datas com ano além de ±1.000.000. Além de `/calendar`, ela revalida o layout raiz.

`startDateMigrationAction` confirma a prévia de `/calendar/migration` por fingerprint dos arquivos,
do calendário e das definições de tipos do mundo ativo. `recoverDateMigrationAction` retoma uma execução interrompida ou
restaura o backup pelo ID. Ambas delegam ao `WorldRepository`; erros de conflito são exibidos na
tela. A conversão não é executada na leitura normal.

`replaceOriginEventAction` exige `worldId` igual ao mundo ativo, ID de Evento, fingerprint da prévia
de `/calendar/origin` e confirmação explícita. O repositório recalcula a prévia sob bloqueio por
mundo e recusa dados modificados. A troca grava um backup de `world.json`, dos metadados e dos arquivos de aparições afetados,
desloca as datas e vincula o novo Evento. Uma falha durante a escrita dispara restauração; uma
operação interrompida é restaurada antes da próxima leitura ou gravação de metadados do mundo.

`addTimelineAppearanceAction` recebe mundo, linha, registro, apresentação, data opcional e token `updatedAt`.
Exige que o mundo enviado ainda seja o ativo; o repositório valida linha e registro ativos no mesmo
mundo, data conforme o calendário e token de concorrência antes de gravar `timeline.json`. Retorna
erro de formulário ou estado `saved` e revalida a página da linha.

`updateTimelineAppearanceAction` valida mundo ativo, ID da aparição, campos de apresentação e
token de concorrência antes de substituir somente os campos do cartão. `createTimelineEventAction`
exige título e data; o repositório cria o Evento e a aparição sob um bloqueio por mundo e desfaz
o registro novo se uma escrita lançar erro. Em sucesso retorna o ID para abrir o editor completo.

`addAllTimelineAppearancesAction` inclui apenas registros ativos ainda não representados; repetir
a ação sem novos registros não grava o arquivo. `removeTimelineAppearanceAction` remove uma aparição
por ID e devolve seus campos e posição para o botão **Desfazer**. `restoreTimelineAppearanceAction`
valida o mundo ativo, o registro e o token de concorrência antes de recolocar o mesmo ID. Nenhuma
dessas ações altera ou exclui o registro original.

`updateTimelineScaleDefaultsAction` recebe `worldId` e uma escala válida para cada tipo do mundo
ativo. O repositório valida o conjunto completo de tipos sob bloqueio, grava
`world.json.timelineScaleDefaults` atomicamente e revalida a interface. Detalhe cronológico, busca, categorias e
orientação dos cartões apenas mudam parâmetros da URL (`scale`, `q`, `type`, `view`) no navegador; não há
gravação de `timeline.json` nessas operações. `view=horizontal` usa a mesma seleção da vista
vertical; o mapa usa coordenadas cronológicas calculadas no cliente, sem distância proporcional.

### Entidades e conteúdo

Criação e edição usam o mesmo formulário (`EntityEditor`) e o mesmo parser
(`src/services/entities/parseEntityForm.ts`). As duas actions recebem `FormData` e devolvem
`{ error }` (`EntityFormState`) quando a entrada é inválida ou o repositório recusa a gravação; em
sucesso redirecionam para `/entity/<id>`. O cliente chama a action numa transição, sem `<form
action>`, para que o React não limpe os campos ao mostrar o erro.

`createEntityAction` resolve o tipo no mundo ativo, exige título e cria o registro já com todos os
campos: propriedades, editores estruturados, `coverAssetId`, `symbolAssetId` (cosmologia),
`coverFraming` (personagem, JSON validado por `CoverFramingSchema`), tema e conteúdo. Ao marcar um Evento como
origem, `createEntityAction` usa `createOriginEvent`; o repositório exige data exata de dia,
posiciona-a no ano zero e recusa uma segunda origem. `updateEntityAction`
converte campos de formulário e, para toda propriedade cujo tipo seja `kind: 'date'`, aceita o objeto
de calendário ou uma string ISO legada, validando precisão, existência de mês/dia e ordem do intervalo
antes de gravar. O editor envia valores novos como JSON e valores legados como ISO no campo oculto; a leitura usa o mesmo formatador
do domínio, inclusive na apresentação especial de Evento e Organização. Strings ISO antigas são
mantidas como strings quando o registro é salvo. Dados inválidos são devolvidos como `{ error }` e não
são gravados. Se houver content, a action passa as páginas Tiptap junto dos metadados para o repositório.
No SQLite, a operação salva ambos na mesma transação. Os campos `coverAssetId` e
`symbolAssetId` distinguem ausente (mantém), vazio (remove) e UUID (define); quando a imagem muda,
`updateEntityAction` apaga a anterior se nenhum registro a referencia.
`deleteEntityAction` move a pasta para a lixeira e redireciona ao catálogo.

### Assets e relações

Capa e símbolo não têm actions próprias: o arquivo vai para `POST /api/assets` e o ID segue no
formulário da entidade (ver acima). addRelationAction exige target e tipo e cria uma relação
direcional ou não; removeRelationAction remove pelo ID da relação.

`saveGraphSettingsAction` valida o mundo ativo, a versão, as posições, os filtros, os tipos de seta
com sentido padrão opcional, as anotações livres e as pastas. O repositório valida se cada registro
adicionado ou movido está ativo no mundo antes de gravar a vista, com revisão para detectar conflitos.
A ação retorna sucesso ou mensagem de erro.
Um reenvio de conteúdo já gravado é seguro. A ação não cria nem altera relações entre entidades.

`createGraphRelationAction`, `editGraphRelationAction` e `removeGraphRelationAction` operam no mesmo
repositório das fichas e revalidam origem, destino e grafo. A criação recebe UUID da solicitação e
reenvios idênticos não duplicam o vínculo. Alteração e remoção comparam a relação anterior para
evitar sobrescrever outra aba. A criação e a edição exigem registros ativos do mesmo mundo.
O campo opcional `bidirectional` habilita os dois sentidos de uma relação direcional. O vínculo
continua gravado na ficha de origem e a ficha de destino deriva a referência de entrada.

### Lixeira

As actions ficam em `src/app/actions/trash.ts`, exigem o SQLite (`getTrashRepository()`) e devolvem
`{ error?: string }` em vez de lançar. Todas revalidam `/` com `layout`, porque um item restaurado
volta aos catálogos.

- `restoreTrashItemAction(worldId, kind, id)` e `discardTrashItemAction(worldId, kind, id)` conferem
  que `worldId` é o Codex ativo; `kind` é `entity`, `board`, `scene` ou `playlist`. Item vencido
  ou fora da lixeira volta como o erro "Este item não está mais na lixeira.";
- `restoreWorldAction(worldId)` e `discardWorldAction(worldId)` agem sobre um Codex na lixeira da
  biblioteca. Restaurar troca o slug por um livre se outro Codex ativo o ocupou.

O prazo e a limpeza automática estão no [ADR-009](../architecture/ADR-009-trash-retention.md).

### Quadros e cenas

createBoardAction e createSceneAction validam os campos do formulário e redirecionam para o
recurso criado. A cena exige um asset de imagem com dimensões válidas. deleteBoardAction e
deleteSceneAction fazem exclusão lógica; duplicateSceneAction mantém referências e snapshot com
novo ID.

### Playlists

As actions ficam em `src/app/actions/playlists.ts` e operam no mundo ativo.

- `createPlaylistAction(formData)` lê `title`, `description` e `tags` (separadas por vírgula),
  cria a playlist e redireciona para `/soundtrack/<id>`;
- `updatePlaylistAction(playlistId, formData)` atualiza os mesmos campos e revalida a lista e a
  página da playlist;
- `deletePlaylistAction(playlistId)` faz exclusão lógica; ID inexistente lança `PlaylistNotFoundError`;
- `addVideosAction(playlistId, videoIds)` descarta IDs inválidos, limita a 300 por chamada, consulta
  os metadados no YouTube e retorna `{ added, duplicates, unavailable }`, em que `unavailable` conta
  vídeos privados, removidos ou sem incorporação;
- `removeTrackAction(playlistId, trackId)` remove uma faixa da playlist.
