# Visão de arquitetura

Esta página inclui as atualizações TL-10 e TL-11 verificadas em 14/10/2026. As justificativas de produto
ficam nos [ADRs](.) e não são repetidas aqui.

## Mapa do código

```text
src/app/                         entrada HTTP e navegação Next App Router
  (wiki)/                        biblioteca, calendário, catálogos e telas de edição/leitura
  actions/                       mutações de negócio via Server Actions
  api/                           upload, leitura de assets, busca e snapshots
src/components/                  UI client/server, Tiptap, tldraw e projeção
src/services/                    casos de uso: mundos, busca e referência de assets
src/domain/                      schemas Zod, tipos e formatos persistidos
src/repositories/contracts/      fronteiras de persistência
src/repositories/filesystem/    implementação JSON/filesystem
src/lib/fs/                      caminhos, existência e escrita atômica
src/lib/migrations/              aplicação lazy de versões
```

`domain/` não faz I/O. Componentes não devem conhecer nomes de arquivos. A factory em
`src/repositories/index.ts` mantém a escolha do driver em um único lugar. No estado atual existem
quatro contratos: `WorldRepository`, `AssetStore`, `BoardRepository` e `SceneRepository`.

## Leitura e gravação de entidade

```mermaid
flowchart LR
  U[rota ou componente] --> A[Server Action / Server Component]
  A --> W[getCurrentWorld]
  W --> C[cookie canon-codex-world]
  A --> R[WorldRepository]
  R --> D[resolveWorldDir pelo World.id]
  D --> M[metadata.json + content.json]
  M --> V[migração lazy + Zod]
  A --> UI[revalidatePath / redirect]
```

1. `getCurrentWorld()` lista mundos e lê `canon-codex-world`; se o cookie não apontar para um
   mundo existente, usa o primeiro da lista. A seleção não é autenticação.
2. `resolveWorldDir(worldId)` percorre os diretórios e compara o `id` dentro de `world.json`; o
   nome do diretório é um detalhe atual, normalmente o slug.
3. `FileSystemWorldRepository` lê `metadata.json` com `readMigratedJson`, aplica `entityMigrations`
   e valida `EntitySchema`. `content.json` segue o mesmo padrão com `contentMigrations` e
   `ContentDocumentSchema`.
4. Criar uma entidade valida `NewEntityInputSchema`, gera UUID, deriva slug, cria `metadata.json`
   e um `content.json` vazio. Atualizar valida `EntityPatchSchema`, preserva o UUID, recalcula o
   slug quando o título muda e grava a entidade.
5. `saveContent` valida o documento completo; relações validam `NewRelationInputSchema` e
   `RelationSchema`. Backlinks são calculados lendo todas as entidades e procurando relações cujo
   `targetId` seja o alvo.
6. A escrita JSON usa `atomicWriteJson` de `src/lib/fs/atomicWrite.ts`: serializa, escreve um
   temporário irmão e faz `rename` no mesmo volume. Se a serialização ou escrita falhar, o
   temporário é removido e o arquivo anterior não é substituído.

Propriedades declaradas como `kind: 'date'` são a exceção documentada ao antigo campo ISO: a action
e o editor usam `calendar-date.ts` para validar e persistir limites de calendário com a precisão
informada, enquanto o leitor e as páginas especiais compartilham o formatador. Strings ISO legadas
seguem aceitas durante a transição. O adaptador não usa `Date` para anos fictícios nem converte
strings ISO em salvamentos comuns. A tela `/calendar/migration` delega ao `WorldRepository` a prévia,
conversão, retomada e restauração; o adaptador filesystem mantém manifesto recuperável com os
metadados originais e substitui arquivos individualmente de forma atômica. O repositório ainda recusa
mudanças estruturais do calendário se encontrar campos de data preenchidos em registros ativos ou
na lixeira.

As operações de conversão e as gravações de entidades/calendário compartilham um lock local por
mundo. O manifesto de conversão é validado por schema na leitura; a confirmação compara um
fingerprint que inclui entidades, calendário e definições de tipos. Antes de concluir, o adaptador
confere o estado esperado dos arquivos convertidos.

Há uma verificação opcional de concorrência em `EntityPatch.expectedUpdatedAt`; se estiver
desatualizada, `ConcurrentModificationError` impede a gravação. As ações de UI atuais não enviam
esse campo, portanto não há resolução de conflito visual implementada.

