# Armazenamento e modelo de dados

O Canon Codex atual não usa banco relacional, ORM, SQL ou storage remoto. A fonte da verdade é a
árvore de arquivos JSON e binários sob `WIKI_WORKSPACE_DIR`.

O diretório local `workspace/` é privado: permanece ignorado pelo Git e pela política de contexto da
IA registrada em `.aiignore` e `AGENTS.md`. Testes e exemplos usam dados sintéticos fora dele.

## Árvore persistida

```text
<WIKI_WORKSPACE_DIR>/
├── worlds/
│   └── <world-dir>/                  # hoje, o slug do mundo; não é a identidade
│       ├── world.json                # World + tipos + calendário + escalas da linha + origem?
│       ├── entities/
│       │   └── <entity-id>/          # UUID da entidade
│       │       ├── metadata.json     # Entity, inclusive relations[]
│       │       ├── content.json      # ContentDocument, páginas Tiptap
│       │       └── timeline.json     # apenas Linha do Tempo: aparições versionadas
│       ├── assets/
│       │   └── <asset-id>/           # UUID do asset
│       │       ├── asset.json
│       │       ├── original.<ext>
│       │       └── thumbnail.webp    # opcional, se sharp conseguir gerar
│       ├── boards/
│       │   └── <board-id>/board.json
│       ├── scenes/
│       │   └── <scene-id>/scene.json
│       ├── playlists/
│       │   └── <playlist-id>/playlist.json   # trilha sonora: só links do YouTube
│       ├── trash/                    # exclusões lógicas do mundo
│       ├── date-migrations/          # backups e estado das conversões explícitas
│       └── origin-backups/           # backups das trocas de Evento de origem
└── trash/
    └── worlds/<world-dir>-<timestamp> # mundo excluído da biblioteca
```

`src/lib/fs/paths.ts` também define `settings/app.json` e `indexes/`, mas a auditoria não encontrou
consumidor ativo que grave esses caminhos; eles não são parte necessária da recuperação atual.

### Calendário por mundo

`world.json.calendar` guarda a configuração do mundo usada pelas linhas do tempo. `originEventId`
opcional aponta para o único Evento escolhido como marco; a migração v17→v18 não inventa um
vínculo em mundos existentes. Ele guarda sete nomes de dias, o dia da
semana correspondente ao primeiro dia do ano zero, uma lista ordenada de meses (`name` e `length`), horas por dia, nomes das eras,
uma origem (`name`, mês e dia do ano zero) e regras intercalares repetíveis. Uma regra insere um dia
após o mês indicado ou como seu último dia (`extendsMonth`) em anos cujo ciclo corresponde a `everyYears`/`yearOffset`; `skipEveryYears` e
`includeEveryYears` permitem exceções. Meses e recorrências têm limites validados pelo schema, e
comprimentos não positivos são rejeitados.

Datas fictícias não usam `Date` do JavaScript. `src/domain/worlds/calendar.ts` calcula ordinais,
duração de ano, dias da semana e formatação para anos negativos, zero e positivos. A edição e a
leitura de propriedades `kind: 'date'` usam `src/domain/worlds/calendar-date.ts` e o calendário do
mundo ativo. A tela `/calendar` só salva quando o mundo ativo ainda é o mesmo que abriu o formulário,
usando `WorldRepository.updateCalendar`.

O contrato atual de um novo valor de data é:

```json
{
  "start": { "year": 0, "month": 1, "day": 1, "approximate": true },
  "end": { "year": 1, "month": 3 }
}
```

`start` é obrigatório; `end` opcional representa um fim ausente/duração aberta. Cada limite mantém
somente a precisão informada (`year`, `month` e `day` progressivos). O domínio rejeita lacunas de
precisão, mês/dia inexistente e intervalo invertido. Durante a transição, strings ISO legadas
`AAAA-MM-DD` também são aceitas na leitura e no editor e permanecem strings após um salvamento comum.
Alterações estruturais de meses e recorrências são recusadas se houver campos de
data ou aparições datadas, inclusive em registros na lixeira. Essa proteção evita deslocar datas até existir
remarcação ordinal das datas no calendário novo, ainda não implementada. A conversão explícita de
strings ISO do ticket 03 está em `/calendar/migration`, com backup em `date-migrations/`.
Substituir o Evento de origem em `/calendar/origin` desloca propriedades de data e datas de aparições
no mundo, inclusive na lixeira, e grava backup em `origin-backups/`. A posição da origem vinculada
não é editável pelo formulário comum do calendário.

`world.json.timelineScaleDefaults` guarda a escala mínima padrão por ID de tipo. A migração
v18→v19 cria os padrões iniciais: Evento em ano; Personagem, Local e Organização em mês; demais
tipos em dia. Salvar uma nova configuração atualiza somente o mundo. `minimumScale` de uma
aparição prevalece sobre o padrão do tipo.

