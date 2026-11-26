# PROJECT.md — Wiki local-first de worldbuilding

Este documento registra a memória arquitetural e separa regras desejadas do comportamento que foi
implementado no código. A seção de persistência foi atualizada para o driver SQLite. Decisões marcadas como **[fixas]** só devem mudar com
justificativa explícita em novo ADR.

## Visão do produto

Canon Codex é uma wiki local para criar e explorar universos fictícios: personagens, locais,
organizações, casos, eventos, documentos, evidências, pistas, criaturas, fenômenos, objetos,
conceitos, cosmologia, espécies, natureza/medicina, contos e linhas do tempo. A aplicação é
single-user e local nesta versão.

Autenticação, multiusuário, colaboração remota, banco hospedado, cloud storage e publicação pública
são visão de longo prazo, não capacidades disponíveis. Qualquer mudança nessa fronteira exige
revisão de segurança, operação e documentação.

## Stack e execução

- Next.js `16.3.4` com App Router, React `19.2.8` e TypeScript strict;
- Node.js `>=24.15.0`, com a versão 24 LTS recomendada, e `node:sqlite` no servidor;
- pnpm declarado como `12.3.4` em `package.json`;
- Tailwind CSS v4, componentes locais inspirados em shadcn/Radix e lucide-react;
- Tiptap/ProseMirror para conteúdo rico, isolado por `ContentDocument`;
- Zod para validar dados persistidos e entradas de domínio;
- Fuse.js para busca fuzzy local;
- Vitest para testes;
- tldraw para quadros e cenas.

O Cache Components do Next.js não foi habilitado em `next.config.ts`. Leituras dinâmicas acessam
o repositório; mutações usam Server Actions ou Route Handlers e revalidam quando necessário.

## Persistência: regra e estado atual

**Regra arquitetural [fixa]**. Telas, componentes e Server Actions dependem dos contratos de
repositório. A factory em `src/repositories/index.ts` oferece cinco contratos.

- `WorldRepository` cobre mundos, calendários, entidades, conteúdo, relações e linhas do tempo.
- `AssetStore` importa, entrega e exclui logicamente imagens e variantes.
- `BoardRepository` gerencia quadros e snapshots.
- `SceneRepository` gerencia cenas, snapshots e grade.
- `PlaylistRepository` gerencia playlists locais.

SQLite é o driver padrão. O arquivo fica em `workspace/canon-codex.sqlite` ou no diretório
`WIKI_WORKSPACE_DIR`. `SQLITE_DATABASE_PATH` pode escolher diretamente o arquivo. O driver
`PERSISTENCE_DRIVER=filesystem` abre a biblioteca JSON legada. O diretório padrão `workspace/`
contém dados privados e está excluído pelo Git. Veja [SQLite local](docs/data/sqlite.md).

IDs de mundo, entidade, relação e asset são UUIDs persistentes. Slugs servem à organização e à
apresentação. O filesystem resolve o diretório do mundo a partir do ID de `world.json`. As
referências de domínio usam IDs.

O SQLite valida documentos do domínio com Zod e agrupa escritas que afetam vários registros em
transações. A exclusão lógica registra `deleted_at` e retém os dados. A leitura paginada de
artigos no repositório SQLite retorna metadados, conteúdo e uma revisão numérica em uma única
transação de leitura. Mudanças em metadados ou conteúdo incrementam essa revisão.

No filesystem legado, cada documento JSON é gravado em um temporário vizinho e renomeado por
`src/lib/fs/atomicWrite.ts`. Leituras de mundo, entidade, conteúdo e asset aplicam migrações de
documento e schemas. A exclusão lógica move os diretórios para `trash/`. Consulte
[Armazenamento legado](docs/data/storage.md).

## Camadas e dependências

```text
src/app/                 App Router, páginas, Server Actions e Route Handlers
src/components/          UI, editores, catálogos, quadros, cenas e projeções
src/services/             casos de uso como biblioteca de mundos e busca
src/domain/               schemas/tipos Zod, sem responsabilidade de I/O
src/repositories/        contratos e adaptadores SQLite e filesystem
src/lib/fs/               caminhos e escrita atômica
src/lib/migrations/       registry de migrações lazy
```

O domínio é independente de repositórios e do App Router. O armazenamento local fica nos
adaptadores, com I/O auxiliar de descoberta, cópia e importação para a biblioteca legada. A rota
de imagens usa os bytes e o MIME devolvidos por `AssetStore`.

## Modelo de entidades e apresentação

