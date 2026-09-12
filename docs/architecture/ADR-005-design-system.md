# ADR-005: Design system com tokens semânticos, tema "dossiê editorial"

## Contexto

O produto não deve parecer um painel administrativo genérico ou um template SaaS/Bootstrap
padrão. Ele precisa transmitir uma atmosfera de arquivo confidencial / enciclopédia de mundo
fictício, permanecendo um software moderno, legível e acessível — e sem que nenhuma referência
visual futura force uma reescrita de componente por componente.

## Decisão

- Todas as cores, espaçamentos, raios e sombras usados pela UI vêm de tokens semânticos definidos
  em `src/app/globals.css` (ex.: `--background`, `--surface`, `--surface-raised`, `--primary`,
  `--secondary`, `--muted`, `--border`, `--accent`, `--danger`, `--sidebar`,
  `--sidebar-foreground`), mapeados no tema do Tailwind v4 via `@theme inline`. Nenhum componente
  usa uma cor hexadecimal solta.
- Tema inicial: modo escuro como padrão (atmosfera de dossiê — grafite/tinta escura, texto quente),
  um único acento âmbar/latão para ações e destaques, tipografia serifada para títulos de entidade
  e sans-serif para chrome/UI. Modo claro é uma variante válida usando os mesmos tokens, não uma
  reescrita.
- Base de componentes: shadcn/ui (estilo "Nova", base Radix), restilizado sobre os tokens acima —
  usado como ponto de partida acessível (foco, teclado, ARIA já resolvidos), não copiado
  visualmente sem adaptação.
- Quando uma referência visual futura for fornecida pelo usuário, ela é traduzida para os tokens
  existentes (cores, densidade, tipografia) em vez de copiada pixel a pixel — e qualquer conflito
  entre a referência e usabilidade/contraste/responsividade é resolvido a favor da solução
  funcional, com a adaptação explicada.

## Alternativas consideradas

- **Estilizar componentes diretamente com valores ad-hoc (hex/rgb inline)**: mais rápido no curto
  prazo, mas impossibilita reskinning centralizado e viola o requisito explícito de tokens
  semânticos do produto.
- **Construir os componentes de UI do zero (sem shadcn/ui)**: mais controle total sobre o
  visual, mas duplica trabalho de acessibilidade (foco, navegação por teclado, ARIA) que o
  shadcn/Radix já resolve; não há necessidade concreta de fugir dele ainda.

## Consequências

- Rebrand ou tema alternativo (ex.: um segundo mundo com atmosfera diferente) é uma troca de
  valores de tokens, não uma reescrita de componentes.
- Componentes shadcn adicionados via CLI precisam ser revisados para não introduzir cor solta fora
  do sistema de tokens antes de serem aceitos no repositório.
