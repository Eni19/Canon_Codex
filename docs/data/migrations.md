# Migrações e compatibilidade

As migrações de mundo, entidade, conteúdo e asset são aplicadas em memória na leitura pelo registry de
[`src/lib/migrations/registry.ts`](../../src/lib/migrations/registry.ts). O registry usa
`schemaVersion`; se o campo faltar, trata o registro como versão 1. Ele executa cada função
sequencialmente até `currentVersion` e depois passa o resultado pelo schema Zod.

Uma migração ausente, JSON ilegível, transformação que falha ou resultado que não passa no schema
interrompe a leitura. A leitura normal não grava de volta o resultado. A exceção documentada é o
importador de mundos, que copia a pasta e grava o `world.json` já migrado no destino.

## Linha do Tempo: v1 → v2

`timeline.json` usa o parser local `parseTimelineData` em
[`src/domain/timelines/timeline.ts`](../../src/domain/timelines/timeline.ts), fora do registry geral.
O leitor valida arquivos v1, acrescenta `title: null`, `note: null`, `minimumScale: null` e
`showCover: true` a cada aparição, e expõe o documento como v2 em memória. A leitura não regrava o
arquivo; a próxima inclusão ou edição persiste a versão 2. Versões desconhecidas falham. Uma linha
legada sem `timeline.json` é lida como vazia.

## Mundo: v1 → v21

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

Mundos v16 criados na `main` antes da integração podem não ter calendário. O passo v16→v17
acrescenta o calendário convencional quando ausente; os passos seguintes acrescentam os padrões
da linha do tempo. Mundos v19 também recebem a limpeza das referências no passo v19→v20.
Essa limpeza altera definições de campos, sem apagar valores dos metadados de entidades. O mesmo
vale para v20→v21: valores antigos de `profile` e `firstAppearance` continuam no `metadata.json`
do personagem até o registro ser salvo de novo; como o formulário só envia campos definidos no
tipo, salvar o personagem descarta esses valores.

O seed atual já é v21, define 17 tipos e inclui o calendário convencional (meses gregorianos,
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
Valores não representáveis, inclusive dias intercalares sem `mês/dia`, permanecem como strings para
revisão. A confirmação fica vinculada ao conteúdo atual dos arquivos, do calendário e das definições
de tipos do mundo. O manifesto possui versão e schema validados na leitura.

A conversão usa o ordinal da data ISO no calendário convencional inicial e encontra a posição
correspondente no calendário do mundo. Datas completas convertidas mantêm ordem e distância em dias;
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
