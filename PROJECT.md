# PROJECT.md — Wiki local-first de worldbuilding

Este documento registra a memória arquitetural e separa regras desejadas do comportamento que foi
verificado no código em **23/09/2026**. Decisões marcadas como **[fixas]** só devem mudar com
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

**Regra arquitetural [fixa]:** telas, componentes e Server Actions devem depender de contratos,
não conhecer o formato dos arquivos. **Estado atual:** a factory em `src/repositories/index.ts`
oferece quatro contratos:

- `WorldRepository`: mundos, calendários, entidades, conteúdo e relações;
- `AssetStore`: importação, resolução e exclusão lógica de imagens;
- `BoardRepository`: snapshots de quadros;
- `SceneRepository`: cenas, snapshots e grade.

A única implementação disponível é filesystem:
`FileSystemWorldRepository`, `FileSystemAssetStore`, `FileSystemBoardRepository` e
`FileSystemSceneRepository`, em `src/repositories/filesystem/`. `PERSISTENCE_DRIVER` só aceita
`filesystem` hoje; Postgres/S3 são possibilidades futuras, não implementações presentes.

O diretório padrão é `workspace/`, ou o caminho absoluto em `WIKI_WORKSPACE_DIR`. Ele contém dados
privados e está excluído por `.gitignore`; portanto não é atualmente versionável em Git, apesar de
essa possibilidade ter aparecido em documentação histórica.

IDs de mundo, entidade, relação e asset são UUIDs persistentes. Slugs e nomes de diretório são
detalhes de armazenamento: o diretório de mundo usa hoje o slug, e `resolveWorldDir` encontra o
slug lendo `world.json`. Nunca persistir path absoluto do sistema operacional em entidades.

As escritas JSON usam `src/lib/fs/atomicWrite.ts`, não `atomicWriteJson.ts`: o arquivo é escrito
em um temporário no mesmo diretório e renomeado. A validação Zod ocorre antes da gravação nas
operações de domínio; leituras de mundo, entidade, conteúdo e asset aplicam migração e schema.
Quadros e cenas leem e validam diretamente seus schemas atuais.

Exclusão de mundo, entidade, asset, quadro e cena é hoje um `rename` para `trash/`. Não há ação de
restauração nem descarte permanente implementada; a documentação não trata a lixeira como backup.

## Camadas e dependências

```text
src/app/                 App Router, páginas, Server Actions e Route Handlers
src/components/          UI, editores, catálogos, quadros, cenas e projeções
src/services/             casos de uso como biblioteca de mundos e busca
src/domain/               schemas/tipos Zod, sem responsabilidade de I/O
src/repositories/        contratos e implementação filesystem
src/lib/fs/               caminhos e escrita atômica
src/lib/migrations/       registry de migrações lazy
```

O domínio não importa repositórios nem App Router. A intenção é que a UI use os contratos; a
implementação atual ainda tem I/O auxiliar em `src/services/worlds/worldLibrary.ts`,
`src/repositories/filesystem/worldDirRegistry.ts`, `src/lib/fs/` e no handler que transmite o
asset, porque esses pontos realizam descoberta, cópia, rename ou streaming. Essa é uma observação
do estado atual, não autorização para espalhar I/O em novos componentes.

## Modelo de entidades e apresentação

O arquivo persistido usa uma entidade genérica (`src/domain/entities/entity.ts`) com
`properties: Record<string, unknown>`, relações e conteúdo separado. `EntityTypeDefinition` em
`world.json` declara propriedades, ícone, visibilidade e blocos de layout.
O mesmo `world.json` guarda `calendar`, validado por `src/domain/worlds/calendar.ts`: dias da
semana, meses com duração própria, horas por dia, eras, origem e regras intercalares.

A decisão histórica pretendia que todos os tipos fossem renderizados pelo mesmo compositor. O
estado atual é híbrido: o compositor usa os blocos declarados, mas `src/components/entities/
entity-page.tsx` seleciona páginas específicas para local, evidência, organização, criatura,
evento, artefato, cosmologia, conto, conceito, espécie e natureza/medicina; personagem também usa
uma composição de retrato. Os demais tipos usam o compositor genérico. Ver
[ADR-002](docs/architecture/ADR-002-entity-model.md).

Relações são armazenadas no array da entidade fonte; backlinks são derivados por varredura de
`targetId`. Conteúdo usa `ContentDocument.pages[]`, com `body` Tiptap tratado como opaco pelo
domínio. Ver [ADR-004](docs/architecture/ADR-004-editor.md).

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