### Aparições de Linha do Tempo

Cada entidade `timeline` nova recebe `timeline.json` com `schemaVersion: 2`, `worldId`, `timelineId`,
`updatedAt` e `appearances[]`. Cada aparição guarda UUID próprio, ID do registro original, título
e nota opcionais, data opcional no contrato `{ start, end? }`, escala mínima opcional e `showCover`.
O mesmo registro pode ter aparições distintas. Arquivos v1 são expandidos em memória e gravados em
v2 na próxima edição; linhas antigas sem arquivo são lidas como vazias. Escritas usam
bloqueio por mundo, token `updatedAt` para concorrência e arquivo atômico. Versões desconhecidas
falham explicitamente. O registro original mantém seus próprios metadados e conteúdo. A criação
rápida de Evento grava metadados, conteúdo vazio e aparição sob o bloqueio do mundo, desfazendo o
novo registro se a escrita lançar erro.
Remover uma aparição regrava somente `timeline.json`; o registro permanece. O Desfazer devolve o
mesmo ID e posição mediante token de concorrência, sem criar um segundo registro.

### Identidade e referências

- `World.id`, `Entity.id`, `Asset.id`, `Board.id`, `Scene.id` e `Relation.id` são UUIDs e devem ser
  tratados como identidade permanente.
- O diretório do mundo é resolvido a partir do `World.id` lendo os `world.json`; hoje seu nome é o
  slug. Renomear a UI não altera o slug nem o UUID.
- Diretórios de entidades, assets, quadros e cenas usam o próprio UUID.
- `Entity.slug` é derivado do título, apenas cosmético. Relações, links Tiptap e propriedades de
  referência guardam IDs.
- Uma cena guarda `background.locationId` e `background.assetId`; um quadro guarda IDs nas formas
  do snapshot tldraw. Esses alvos não são copiados ao duplicar uma cena ou um quadro.
- Backlinks, índices de busca e thumbnails são derivados. Backlinks e busca são reconstruídos em
  memória; uma thumbnail pode faltar sem remover o original.

## Registros e invariantes relevantes

Os schemas Zod em `src/domain/` são a referência canônica. As versões atuais são:

| Registro | Versão | Campos/invariantes importantes | Fonte |
| --- | ---: | --- | --- |
| `World` | 20 | UUID, slug/nome não vazios, `entityTypes[]`, `calendar`, `timelineScaleDefaults`, `originEventId?`, timestamps ISO | [`world.ts`](../../src/domain/worlds/world.ts) e [`calendar.ts`](../../src/domain/worlds/calendar.ts) |
| `Entity` | 4 | UUID, `worldId`, tipo/título/slug, aliases/tags, properties, relations, timestamps; capa/galeria referenciam UUIDs | [`entity.ts`](../../src/domain/entities/entity.ts) |
| `TimelineData` | 2 | IDs do mundo e da linha, timestamp e aparições com ID, referência, apresentação e data opcional; leitor migra v1 em memória | [`timeline.ts`](../../src/domain/timelines/timeline.ts) |
| `EntityTypeDefinition` | — | id, rótulos, ícone, propriedades, layout limitado a oito blocos e `showInSidebar` | [`entityType.ts`](../../src/domain/entities/entityType.ts) |
| `Relation` | — | UUIDs de source/target, tipo não vazio, label opcional, direcionalidade e metadata | [`relation.ts`](../../src/domain/relations/relation.ts) |
| `ContentDocument` | 2 | `format = tiptap-json`, 1–50 páginas; título de página até 40; body opaco | [`contentDocument.ts`](../../src/domain/content/contentDocument.ts) |
| `Asset` | 1 | UUID, MIME/nome/tamanho, dimensões positivas opcionais, `hasThumbnail` | [`asset.ts`](../../src/domain/assets/asset.ts) |
| `BoardDocument` | 1 | UUID, título, tags, snapshot nulo ou opaco, timestamps | [`board.ts`](../../src/domain/boards/board.ts) |
| `Playlist` | 1 | UUID, título, tags, faixas (provider `youtube`, id externo, título, autor), timestamps | [`playlist.ts`](../../src/domain/playlists/playlist.ts) |
| `Scene` | 1 | UUID, fundo com local/asset/dimensões, grade quadrada, snapshot, timestamps | [`scene.ts`](../../src/domain/scenes/scene.ts) |

Schemas auxiliares impõem limites de dados específicos: pontos de local até 30, descobertas por
ponto até 20, findings de evidência até 24, grupos de organização até 20 com 30 membros, detalhes
de artefato até 24 e blocos de conceito até 40. A propriedade `properties` da entidade é aberta
no schema geral; os campos estruturados desses tipos são validados pelas ações com
`LocationPointsSchema`, `EvidenceFindingsSchema`, `OrganizationGroupsSchema`, `ArtifactDetailsSchema`
e `ConceptBlocksSchema`.

