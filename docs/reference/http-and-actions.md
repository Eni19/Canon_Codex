# Referência HTTP e Server Actions

Estas são interfaces internas da aplicação, verificadas em 28/09/2026. Elas usam o mundo ativo
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

Consumidores: assetVariantUrl, páginas de entidade, galerias, quadros e cenas. variant deve ser
original ou thumbnail.

- 400 Invalid variant se a variante não for reconhecida;
- 404 Not found se o asset não existir no mundo ativo, a variante não existir ou não houver
  thumbnail gerada;
- 200 com bytes da imagem, Content-Type igual ao MIME original ou image/webp para thumbnail;
- resposta inclui Cache-Control: public, max-age=31536000, immutable.

O handler lê o asset pelo store e transmite o caminho resolvido; a URL não é um path de disco. O
cookie do mundo é apenas seleção de contexto, não controle de acesso.

### GET /api/entities/search

Consumidores: command palette, sugestão @ do editor e busca lateral de quadros.

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

A busca carrega entidades do mundo em memória por chamada e usa Fuse.js com peso maior para título,
depois aliases e tags. Falhas de leitura do mundo/repositório são exceções do servidor; o handler
não define um envelope de erro próprio.

### GET /api/entities/[entityId]/summary

Não há consumidor local encontrado na auditoria. Sem corpo ou query string.

- 200 {"id":"<uuid>","title":"Personagem Exemplo","type":"character"};
- 404 Not found se o ID não existir no mundo ativo.

### PUT /api/boards/[boardId]

Consumidor: InvestigationBoard. Recebe JSON com propriedade obrigatória snapshot; o valor pode ser
qualquer JSON, inclusive null se enviado explicitamente.

    {
      "snapshot": {
        "document": {
          "store": {}
        }
      }
    }

- 400 {"error":"Snapshot ausente"} se a propriedade estiver ausente;
- 200 {"updatedAt":"2026-09-23T12:00:00.000Z"} após validação e escrita atômica;
- JSON inválido, board inexistente ou erro de schema não têm tratamento próprio no handler e
  dependem da resposta de erro do Next.js.

### PUT /api/scenes/[sceneId]

Consumidor: SceneRunner. Recebe JSON com snapshot opcional e grid opcional. A grade deve seguir
SceneGridSchema:

    {
      "snapshot": {"document": {}},
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

cellSize fica entre 20 e 300; opacity entre 0 e 1. A resposta de sucesso é
200 {"updatedAt":"..."}. JSON inválido, cena inexistente ou grade inválida propagam erro do
handler, sem envelope/status específico implementado.

## Server Actions por fluxo

### Mundos

openWorldAction valida o ID e grava o cookie antes de redirecionar para /codex.
createWorldAction cria com seed e abre o mundo. importWorldAction descobre/copia uma ou mais
pastas, rejeita inválidos/IDs duplicados e abre o primeiro importado. manageWorldAction renomeia
ou move para trash/worlds/; se o removido era ativo, seleciona outro ou limpa o cookie.

`updateCalendarAction` recebe o calendário serializado e o `worldId` do formulário de `/calendar`,
valida o calendário com `CalendarSchema` e confere se o ID corresponde ao mundo ainda ativo antes de
gravar via `WorldRepository.updateCalendar`. Em sucesso retorna
estado `saved`; em JSON inválido, mês não positivo, origem inválida ou outra falha de schema retorna
uma mensagem de erro para o formulário. Também rejeita o envio quando o mundo ativo mudou desde a
abertura do formulário ou quando uma alteração estrutural encontra campos de data preenchidos no
mundo, inclusive na lixeira. Não é uma API pública; o `worldId` enviado pelo navegador é conferido contra
o mundo selecionado pelo cookie ativo.

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
são gravados. Se houver content, a action também salva as páginas Tiptap. Os campos `coverAssetId` e
`symbolAssetId` distinguem ausente (mantém), vazio (remove) e UUID (define); quando a imagem muda,
`updateEntityAction` apaga a anterior se nenhum registro a referencia.
`deleteEntityAction` move a pasta para a lixeira e redireciona ao catálogo.

### Assets e relações

Capa e símbolo não têm actions próprias: o arquivo vai para `POST /api/assets` e o ID segue no
formulário da entidade (ver acima). addRelationAction exige target e tipo e cria uma relação
direcional ou não; removeRelationAction remove pelo ID da relação.

### Quadros e cenas

createBoardAction e createSceneAction validam os campos do formulário e redirecionam para o
recurso criado. A cena exige um asset de imagem com dimensões válidas. deleteBoardAction e
deleteSceneAction fazem exclusão lógica; duplicateSceneAction mantém referências e snapshot com
novo ID.
