# ADR-005: Design system com tokens semânticos, tema "dossiê editorial"

## Estado atual em 23/09/2026

Os tokens e a direção visual continuam implementados em `src/app/globals.css`. A arquitetura de
quadros e cenas também usa componentes próprios e tldraw, mas isso não altera a decisão de tokens:
novos estilos devem continuar referenciando o sistema semântico. A visão e as limitações de
segurança/operação da aplicação estão em [`docs/operations-and-privacy.md`](../operations-and-privacy.md).

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

### Atualização: Cosmic Canvas na Linha do Tempo (15/10/2026)

O pedido explícito de uma superfície espacial minimalista substitui a apresentação TL-12 de
14/10. A linha e seus painéis mapeiam tokens semânticos para --cosmic-background,
--cosmic-surface, --cosmic-foreground, --cosmic-muted, --cosmic-accent e --cosmic-border,
centralizados em globals.css. Conforme o ajuste solicitado pelo usuário, esses tokens derivam da
paleta do aplicativo: texto pergaminho, cinza quente, bordas e acento âmbar/latão. Somente fundo
e superfícies recebem mistura com preto para representar o espaço; não há acento azul separado.
Título serifado, foco visível e componentes Radix continuam. O controle de projeção é compacto
somente nessa página e fica acima dos controles do mapa.

Três camadas separam fundo de estrelas, plano transformado e UI fixa. Pan/zoom espacial usa APIs
nativas e requestAnimationFrame; o detalhe cronológico continua sendo um filtro semântico.
A comparação com react-zoom-pan-pinch, d3-zoom e Motion está na
[pesquisa](../research/timeline-cosmic-canvas.md). Não foi adicionada dependência.
Coordenadas são calculadas pela ordem da coleção inteira; filtros alteram opacidade/estado
acessível, preservando posições e câmera. O mapa codifica sequência, sem eixo de dias proporcional.
A orientação muda explicitamente a distribuição; edição de data pode mudar a posição cronológica.

Cartões reservam dimensões fixas e só montam próximos do viewport. SVG e cartões memoizados
reduzem trabalho durante exploração. O único will-change fica no plano; não há camada GPU por
cartão. Estados de UI usam 180 ms, controles automáticos da câmera 200 ms; gestos são diretos.
O fundo usa um único brilho lento. Movimento reduzido desativa transições/animações, inclusive
nos painéis, e torna os controles imediatos. DialogContent/SheetContent mantêm overlayClassName
para aplicar essa política local. Resultados e limites estão no [perfil](../performance/timeline-cosmic-canvas.md).

- Rebrand ou tema alternativo (ex.: um segundo mundo com atmosfera diferente) é uma troca de
  valores de tokens, não uma reescrita de componentes.
- Componentes shadcn adicionados via CLI precisam ser revisados para não introduzir cor solta fora
  do sistema de tokens antes de serem aceitos no repositório.