O adaptador também reconcilia ausência definitiva de registros em consultas de linha e
Evento de origem, além da criação de uma origem (`entityLifecycle.ts`). Sob o lock, valida registros ativos, na lixeira e
documentos de linhas antes de limpar aparições em todas as linhas do mundo e o vínculo de origem.
Falhas de inventário interrompem a limpeza. As escritas são atômicas por arquivo, com retomada
idempotente; não há transação entre arquivos ou backup automático. O calendário não é deslocado.
Veja [ciclo de vida](../data/storage.md#reconciliação-de-registros-em-linhas-do-tempo-tl-10).

`getWorld` consulta somente os metadados do mundo e não inicia essa varredura, preservando a
busca global quando uma linha ou registro na lixeira está inválido. A criação de origem reconcilia
o vínculo antes de verificar se já existe um Evento, dispensando navegação intermediária.

Na UI, timelineCanvas.ts calcula coordenadas fixas para todas as aparições, em ordem cronológica.
TimelineCosmicCanvas separa SVG de pontos/conexões memoizado e cartões limitados ao viewport.
useTimelineCamera mantém a câmera em refs, pinta um transform por requestAnimationFrame e
notifica React somente ao cruzar faixas de visibilidade. Filtros são máscaras de IDs, sem alterar
coordenadas/câmera. Biblioteca e navegador têm listas de 50; o mapa não é paginado. A orientação
padrão é horizontal, com alternativa vertical. Distâncias não representam duração proporcional.
O editor único e os demais painéis são sobrepostos. Todos os dados continuam carregados.
Veja [guia](../user-guide/timelines.md) e [decisão visual](ADR-005-design-system.md).

## Fluxo de assets

`POST /api/assets` e as ações de capa/símbolo recebem um arquivo, validam um MIME de imagem
suportado e chamam `AssetStore.importFromBuffer`. O `FileSystemAssetStore`:

1. gera um UUID;
2. copia/grava o original em `assets/<assetId>/original.<ext>`;
3. usa `sharp` para descobrir dimensões e tentar criar `thumbnail.webp` de até 480 px;
4. grava `asset.json` validado.

A falha do binding nativo do `sharp` degrada a importação para `hasThumbnail: false`, mas o
original continua sendo salvo. A UI só guarda `assetId`; `assetVariantUrl` monta
`/api/assets/<assetId>/<variant>`, e o handler resolve o caminho via `AssetStore`. O acesso usa o
mundo ativo e não existe autenticação.

## Mundos e seleção ativa

`src/services/worlds/worldLibrary.ts` implementa criação, descoberta/importação, renomeação e
exclusão. O seed padrão é criado lazily por `worldDirRegistry` quando `workspace/worlds/` ainda não
existe. Criar um mundo gera slug único, mantém UUID e escreve `world.json`. Renomear muda somente o
nome exibido e `updatedAt`; o diretório/slug não muda. Importar copia uma pasta inteira, ajusta slug
em colisão de diretório, mas rejeita IDs de mundo já existentes ou repetidos na mesma importação.
`openTaldoreiWorldAction` usa o mesmo importador para copiar o pacote versionado em
`world-packs/taldorei-renascido-completo/` na primeira abertura; depois seleciona o UUID já importado.
`normalizeTaldoreiEvents` completa datas faltantes e reúne páginas de conteúdo dos eventos desse
pacote ao reabri-lo. A rotina mantém datas editadas pelo usuário e sincroniza aparições sem data nas
linhas do tempo; corrige apenas a estimativa antiga de 816 P.D. para o Conclave Croma.

As Server Actions selecionam o mundo por cookie HttpOnly `canon-codex-world`, SameSite `lax`,
caminho `/` e duração de um ano. Excluir o mundo ativo escolhe outro mundo disponível ou apaga o
cookie.

O mundo também carrega seu calendário em `world.json`. A rota `/calendar` lê o mundo ativo e o
componente client envia uma configuração JSON e o ID do mundo que abriu o formulário para
`updateCalendarAction`; a action valida o schema e confere se esse mundo ainda está ativo antes de
chamar `WorldRepository.updateCalendar` e revalidar a página. O módulo de domínio concentra cálculo
ordinal, duração de ano, regras intercalares e formatação, sem delegar anos fictícios a `Date`.

## Quadros, cenas e projeção

- Quadros são `BoardDocument` em `boards/<boardId>/board.json`. A página carrega todas as entidades
  como resumos; `InvestigationBoard` guarda o snapshot tldraw por `PUT /api/boards/<boardId>` e
  mantém uma cópia de sessão no `localStorage` do navegador. Imagens inseridas no quadro passam
  pelo mesmo `POST /api/assets`.
- Cenas são `Scene` em `scenes/<sceneId>/scene.json`. Uma cena referencia um local e um asset de
  fundo por UUID, valida a grade, salva snapshots por `PUT /api/scenes/<sceneId>` e pode ser
  duplicada mantendo essas referências e o snapshot. O `SceneRunner` oferece modos preparar,
  mestrar e apresentar.
- A projeção de cena não cria uma sessão no servidor. O mestre abre `/projection/<sessionId>` e os
  dois contextos se conectam ao mesmo `BroadcastChannel` do navegador. O mestre publica estado
  completo e atualizações incrementais; `buildProjectionState` remove tokens/POIs ocultos antes de
  enviar. A janela solicita estado completo se perder uma revisão.
- A projeção de uma entidade abre `/display/entity/<entityId>` em popup e renderiza a mesma tela de
  leitura em modo simples.

## Onde mudar cada coisa

| Mudança | Camada principal | Verificação documental/teste |
| --- | --- | --- |
| Campo persistido/invariante | `src/domain/` + repositório | schema, migração se necessário, round-trip e [modelo de dados](../data/storage.md) |
| Formulário ou layout | `src/components/` e rota correspondente | fluxo no [guia de uso](../user-guide/index.md) |
| Caso de uso de mundo | `src/services/worlds/` + action | testes de `worldLibrary` e guia de mundos |
| Busca | `src/services/search/` + handler | limites em [HTTP e actions](../reference/http-and-actions.md) |
| Persistência | contrato + `repositories/filesystem/` | migração, backup e testes de repositório |
| Upload/asset | `AssetStore`, handler e actions | MIME, thumbnail, privacidade e ADR-003 |
| Quadro/cena | contrato, domínio e componente tldraw | snapshot, exclusão lógica e guia de quadros/cenas |

Se a mudança atravessar uma dessas fronteiras, atualize também a página documental canônica na
mesma tarefa.
