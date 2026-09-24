# ADR-002: Entidade genérica + EntityTypeDefinition configurável, em vez de tabelas por tipo

## Estado atual em 23/09/2026

O modelo persistido continua genérico e o mundo semente possui **17 tipos** em
`src/domain/worlds/defaultWorldSeed.ts`. A intenção de dirigir propriedades e blocos por
`EntityTypeDefinition` permanece válida para o caminho genérico. A implementação, porém, evoluiu
para um modelo híbrido: `src/components/entities/entity-page.tsx` seleciona renderizadores
específicos para vários tipos (`location`, `evidence`, `organization`, `creature`, `event`,
`artifact`, `cosmology`, `tale`, `concept`, `species` e `naturalScience`), e personagem usa um
layout de retrato. Portanto, a afirmação histórica de “nenhum componente específico” foi
revogada pelo código atual; a decisão original e sua motivação continuam registradas abaixo.

## Contexto

O primeiro mundo tinha aproximadamente 13 tipos de conteúdo (Personagem, Local, Organização, Caso,
Evento, Documento, Evidência, Pista, Criatura, Fenômeno, Objeto, Conceito, Timeline). O objetivo de longo
prazo é permitir tipos totalmente novos (Espécie, Religião, Planeta, Magia, Deus, Reino...) sem
alterar o código central — a aplicação deve virar uma ferramenta universal de worldbuilding, não
uma ferramenta de RPG de investigação com tipos fixos.

## Decisão

- Uma única interface `Entity` (`src/domain/entities/entity.ts`) representa qualquer elemento
  narrativo: `id`, `worldId`, `type`, `title`, `slug`, `aliases`, `tags`, `status`, `properties`
  (bag genérico), `relations`, `content` (via `content.json` separado), `schemaVersion`,
  timestamps.
- O comportamento específico de cada tipo vem de `EntityTypeDefinition` — dado carregado do
  `world.json` do mundo, não uma interface TypeScript por tipo. Cada definição declara:
  `properties: PropertyDefinition[]` (schema de campos: texto, número, data, boolean, enum, tags,
  referência, lista de referências, imagem, galeria) e `layout: PageBlockId[]` (quais blocos a
  `EntityPage` deve renderizar, em que ordem).
- Componentes de UI como `PropertyField`, `PropertyList` e o compositor genérico leem a
  `EntityTypeDefinition`. No estado atual também existem páginas de apresentação específicas para
  tipos que precisam de blueprint, dossiê, jornal, guia ou tratamento editorial. Um novo tipo pode
  usar o caminho genérico a partir de `world.json`, mas uma apresentação específica exige código.
- O mundo semente (`paranormal`) popula 17 tipos pré-configurados a partir de
  `defaultWorldSeed.ts`; essas definições são dados de mundo, embora o seed padrão esteja no
  código e não exista editor de tipos na interface.

## Alternativas consideradas

- **Uma interface TypeScript + tabela por tipo** (`Character`, `Location`, `Monster`...): mais
  segurança de tipo em compile-time, mas exige alterar código central para cada tipo novo —
  viola diretamente o requisito de extensibilidade do produto.
- **Schema totalmente dinâmico via banco de dados de metadados** (como um EAV completo): mais
  flexível ainda, mas overengineering para o MVP; o dado de tipo cabe inteiro em um `world.json`
  por mundo, sem precisar de um sistema de schema separado agora.

## Consequências

- `properties: Record<string, unknown>` não tem checagem de tipo em compile-time; a validação
  acontece em runtime via Zod, usando o schema declarado em `PropertyDefinition` no momento de
  salvar. Isso é aceitável porque o schema em si é dado do usuário (editável no futuro), não um
  contrato do código.
- Adicionar um tipo de entidade novo pode ser apenas uma operação de dado quando ele usa os
  campos/layout genéricos. Uma página ou regra específica por tipo também exige mudança de código,
  testes e documentação; esta é a diferença entre a intenção original e o estado atual.
- `slug` é derivado do título e recomputado quando o título muda; `id` é a única referência
  estável usada em `Relation.sourceId/targetId` e em links internos do editor.
