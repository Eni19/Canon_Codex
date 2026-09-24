# Referência HTTP e Server Actions

Estas são interfaces internas da aplicação, verificadas em 23/09/2026. Elas usam o mundo ativo
selecionado pelo cookie canon-codex-world; não há autenticação, versionamento ou promessa de
compatibilidade para consumidores externos.

## Route Handlers

### POST /api/assets

Consumidores: src/components/editor/upload-image.ts e upload de mídia do quadro. Recebe
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

`updateCalendarAction` recebe o calendário serializado pelo formulário de `/calendar`, valida-o com
`CalendarSchema` e grava-o no mundo ativo via `WorldRepository.updateCalendar`. Em sucesso retorna
estado `saved`; em JSON inválido, mês não positivo, origem inválida ou outra falha de schema retorna
uma mensagem de erro para o formulário. Não é uma API pública e não aceita um `worldId` enviado pelo
navegador: o mundo é selecionado pelo cookie ativo.

### Entidades e conteúdo

createEntityAction resolve o tipo no mundo ativo, exige título e cria o registro.
updateEntityAction converte campos de formulário, valida estruturas específicas por tipo, grava
metadados e, se houver content, salva as páginas Tiptap. deleteEntityAction move a pasta para a
lixeira e redireciona ao catálogo.

### Assets e relações

As ações de capa e símbolo validam arquivo, importam via AssetStore e removem o asset anterior
quando ele fica sem referências. addRelationAction exige target e tipo e cria uma relação
direcional ou não; removeRelationAction remove pelo ID da relação.

### Quadros e cenas

createBoardAction e createSceneAction validam os campos do formulário e redirecionam para o
recurso criado. A cena exige um asset de imagem com dimensões válidas. deleteBoardAction e
deleteSceneAction fazem exclusão lógica; duplicateSceneAction mantém referências e snapshot com
novo ID.
