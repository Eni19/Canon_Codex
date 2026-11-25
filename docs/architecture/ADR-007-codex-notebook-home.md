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
- O caderno é uma cena three.js (React Three Fiber), como o livro do Stripe Press (*Nomad Letters*),
  carregada só no navegador (`book-scene.tsx`): capas de couro, guardas, blocos de páginas, luz quente
  e sombras sobre um fundo
  grafite com vinheta (`--nb-backdrop`). A mesa 3D foi retirada por enquanto; ela voltará decorada. Capa, guardas e bordas das páginas são texturas
  pintadas em canvas com as cores dos tokens `--nb-*` (`book-textures.ts`).
- Fechado, o caderno fica em vista 3/4 e gira um pouco com o ponteiro; o papel do índice está sobre
  a capa. Ao abrir, o índice desliza para o lado do livro, a capa gira na lombada levando a primeira
  página do lado de dentro, como num caderno real, e a câmera desce até a vista de cima. O índice ao
  lado do livro substitui os marcadores laterais.
- As páginas continuam sendo HTML (`notebook-pages.tsx`, `scraps.tsx`), compostas numa folha de
  600 × 820. Com o caderno aberto e parado, a câmera olha reto para baixo; cada página fica paralela
  à tela e projeta um retângulo, então o HTML é posicionado sobre a página 3D com transformação 2D
  (posição, rotação e escala), sem CSS 3D. Assim as páginas ficam nítidas e clicáveis.
- Enquanto uma página vira, ou o caderno abre e fecha, o HTML some e as páginas 3D usam fotografias
  dele (`page-textures.ts`, com `modern-screenshot`), tiradas de cópias fora da tela da página aberta
  e das vizinhas. A página que vira é uma malha dobrada pela mesma curva do sketchbook
  (`book-geometry.ts`), impressa dos dois lados e com sombra projetada.
- A folha tem peso: puxar 80% da largura das duas páginas vira a página, o começo do puxão rende
  menos (curva com expoente 1,35), a folha segue o ponteiro com um leve atraso e o arremesso precisa
  ser forte. A virada se completa a partir de 42% do caminho, com molas amortecidas e macias, sem
  ultrapassar o destino (95/19,5 ao completar, 85/18,5 ao cancelar). Um toque na página, fora dos
  links, vira a página; um toque na mesa fecha o caderno.
- As fotografias das páginas são tiradas uma de cada vez, em tempo ocioso e nunca durante um
  movimento, e a URL é atualizada 0,7 s depois da última virada: fazer tudo ao fim de cada virada
  travava o arrasto seguinte. Com o caderno aberto, a câmera fica parada e o HTML é posicionado em
  pixels inteiros, para que o quadriculado do papel não trema.
- Ao seguir um link de dentro do caderno, a página aberta fica guardada na sessão
  (`sessionStorage`), e o caderno reabre nela quando o leitor volta. A URL não é atualizada a cada
  virada: mudar a query fazia o Next montar a página de novo, e o caderno inteiro piscava logo depois
  de cada virada (antes, um `history.replaceState` direto era sobrescrito pelo roteador). A URL
  `?pagina=<id>` continua valendo para abrir direto numa página. O caderno é renderizado só no
  navegador (`notebook-loader.tsx`), o que permite ler a sessão já no estado inicial.
- A metade esquerda das páginas (bloco e página) é presa à capa, como num caderno real: gira com ela
  ao abrir e pousa exatamente no lugar, sem trocar um objeto por outro (a troca piscava). Os blocos
  têm espessura fixa, metade de cada lado; fazer as páginas lidas se acumularem à esquerda mudava a
  altura das páginas a cada virada, e tudo parecia se reacomodar.
- Cada fotografia é conferida (reduzida a 32 × 32, precisa ter várias cores, como o quadriculado e
  o texto de qualquer página) e tirada de novo, até quatro vezes, se vier de uma cor só, e tem a cor do papel como fundo. No Firefox (e no Zen), a captura às vezes sai antes de a
  imagem intermediária ser decodificada; numa página opaca, essa foto transparente aparecia preta.
  Conferir só alguns pontos não bastava: em páginas com pouco conteúdo eles caíam no papel liso, a
  foto boa era descartada e a página virava em branco.
- A capa, a contracapa e a lombada usam um couro gasto pintado em canvas (manchas em três escalas,
  bordas mais claras e grão), na linha da capa do OWARI DIARY, com um friso dourado junto à lombada.
- Setas desenhadas nos cantos de cada página (**continue** e **voltar**; **fechar** na primeira) e as
  teclas (setas, `Enter`, `Esc`) dão acesso sem arrastar. Uma barra de navegação inferior foi testada
  e retirada.
- As páginas 3D (paradas, a que vira, a de dentro da capa e o índice) não recebem luz, e a cena é
  desenhada sem mapeamento de tons (`flat`): assim a fotografia tem exatamente as cores do HTML e a
  troca entre os dois não muda a luz. A profundidade da folha que vira vem de cores por vértice,
  mais escuras conforme ela se inclina, e de uma sombra em degradê sobre a página de baixo.
- As fotografias são tiradas no tamanho em que a página aparece na tela (pixels do dispositivo) e
  usadas sem mipmaps, para ficarem tão nítidas quanto o HTML. As de páginas fora da vizinhança são
  liberadas, e o espelhamento das faces é feito por coordenadas de textura, sem cópias: manter tudo,
  com fotos grandes e cópias reenviadas à GPU a cada virada, esgotava a memória de vídeo e o navegador
  descartava a cena (o caderno ficava preto a partir da quinta página).
- Uma virada (ou a abertura) só começa quando as fotografias das páginas que ela mostra existem: as
  que faltam são tiradas na hora e a animação espera até 0,9 s. São preparadas duas páginas duplas
  para cada lado, mais o destino de um salto pelo índice. Páginas sem fotografia apareciam brancas.
- As fontes Caveat (escrita à mão) e Special Elite (máquina de escrever) são carregadas com
  `next/font` só no caderno.

## Alternativas consideradas

- **Virada como painel plano girando na lombada**: mais simples, mas parece uma porta, não papel.
- **Páginas como imagens prontas**, como no sketchbook: virada mais leve, mas sem links clicáveis
  nem dados atualizados do mundo.
- **Livro 2D em CSS**, a primeira versão: leve, mas com cara de imagem plana. No Firefox, o 3D em
  CSS do livro inteiro quebrava a imagem em blocos e deslocava os cliques.
- **HTML em 3D com `Html transform` do drei**: posicionaria o HTML sobre páginas inclinadas, mas usa
  CSS 3D aninhado, o mesmo que falhava no Firefox.

## Consequências

- Cada página aberta e suas vizinhas são renderizadas também fora da tela, para as fotografias.
  Novas dependências: `three`, `@react-three/fiber`, `@react-three/drei`, `modern-screenshot` e
  `@types/three`. O custo de GPU ainda não foi medido em máquinas modestas.
- A vista aberta é sempre de cima; inclinar a câmera com o livro aberto exigiria outra forma de
  sobrepor o HTML.
- Os elementos interativos são links e botões reais; as setas do teclado viram as páginas e há uma
  região anunciada para leitores de tela. Com movimento reduzido, a virada acontece sem animação.
- Tipos sem uma composição própria usam o modelo genérico de página por tipo. Páginas
  personalizadas serão acrescentadas uma a uma.
