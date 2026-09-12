# ADR-002: Entidade genérica + EntityTypeDefinition configurável, em vez de tabelas por tipo

## Contexto

O primeiro mundo tem ~13 tipos de conteúdo (Personagem, Local, Organização, Caso, Evento,
Documento, Evidência, Pista, Criatura, Fenômeno, Objeto, Conceito, Timeline). O objetivo de longo
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
- Componentes de UI (`PropertyField`, `PropertyList`, `EntityPage`) são genéricos: leem a
  `EntityTypeDefinition` do tipo da entidade e se adaptam. Nenhum `switch (entity.type)` com JSX
  distinto por tipo em componentes de apresentação.
- O mundo semente (`paranormal`) já popula os 13 tipos pré-configurados como dado, não como código.

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
- Adicionar um tipo de entidade novo é uma operação de dado (editar/gerar `world.json`), não uma
  mudança de código — cumprindo o requisito central desta ADR.
- `slug` é derivado do título e recomputado quando o título muda; `id` é a única referência
  estável usada em `Relation.sourceId/targetId` e em links internos do editor.
