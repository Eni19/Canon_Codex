# PROJECT.md: memória arquitetural do Canon Codex

> **Estado:** implementado · **Última verificação:** 27/11/2026, `package.json`,
> `src/repositories/index.ts` e `src/components/entities/entity-page.tsx`.

Este arquivo guarda as regras e decisões que orientam qualquer mudança no código. Ele não descreve
cada funcionalidade: o funcionamento de cada área está na [arquitetura](docs/architecture/overview.md)
e o uso, no [guia](docs/user-guide/index.md). Regras marcadas **[fixa]** só mudam com um ADR novo
que justifique a troca.

## Produto e fronteira

Canon Codex é uma wiki local, de uma pessoa só, para criar, organizar e apresentar universos
ficcionais e campanhas de RPG.

Autenticação, várias pessoas, colaboração remota, banco hospedado, armazenamento em nuvem e
publicação pública **não existem**. São visão de longo prazo (#22). Qualquer passo nessa direção
exige revisão de segurança, operação e documentação antes do código. Até lá, o app não deve ser
exposto fora de `localhost` ([operação e privacidade](docs/reference/operations-and-privacy.md)).

## Stack

- Next.js `16.3.4` com App Router, React `19.2.8` e TypeScript strict;
- Node.js `>=24.15.0` (24 LTS recomendado), com `node:sqlite` no servidor;
- pnpm, na versão declarada em `package.json`;
- Tailwind CSS v4, componentes locais no estilo shadcn/Radix e lucide-react;
- Zod para validar dados persistidos e entradas;
- Tiptap/ProseMirror para conteúdo rico, isolado por `ContentDocument` ([ADR-004](docs/architecture/ADR-004-editor.md));
- Fuse.js para busca local;
- Konva para os canvas de relacionamentos (`src/components/relations/relationship-scene.ts`), Cenas
  (`src/components/scenes/scene-stage.ts`) e Quadros (`src/components/boards/board-stage.ts`), com
  câmera e geometria comuns em `src/domain/canvas/` ([ADR-007](docs/architecture/ADR-007-konva-canvas.md));
- perfect-freehand para o traço do desenho livre dos Quadros (`src/components/boards/board-render-shapes.ts`);
- o pacote `tldraw` não é mais importado pelo código; continua instalado até a migração dos Quadros
  terminar (#17);
- sharp para dimensões, miniaturas e variantes de imagem (`src/repositories/assetImages.ts` e
  `src/app/api/calendar-background/route.ts`);
- pdf-lib para o PDF anual do calendário (`src/services/worlds/calendarPdf.ts`);
- animejs para animações das fichas e do editor de registros; sonner para avisos;
- Vitest para testes.

O Cache Components do Next.js não está habilitado em `next.config.ts`. Leituras acessam o
repositório a cada requisição; mutações usam Server Actions ou Route Handlers e revalidam as
rotas afetadas.

## Camadas

```text
src/app/            páginas (App Router), Server Actions e Route Handlers
src/components/     interface React
src/services/       casos de uso
src/domain/         schemas Zod e regras puras
src/repositories/   contratos e adaptadores SQLite e filesystem
src/lib/            caminhos, escrita atômica e registry de migrações
```

- `src/domain/` não faz I/O e não depende de repositórios nem do App Router.
- Componentes não importam `node:fs`, SQL nem montam caminhos do `workspace/`.
- Serviços de biblioteca e handlers têm I/O auxiliar de descoberta, cópia e importação; ampliar
  essa exceção pede justificativa ([arquitetura](docs/architecture/overview.md)).

## Persistência

**[fixa]** Telas, componentes e Server Actions dependem só dos contratos de repositório. A factory
em `src/repositories/index.ts` escolhe o driver e entrega cinco contratos: `WorldRepository`,
`AssetStore`, `BoardRepository`, `SceneRepository` e `PlaylistRepository`
([ADR-001](docs/architecture/ADR-001-local-first-storage.md)). No SQLite entrega também o
`TrashRepository`; no filesystem, `getTrashRepository()` devolve `null`.

- SQLite é o driver padrão ([ADR-006](docs/architecture/ADR-006-sqlite-storage.md)); o filesystem
  JSON continua para bibliotecas antigas com `PERSISTENCE_DRIVER=filesystem`.
- Toda referência entre mundos, registros, relações e assets usa UUID; slugs servem só à
  apresentação. Assets são referenciados por ID opaco, nunca por caminho
  ([ADR-003](docs/architecture/ADR-003-asset-identifiers.md)).
- Documentos são validados com Zod e versionados por `schemaVersion`; as versões atuais estão em
  [migrações](docs/data/migrations.md#versões-atuais).
- Escritas que afetam vários registros usam uma transação SQLite. No filesystem, cada arquivo é
  gravado por substituição atômica, sem transação entre arquivos.
- Excluir é exclusão lógica: `deleted_at` no SQLite, `trash/` no filesystem. No SQLite o item fica
  7 dias na lixeira, pode ser restaurado ou apagado de vez em `/trash` e, vencido o prazo, é apagado
  de forma definitiva na abertura do app ou na checagem de hora em hora
  ([ADR-009](docs/architecture/ADR-009-trash-retention.md)). O filesystem não tem prazo nem restauração.

Detalhes em [SQLite](docs/data/sqlite.md) e [armazenamento legado](docs/data/storage.md).

## Modelo de registros

- Um registro é uma entidade genérica (`src/domain/entities/entity.ts`) com `properties` livres,
  relações e conteúdo separado. O tipo (`EntityTypeDefinition`, no documento do mundo) declara
  propriedades, ícone, visibilidade e blocos de layout ([ADR-002](docs/architecture/ADR-002-entity-model.md)).
- A apresentação é **híbrida**: `src/components/entities/entity-page.tsx` usa páginas próprias para
  vários tipos (local, organização, personagem e outros) e o compositor genérico para o
  resto. A decisão entre manter assim ou voltar ao genérico está em aberto (#49).
- Relações ficam no array da entidade de origem; backlinks são derivados por varredura.
- Conteúdo é `ContentDocument.pages[]`, com o corpo Tiptap tratado como opaco pelo domínio.
- Cada mundo tem um calendário próprio, usado por todas as suas linhas do tempo. Os termos estão no
  [glossário](CONTEXT.md).

## Convenções de mudança

- **Domínio:** schema Zod, versão e migração quando a forma persistida muda, repositório e testes de
  round-trip e de erro, antes da UI.
- **Persistência:** preserve os contratos; documente esquema, migração, backup e rollback possível.
- **UI:** use os tokens de `src/app/globals.css`, sem cor solta
  ([ADR-005](docs/architecture/ADR-005-design-system.md)). Para escolher um item entre muitos, use
  `CardPicker` (`src/components/ui/card-picker.tsx`) em vez de `<select>`; campos `reference` e
  `referenceList` já usam `CardPickerField` e `CardPickerMultiField`
  ([detalhes](docs/architecture/overview.md#componentes-reutilizáveis)).
- **API, action ou configuração:** atualize a [referência](docs/reference/http-and-actions.md).
- **Nunca sem ADR:** persistir caminhos absolutos, remover `schemaVersion` ou tornar permanente uma
  exclusão lógica.
- **Documentação:** toda mudança avalia as páginas afetadas no mesmo PR
  ([como documentar](docs/contributing/documentation.md)); commits seguem
  [commits e branches](docs/contributing/commits.md).

## Testes

A suíte prioriza perda de dados: CRUD de registros, relações e backlinks, assets, quadros, cenas,
migrações, escrita atômica, biblioteca de mundos, projeções derivadas e schemas específicos. Não
há teste end-to-end nem contrato público de API. Detalhes em [testes](docs/contributing/testing.md).
