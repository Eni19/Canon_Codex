# ADR-004: Tiptap isolado atrás de um ContentDocument versionado

## Estado atual em 23/09/2026

O domínio atual usa `ContentDocument` versão 2 com `pages[]`. A documentação original desta ADR
descrevia a forma anterior de uma única propriedade `body`; essa forma só é aceita como entrada
legada pela migração v1→v2.

## Contexto

O editor precisa de uma experiência próxima de Notion (blocos, menu `/`, links internos,
drag-and-drop). Tiptap/ProseMirror é a escolha natural para isso em React. Mas o domínio da
aplicação (entidades, relações, backlinks) não deve depender da biblioteca de editor escolhida —
trocar de editor no futuro (ou mudar o formato de serialização) não pode significar reescrever o
modelo de dados ou o `WorldRepository`.

## Decisão

- O conteúdo de uma entidade é persistido separado dos metadados, em `content.json`, como um
  `ContentDocument`: `{ format: 'tiptap-json', schemaVersion, pages }`. Cada página tem `id`,
  `title` e `body`; o JSON do Tiptap é tratado como **opaco** pelo domínio (tipado como `unknown`
  fora da camada do editor).
- `WorldRepository.getContent`/`saveContent` movem esse objeto inteiro; nenhuma outra parte do
  domínio faz parsing do conteúdo do editor.
- Links internos usam um nó customizado do Tiptap (`EntityLink`) que guarda `{ entityId }` — nunca
  título ou slug — para não quebrar quando a entidade referenciada for renomeada.
- `ContentRenderer` (leitura, fora do editor) consome o `body` da página ativa para renderizar a página em
  modo leitura, sem reimplementar o parsing em outro lugar.

## Alternativas consideradas

- **Markdown como formato de persistência**: mais portátil e legível em texto puro, mas Markdown
  não representa nativamente blocos ricos como callouts, galerias ou o nó `EntityLink` sem
  extensões customizadas que reintroduzem o mesmo acoplamento a uma sintaxe específica. Markdown
  fica como um formato de *exportação* possível no futuro, não como fonte da verdade.
- **Persistir HTML renderizado**: mais simples de exibir, mas com perda de estrutura (difícil
  editar de volta, difícil extrair relações/links de forma confiável).

## Consequências

- Trocar de editor no futuro (ou migrar para um novo formato Tiptap major) é: escrever um novo
  `format` no `ContentDocument`, uma função de migração do formato atual para o novo e um novo
  `ContentRenderer` — não uma reescrita do domínio. Se a mudança for apenas de páginas, a migração
  correspondente deve preservar a primeira página e seus nós.
- Como o `body` é opaco para o domínio, buscas full-text sobre o conteúdo (não só título/aliases)
  exigem uma função de extração de texto plano específica do formato (`extractPlainText`), mantida
  junto à camada do editor, não no domínio.
