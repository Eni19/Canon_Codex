# ADR-007 · Caderno do Codex no início do mundo

## Estado

Experimental, na branch `feat/home-notebook`. Ainda não foi integrado à `main`. Substitui uma
tentativa anterior, uma mesa em 3D (branch `feat/home-3d-desk`), descartada por deixar a navegação
mais confusa do que o índice em lista.

## Contexto

O início do mundo (`/codex`) listava o índice de categorias e os registros recentes. A página era
densa e pouco memorável. A proposta é que o Codex seja, de fato, um caderno: um diário de quem está
criando o mundo, que o leitor folheia e em cujas páginas encontra os caminhos para cada área.

Referências estudadas:

- **aori creative**: caderno aberto numa mesa, em colagem (polaroids, fita, ingressos, adesivos,
  texto à mão), com paralaxe sutil em camadas.
- **OWARI DIARY (SIRUP)**: diário cuja capa é o índice; abas laterais como divisórias, com marcador
  da página atual; cada página dupla é um item; o botão de menu fecha o diário na capa.
- **sketchbook (Meng To)**: a virada de página como uma cadeia de tiras que curva o papel, com luz
  por tira, arrasto com mola e inclinação do livro em direção ao cursor. O repositório não tem
  licença; a técnica foi reimplementada, sem reaproveitar código.

## Decisão

- `/codex` mostra o caderno ocupando a área de conteúdo, com a barra lateral mantida.
- Fechado, o caderno mostra a capa, que é o índice: cada linha abre a página dupla correspondente.
  Aberto, a etiqueta **Índice** fecha de volta na capa.
- O conteúdo é uma lista de páginas duplas montada em `notebook-contents.ts`: prefácio, uma página
  por tipo de registro visível na barra lateral (os tipos mais usados primeiro) e ferramentas.
- As páginas são compostas numa folha fixa de 600 × 820 e o livro inteiro é escalado para caber.
  As peças de colagem (`scraps.tsx`) são CSS e SVG, sem imagens externas; as polaroids usam as
  imagens de capa reais dos registros.
- A virada (`page-turn.ts`) usa 12 tiras aninhadas; cada uma mostra, numa face, uma fatia da página
  da frente e, na outra, da página de trás. A curvatura máxima acontece no meio da virada. Arrastar
  faz a borda da folha seguir o ponteiro; a virada só começa depois de 10 px de movimento
  principalmente horizontal, para que um clique nunca vire a página. Ao soltar, um movimento
  rápido vira a página; sem ele, a virada se completa a partir de 35% do caminho.
- Só a folha que vira é 3D. O livro, as páginas e as abas são planos, e a folha fica numa camada
  com perspectiva própria, sempre montada. A face visível de cada tira é escolhida pelo ângulo em
  JavaScript, em vez de `backface-visibility`. Motivo: no Firefox (e no Zen, baseado nele), o livro
  inteiro em 3D aparecia em blocos, perdia os efeitos de mesclagem, piscava ao virar e deslocava a
  área de clique. Por isso a inclinação do livro com o cursor, presente no sketchbook, foi retirada.
- A mesa é só uma textura (feltro escuro com trama fina e luz quente); os objetos decorativos
  ficaram de fora até haver uma arte que combine com o papel.
- As abas ficam à direita para as páginas adiante e passam para a esquerda quando são viradas.
- As cores vêm dos tokens `--nb-*` de `globals.css` (ADR-005). As fontes Caveat (escrita à mão) e
  Special Elite (máquina de escrever) são carregadas com `next/font` só no caderno.

## Alternativas consideradas

- **Virada como painel plano girando na lombada**: mais simples, mas parece uma porta, não papel.
- **Páginas como imagens prontas**, como no sketchbook: virada mais leve, mas sem links clicáveis
  nem dados atualizados do mundo.
- **Biblioteca three.js para livros**: traria peso e prenderia o conteúdo a texturas, quando a
  página precisa ser HTML navegável.

## Consequências

- Durante a virada, a página da frente e a de trás são renderizadas uma vez por tira (24 cópias por
  alguns centésimos de segundo). As páginas devem continuar leves.
- Os elementos interativos são links e botões reais; as setas do teclado viram as páginas e há uma
  região anunciada para leitores de tela. Com movimento reduzido, a virada acontece sem animação.
- Tipos sem uma composição própria usam o modelo genérico de página por tipo. Páginas
  personalizadas serão acrescentadas uma a uma.
