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
- tldraw para quadros e cenas;
- Konva para a cena do grafo de relações (`src/components/relations/relationship-scene.ts`);
- pdf-lib para o PDF anual do calendário (`src/services/worlds/calendarPdf.ts`);
- sharp para dimensões, miniaturas e variantes de imagem (`src/repositories/assetImages.ts` e
  `src/app/api/calendar-background/route.ts`);
- animejs para animações das fichas e do editor de entidades (`src/components/entities/`).

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
O calendário de cada mundo, a Linha do Tempo e o canvas de relacionamentos estão descritos em
[arquitetura](docs/architecture/overview.md).

A decisão histórica pretendia que todos os tipos fossem renderizados pelo mesmo compositor. O
estado atual é híbrido: o compositor usa os blocos declarados, mas `src/components/entities/
entity-page.tsx` seleciona páginas específicas para local, evidência, organização, criatura,
evento, artefato, cosmologia, conto, conceito, espécie, natureza/medicina e linha do tempo;
personagem também usa uma composição de retrato. Os demais tipos usam o compositor genérico. Ver
[ADR-002](docs/architecture/ADR-002-entity-model.md).

Relações são armazenadas no array da entidade fonte; backlinks são derivados por varredura de
`targetId`. Conteúdo usa `ContentDocument.pages[]`, com `body` Tiptap tratado como opaco pelo
domínio. Ver [ADR-004](docs/architecture/ADR-004-editor.md).

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