Tipos com retrato (layout `portraitHero`, hoje Personagem) e Criatura podem ter
`properties.coverFraming` `{ x, y, scale }`, validado por `CoverFramingSchema`
([`coverFraming.ts`](../../src/domain/entities/coverFraming.ts)): `x`/`y` deslocam a imagem em
porcentagem da moldura (−100 a 100) e `scale` vai de 0,5 a 3, a partir do ponto em que cada página
ancora a imagem (`transform-origin`: topo central no Personagem; canto inferior direito no
Contorno e centro no Retrato da Criatura). A chave é opcional e só é gravada quando difere do
padrão do tipo (`defaultCoverFraming`): `{ x: 0, y: 0, scale: 1.4 }` no Personagem e
`{ x: 0, y: 0, scale: 1 }` na Criatura, que reproduzem a apresentação original; registros
antigos sem a chave não precisam de migração. Na Criatura o enquadramento é um só para os dois
modos de apresentação, e o modo Retrato recorta a imagem na moldura de foto. Trocar ou remover a
imagem no editor volta o enquadramento ao padrão.

## Leitura, escrita e inválidos

- Mundo, entidade, conteúdo e asset são lidos por `readMigratedJson`: JSON é parseado, migrações
  são aplicadas em memória e o schema Zod valida o resultado.
- Criar/atualizar entidade, salvar conteúdo, criar/salvar quadro e criar/salvar cena validam os
  dados antes de `atomicWriteJson`.
- Quadros e cenas não usam `readMigratedJson`; leem JSON atual e aplicam `BoardDocumentSchema` ou
  `SceneSchema` diretamente.
- Arquivo ausente de entidade ou asset resulta em `null`; conteúdo ausente de entidade recebe
  `emptyContentDocument()`. Um mundo ausente falha a resolução.
- JSON inválido, versão sem migração, schema incompatível ou erro de filesystem lança exceção. Os
  listadores usam `Promise.all`, portanto um registro inválido pode fazer a leitura da coleção
  falhar; não existe quarentena automática de registros inválidos.
- A aplicação não repara nem regrava automaticamente todos os arquivos após uma leitura migrada.
  A importação de mundos regrava o `world.json` copiado com o mundo já migrado e slug ajustado;
  migrações nas leituras normais são lazy e permanecem somente em memória. A reconciliação de
  ausência definitiva descrita abaixo é uma operação distinta e pode gravar durante consultas.

## Exclusão e ciclo de vida

Excluir entidade, asset, quadro ou cena move seu diretório para o `trash/` do mundo, com prefixo,
ID e timestamp. Excluir um mundo move sua pasta para `<workspace>/trash/worlds/`. Não há job de
retenção, restauração pela UI, descarte permanente ou backup automático. Não use `trash/` como
substituto de backup; cópia externa é necessária.

## Reconciliação de registros em linhas do tempo (TL-10)

Ao consultar `getTimeline` ou `getOriginEvent`, ou antes de `createOriginEvent`, o repositório reconcilia os registros
do mundo sob o lock de escrita. Um registro ativo consta em `entities/`; um registro na lixeira
consta em `trash/entity-<id>-<timestamp>/` e conserva metadados para título e categoria. A ausência
definitiva exige que o ID não esteja em nenhum desses inventários. Diretório de registro sem
metadados, JSON inválido e falhas de acesso interrompem a operação antes da limpeza. `getWorld`
não executa a reconciliação: a busca global continua independente da integridade das linhas e lixeira.

Na ausência definitiva, todas as aparições desse ID são retiradas dos `timeline.json` de linhas
ativas e na lixeira. Somente `originEventId` é limpo se apontar para esse ID; nome, posição do
marco e calendário completo permanecem. A limpeza atualiza `updatedAt` das linhas alteradas,
invalidando formulários antigos. Não altera versões de schema nem cria UI de descarte.

A reconciliação valida o inventário e os documentos antes das gravações. Cada arquivo é substituído
atomicamente; não existe transação entre arquivos nem backup automático dessa limpeza. Uma falha
durante as gravações pode deixar parte das linhas limpa; a próxima consulta retoma de forma
idempotente. Recuperar aparições já removidas exige um backup anterior à limpeza.

## Banco futuro

Quando um banco relacional for introduzido, a mesma mudança deverá atualizar esta referência com
entidades, chaves, índices, restrições, acesso/autorização, migrações, backup e rollback. Até lá,
qualquer documento que descreva SQL ou Postgres seria planejamento, não estado implementado.