O modelo persistido usa uma entidade genérica (`src/domain/entities/entity.ts`) com
`properties: Record<string, unknown>`, relações e conteúdo separado. `EntityTypeDefinition` no
documento do mundo declara propriedades, ícone, visibilidade e blocos de layout.
O documento também guarda `calendar`, validado por `src/domain/worlds/calendar.ts`, com dias da
semana, meses com duração própria, horas por dia, eras, origem e regras intercalares.
A rota `/calendar` apresenta consultas mensais, anuais e uma agenda de Eventos no servidor, com
data na URL e janelas de até seis semanas para meses longos; dias intercalares independentes são
selecionáveis após o mês. A vista mensal apresenta marcos e estações da projeção e a anual os resume.
A agenda pagina os Eventos ativos que intersectam o mês, preservando datas
parciais, aproximadas e intervalos. A seção de luas salva até cinco configurações por mundo; a grade
mensal exibe seus discos, permite filtrá-los e o dia selecionado informa fases e percentuais iluminados.
A aparência oferece três temas, personalização e fundo local. O Hoje da campanha pode ser definido,
avançado e usado como sugestão na criação de Eventos e na linha do tempo.
O modelo de mundo também persiste estações, data de campanha, categorias e marcos, além da aparência;
a projeção de domínio combina esses dados em janelas limitadas. Luas, estações, marcos e aparência têm
formulários de configuração. Datas de Eventos e aparições podem identificar dias intercalares
independentes por ano e ID da regra; a troca de origem inclui as datas do mundo na prévia e no backup.
O campo opcional `originEventId` identifica um único Evento de origem. Criá-lo posiciona sua data
no ano zero. A troca exige prévia com fingerprint, desloca datas de propriedades por ordinal sob
transação SQLite e guarda o histórico das mudanças. No filesystem legado, a troca usa o lock do
mundo e restaura uma operação interrompida antes da próxima leitura ou gravação de metadados. Linhas do Tempo têm canvas espacial
com aparições datadas ou sem data armazenadas separadamente. Cartões têm título, nota, data,
escala mínima e opção de capa próprios. Biblioteca, inclusão em lote, remoção/Desfazer e Eventos
rápidos permanecem disponíveis. Filtros cronológicos/categorias/busca usam a URL; ampliação
espacial e posição da câmera são locais à página. O mapa inicial é horizontal, com opção vertical.
Propriedades com `kind: 'date'` usam o contrato `{ start, end? }` de
`src/domain/worlds/calendar-date.ts`, com precisão de ano/mês/dia e aproximação por limite. ISO
legado continua aceito na leitura e edição durante a transição; strings ISO permanecem intactas em
salvamentos comuns. A conversão explícita por mundo oferece prévia, relatório de inválidos, backup,
retomada e restauração em `/calendar/migration`. Mudanças estruturais do calendário continuam
bloqueadas enquanto houver propriedades, aparições datadas ou luas, pois remarcá-las para outra estrutura
ainda requer uma operação própria.

