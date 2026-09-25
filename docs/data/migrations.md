# Migrações e compatibilidade

As migrações são aplicadas em memória na leitura pelo registry de
[`src/lib/migrations/registry.ts`](../../src/lib/migrations/registry.ts). O registry usa
`schemaVersion`; se o campo faltar, trata o registro como versão 1. Ele executa cada função
sequencialmente até `currentVersion` e depois passa o resultado pelo schema Zod.

Uma migração ausente, JSON ilegível, transformação que falha ou resultado que não passa no schema
interrompe a leitura. A leitura normal não grava de volta o resultado. A exceção documentada é o
importador de mundos, que copia a pasta e grava o `world.json` já migrado no destino.

## Mundo: v1 → v17

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

O seed atual já é v17, define 17 tipos e inclui o calendário convencional (meses gregorianos,
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
formatadas pelo calendário do mundo e editáveis; ao salvar esse registro pela interface, o campo é
normalizado individualmente quando a data é representável.

Não há migração automática durante a leitura nem conversão em lote neste ticket. Prévia, lista de
inválidos, backup, confirmação e retomada/reversão pertencem ao ticket 03 planejado. Uma ISO que
corresponda a um dia intercalar sem representação `mês/dia` permanece como string legada identificada,
em vez de ser descartada.

## Conteúdo: v1 → v2

`contentMigrations` converte o formato antigo
`{ format: 'tiptap-json', schemaVersion: 1, body }` em versão 2, criando
`pages: [{ id: 'principal', title: 'Principal', body }]` e removendo o campo antigo. O documento
continua limitado a 1–50 páginas e o corpo continua opaco ao domínio.

## Assets, quadros e cenas

- `assetMigrations` tem `currentVersion: 1` e nenhum passo. `AssetSchema` valida a versão atual;
  não existe conversão de assets legados.
- Quadros usam `BOARD_SCHEMA_VERSION = 1`, e cenas usam `SCENE_SCHEMA_VERSION = 1`, mas seus
  repositórios leem diretamente com `readJsonFile` + schema. Eles ainda não estão conectados ao
  registry de migrações.
- Uma alteração futura de `BoardDocument` ou `Scene` precisa adicionar migração (ou registrar
  formalmente por que a compatibilidade não será mantida), testes de arquivos legados e atualização
  de [storage](storage.md) e [backup](backup-and-restore.md).

## Compatibilidade e rollback

Não há comando de downgrade, snapshot automático nem transação multi-arquivo. Uma migração aplicada
durante importação altera o `world.json` da cópia de destino, não a pasta de origem; por isso a
origem ou um backup anterior é o rollback disponível. Para qualquer ensaio, use um workspace
temporário e nunca o workspace pessoal.
