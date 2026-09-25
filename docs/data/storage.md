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
│       ├── world.json                # World + EntityTypeDefinition[] + calendar
│       ├── entities/
│       │   └── <entity-id>/          # UUID da entidade
│       │       ├── metadata.json     # Entity, inclusive relations[]
│       │       └── content.json      # ContentDocument, páginas Tiptap
│       ├── assets/
│       │   └── <asset-id>/           # UUID do asset
│       │       ├── asset.json
│       │       ├── original.<ext>
│       │       └── thumbnail.webp    # opcional, se sharp conseguir gerar
│       ├── boards/
│       │   └── <board-id>/board.json
│       ├── scenes/
│       │   └── <scene-id>/scene.json
│       └── trash/                    # exclusões lógicas do mundo
└── trash/
    └── worlds/<world-dir>-<timestamp> # mundo excluído da biblioteca
```

`src/lib/fs/paths.ts` também define `settings/app.json` e `indexes/`, mas a auditoria não encontrou
consumidor ativo que grave esses caminhos; eles não são parte necessária da recuperação atual.

### Calendário por mundo

`world.json.calendar` guarda a configuração do mundo para as futuras linhas do tempo. A integração
das linhas com esse calendário ainda não foi implementada. Ele guarda sete nomes de dias, o dia da
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
`AAAA-MM-DD` também são aceitas na leitura e no editor; um salvamento individual as normaliza quando
o calendário consegue representá-las. Não existe conversão em lote silenciosa: prévia, relatório,
backup e confirmação continuam planejados para o ticket 03.

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
| `World` | 17 | UUID, slug/nome não vazios, `entityTypes[]`, `calendar`, timestamps ISO | [`world.ts`](../../src/domain/worlds/world.ts) e [`calendar.ts`](../../src/domain/worlds/calendar.ts) |
| `Entity` | 4 | UUID, `worldId`, tipo/título/slug, aliases/tags, properties, relations, timestamps; capa/galeria referenciam UUIDs | [`entity.ts`](../../src/domain/entities/entity.ts) |
| `EntityTypeDefinition` | — | id, rótulos, ícone, propriedades, layout limitado a oito blocos e `showInSidebar` | [`entityType.ts`](../../src/domain/entities/entityType.ts) |
| `Relation` | — | UUIDs de source/target, tipo não vazio, label opcional, direcionalidade e metadata | [`relation.ts`](../../src/domain/relations/relation.ts) |
| `ContentDocument` | 2 | `format = tiptap-json`, 1–50 páginas; título de página até 40; body opaco | [`contentDocument.ts`](../../src/domain/content/contentDocument.ts) |
| `Asset` | 1 | UUID, MIME/nome/tamanho, dimensões positivas opcionais, `hasThumbnail` | [`asset.ts`](../../src/domain/assets/asset.ts) |
| `BoardDocument` | 1 | UUID, título, tags, snapshot nulo ou opaco, timestamps | [`board.ts`](../../src/domain/boards/board.ts) |
| `Scene` | 1 | UUID, fundo com local/asset/dimensões, grade quadrada, snapshot, timestamps | [`scene.ts`](../../src/domain/scenes/scene.ts) |

Schemas auxiliares impõem limites de dados específicos: pontos de local até 30, descobertas por
ponto até 20, findings de evidência até 24, grupos de organização até 20 com 30 membros, detalhes
de artefato até 24 e blocos de conceito até 40. A propriedade `properties` da entidade é aberta
no schema geral; os campos estruturados desses tipos são validados pelas ações com
`LocationPointsSchema`, `EvidenceFindingsSchema`, `OrganizationGroupsSchema`, `ArtifactDetailsSchema`
e `ConceptBlocksSchema`.

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
  leituras normais são lazy e permanecem somente em memória.

## Exclusão e ciclo de vida

Excluir entidade, asset, quadro ou cena move seu diretório para o `trash/` do mundo, com prefixo,
ID e timestamp. Excluir um mundo move sua pasta para `<workspace>/trash/worlds/`. Não há job de
retenção, restauração pela UI, descarte permanente ou backup automático. Não use `trash/` como
substituto de backup; cópia externa é necessária.

## Banco futuro

Quando um banco relacional for introduzido, a mesma mudança deverá atualizar esta referência com
entidades, chaves, índices, restrições, acesso/autorização, migrações, backup e rollback. Até lá,
qualquer documento que descreva SQL ou Postgres seria planejamento, não estado implementado.
