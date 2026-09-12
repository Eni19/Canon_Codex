# PROJECT.md — Wiki Local-First de Worldbuilding

Este documento é a memória arquitetural do projeto. Leia-o antes de fazer mudanças estruturais.
Decisões marcadas como **[fixas]** não devem ser revertidas sem justificativa explícita registrada
em um novo ADR (`docs/architecture/`).

## Visão do produto

Uma wiki pessoal local-first para criar e explorar universos fictícios: personagens, locais,
organizações, casos, eventos, documentos, evidências, pistas, criaturas, fenômenos, objetos,
conceitos e linhas do tempo. O primeiro mundo documentado é um universo de investigação e
paranormalidade, mas a arquitetura é genérica — novos tipos de entidade (Espécie, Religião,
Planeta, Magia, Deus, Reino...) devem ser adicionáveis via configuração de dados, não via mudanças
no código central.

Visão de longo prazo: múltiplos mundos, banco de dados hospedado, autenticação e multi-usuário,
colaboração, cloud storage, publicação pública seletiva — sem reescrever o domínio ou a UI.

## Stack **[fixa]**

- Next.js (App Router) + React + TypeScript strict. pnpm como gerenciador de pacotes.
- Tailwind CSS v4 + shadcn/ui (base Radix) + lucide-react.
- Tiptap/ProseMirror para o editor rich-text, isolado atrás de `domain/content/ContentDocument`.
- Zod para validação de todo dado persistido.
- Fuse.js para busca fuzzy local.
- Vitest para testes.
- **Cache Components do Next.js 16 (`cacheComponents: true`) está desligado deliberadamente.**
  Esta é uma ferramenta local-first, single-user, onde os dados mudam via mutação direta no
  filesystem e a UI deve sempre refletir o estado mais recente — o modelo de cache/PPR pensado
  para sites públicos de alto tráfego adicionaria complexidade (`Suspense` em toda leitura
  dinâmica, `use cache` em toda função) sem benefício aqui. Usamos o modelo "clássico": Server
  Components fazem leitura direta, Server Actions mutam e chamam `revalidatePath`/`redirect`.

## Arquitetura de persistência **[fixa]**

- **Local-first**: neste estágio não há banco de dados hospedado, autenticação ou storage externo.
  Tudo vive em `workspace/` no filesystem local, versionável em Git.
- Toda operação de leitura/escrita passa pelas interfaces em `src/repositories/contracts/`:
  `WorldRepository` e `AssetStore`. Nenhum componente React ou Server Action deve chamar `fs`
  diretamente — sempre através dessas interfaces, obtidas via factory (`getWorldRepository()`,
  `getAssetStore()`) que lê `PERSISTENCE_DRIVER` (hoje só `filesystem`).
- A implementação atual é `FileSystemWorldRepository`/`FileSystemAssetStore`
  (`src/repositories/filesystem/`). Futuras implementações (`PostgresWorldRepository`,
  `S3AssetStore`) implementam os mesmos contratos — ver `docs/architecture/ADR-001`.
- **IDs são a identidade permanente.** `Entity.id` e `Asset.id` são UUIDs que nunca mudam. Título,
  slug e nome de arquivo são metadados, não identidade. Links internos sempre referenciam
  `entityId`. Ver `docs/architecture/ADR-002` e `ADR-003`.
- **Nunca persistir paths absolutos do SO.** Assets são resolvidos só via `assetId` através do
  `AssetStore`, servidos por `/api/assets/[assetId]/[variant]`.
- Todo JSON persistido tem `schemaVersion`. Migrações vivem em `src/lib/migrations/` e são
  aplicadas de forma lazy na leitura.
- Escrita é sempre atômica (`src/lib/fs/atomicWriteJson.ts`: escreve `.tmp`, valida, `rename`).
- Exclusão é sempre soft-delete (move para `trash/`); exclusão permanente é uma ação separada.
- Dado derivado/reconstruível (índice de busca, thumbnails, backlinks calculados) nunca é fonte da
  verdade — pode ser apagado e reconstruído a partir das entidades sem perda de conteúdo.

## Estrutura de pastas

```
workspace/                     # dados do usuário (Git-friendly)
  worlds/<world-slug>/
    world.json                 # World + entityTypes
    entities/<id>/{metadata.json, content.json}
    assets/<id>/{asset.json, original.<ext>, thumbnail.webp}
    trash/
  settings/app.json
src/
  app/                         # rotas Next.js (App Router)
  components/{ui,wiki,entities,editor}/
  domain/{entities,relations,assets,content,worlds}/  # tipos + Zod schemas, sem I/O
  repositories/{contracts,filesystem}/                # persistência
  services/search/
  lib/{fs,migrations,ids}/
```

Regra: `domain/` não importa nada de `repositories/` ou `app/`. `repositories/filesystem/` é o
único lugar que importa `node:fs`. Componentes de UI não sabem que o storage é o filesystem.

## Modelo de entidade **[fixo]**

Uma única interface `Entity` genérica (não uma tabela por tipo). O comportamento por tipo
(propriedades, layout da página, ícone, cor) vem de `EntityTypeDefinition`, dado carregado do
`world.json`, não hardcoded em componentes. Ver `docs/architecture/ADR-002`.

Relações (`Relation`) são cidadãs de primeira classe, embutidas no array `entity.relations`, com
backlinks computados por varredura (dado derivado, cacheável no futuro sem mudar a API).

## Convenções de UI

- Design system com tokens semânticos em `src/app/globals.css` (`--background`, `--surface`,
  `--primary`, `--accent`, `--danger`, `--sidebar`, etc.) — nunca cor hex solta em componentes.
  Ver `docs/architecture/ADR-005`.
- `EntityPage` é uma composição de blocos (`header`, `hero`, `properties`, `content`, `gallery`,
  `relations`, `backlinks`) ativados pelo `EntityTypeDefinition.layout` — não crie um layout novo
  por tipo de entidade.
- Componentes pequenos e focados; lógica de domínio/filesystem nunca dentro de componentes React.

## O que a IA não deve alterar sem justificativa

- Trocar o modelo de cache do Next.js (habilitar `cacheComponents`) sem atualizar este documento e
  registrar um novo ADR.
- Modelar tipos de entidade como interfaces/tabelas hardcoded em vez de `EntityTypeDefinition`.
- Fazer componentes de UI ou Server Actions acessarem `node:fs` diretamente, pulando
  `WorldRepository`/`AssetStore`.
- Persistir paths absolutos do sistema operacional em qualquer entidade/asset.
- Remover `schemaVersion` de qualquer arquivo persistido ou pular a validação Zod na leitura.
- Trocar exclusão permanente por padrão (deve continuar sendo soft-delete via `trash/`).

## Testes

Vitest cobre os caminhos onde perda de dados seria grave: CRUD de entidade, relations/backlinks,
import de assets, migrações de schema, escrita atômica. Não é necessário testar trivialidades de
apresentação.