A rota `/calendar` usa a URL para conservar o período, o dia, a vista e o filtro lunar. O tema
Celeste aplica tons de azul-noturno e destaques dourados na capa, nas vistas internas e nos
formulários. A prévia de aparência reutiliza o componente de capa e os tokens da página. Os cinco
editores são carregados ao abrir suas seções. Consulte o [guia de mundos](docs/user-guide/worlds.md#configurar-o-calendário).
A Agenda usa `WorldRepository.listCalendarAgenda` para obter os Eventos ativos antes de projetar
o mês. A implementação em filesystem mantém uma projeção em memória conferida com os metadados
a cada consulta. Consulte [armazenamento legado](docs/data/storage.md#calendário-por-mundo).

O ciclo de vida das aparições distingue registros ativos, na lixeira e ausentes definitivamente.
Consultas de linha e origem, além da criação de origem, reconciliam referências no repositório. Cartões na lixeira mantêm
campos próprios e aviso de indisponibilidade; ausência definitiva remove todas as aparições nas
linhas ativas e na lixeira e limpa somente o vínculo de origem, preservando o calendário.
Erros de leitura impedem a limpeza. O SQLite grava a reconciliação em transação. O filesystem
legado faz escritas atômicas por arquivo com retomada idempotente. Veja [SQLite local](docs/data/sqlite.md)
e [ciclo de vida no filesystem](docs/data/storage.md#reconciliação-de-registros-em-linhas-do-tempo-tl-10).

O Cosmic Canvas (15/10/2026) substitui a paginação visual TL-11/TL-12 por coordenadas fixas para
a coleção inteira e cartões limitados ao viewport (teto 96; abaixo de 28%, visão geral por pontos).
As faixas cronológicas não codificam duração proporcional. Biblioteca e navegador mantêm listas
de 50; URLs antigas com page são interpretadas como localização inicial. Há um único editor modal.
Filtros alteram visibilidade sem mover a câmera nem reconstruir o layout; detalhes e demais
painéis ficam sobrepostos. Orientação e alterações reais de datas podem redistribuir coordenadas.

A câmera usa Pointer Events, wheel e requestAnimationFrame, sem nova dependência. SVG memoizado
mantém pontos/conexões; cartões são reutilizados. A câmera transforma o plano, único elemento
com will-change explícito. O fundo anima duas camadas de estrelas e uma névoa por CSS,
independentemente da câmera e sem interceptar ponteiros.
Três camadas separam estrelas, mapa e UI fixa. Tokens cósmicos centralizados aplicam preto profundo,
texto pergaminho/cinza quente e acento âmbar/latão do aplicativo, com fundo e superfícies
escurecidos apenas à linha/painéis, conforme a atualização do ADR-005.
CSS usa transições de 180 ms, controles de câmera 200 ms e movimento reduzido imediato.
Não há mudança de schema, persistência ou contratos das actions.
Referências, uso e limites: [pesquisa](docs/research/timeline-cosmic-canvas.md),
[guia](docs/user-guide/timelines.md) e [perfil](docs/performance/timeline-cosmic-canvas.md).

A decisão histórica pretendia que todos os tipos fossem renderizados pelo mesmo compositor. O
estado atual é híbrido: o compositor usa os blocos declarados, mas `src/components/entities/
entity-page.tsx` seleciona páginas específicas para local, evidência, organização, criatura,
evento, artefato, cosmologia, conto, conceito, espécie, natureza/medicina e linha do tempo;
personagem também usa uma composição de retrato. Os demais tipos usam o compositor genérico. Ver
[ADR-002](docs/architecture/ADR-002-entity-model.md).

Relações são armazenadas no array da entidade fonte; backlinks são derivados por varredura de
`targetId`. Conteúdo usa `ContentDocument.pages[]`, com `body` Tiptap tratado como opaco pelo
domínio. Ver [ADR-004](docs/architecture/ADR-004-editor.md).

## Relacionamentos

O grafo Konva usa a área útil da rota, com ferramentas e painéis HTML sobrepostos. A cena mantém a
câmera ao filtrar ou salvar; a vista salva posições, preferências, estilos, anotações e pastas por
mundo. Pastas no canto da tela agrupam registros de qualquer tipo. Abrir uma pasta mostra seus
cartões no canvas inteiro; arrastar um cartão até uma pasta move o registro para ela.
A busca esmaece itens enquanto o texto muda, e a vizinhança pode seguir ida, volta
ou ambos. O catálogo guarda tipos de seta reutilizáveis. Uma seta entre dois cartões abre o
formulário de um vínculo gravado na ficha de origem.
O [guia de entidades](docs/user-guide/entities.md) explica os fluxos. A migração de
Quadros, Cenas e Linha do Tempo depende das verificações do
[plano de relacionamentos](docs/relationship-graph-plan.md).

## Componentes de UI reutilizáveis

- **CardPicker** (`src/components/ui/card-picker.tsx`): seletor em modal com cartões quadrados
  (imagem por `assetId`, título, subtítulo, descrição) e busca por nome sem distinguir acentos.
  Use-o sempre que o usuário precisar escolher um item entre muitos, em vez de um `<select>`.
  `CardPickerField` é a versão para formulários (botão que abre o modal e envia o id por um
  `<input type="hidden">`). Exemplos: `ScenePicker` (trocar de cena) e o campo "Local" em
  `SceneCreateForm`.
  Todos os campos `reference` e `referenceList` das entidades usam `CardPickerField` /
  `CardPickerMultiField` (via `ReferenceField` / `ReferenceListField`). Uma propriedade
  `referenceList` com `optionsFrom: '<outra chave>'` só oferece itens já escolhidos nessa outra
  propriedade (ex.: líderes de uma organização saem dos membros); o estado compartilhado fica em
  `ReferenceSelectionProvider`.

## Convenções de mudança

- Mudanças de domínio: atualize o schema Zod, versão/migração quando necessário, repositório e
  testes de round-trip/erro antes de alterar a UI.
- Mudanças de persistência: preserve contratos, valide leitura e escrita e documente árvore,
  migração, backup e rollback possível.
- Mudanças de UI: componha a partir de tokens em `src/app/globals.css`; não introduza hex solto.
- Mudanças de API/Server Action/configuração: atualize a referência de interfaces e exemplos.
- Não persistir paths absolutos, remover `schemaVersion` ou transformar exclusão lógica em
  permanente sem ADR e atualização documental.

## Testes

O escopo atual prioriza perda de dados: CRUD de entidade, relações/backlinks, assets, quadros,
cenas, migrações, escrita atômica, biblioteca de mundos, dados derivados de projeção e schemas
específicos. Não há teste E2E ou contrato público de API verificado.
