# Linha do Tempo: navegação espacial e Cosmic Minimalism

Pesquisa realizada em **15/10/2026** para o redesenho da linha do tempo existente.
As fontes abaixo são documentação, código dos próprios projetos e especificações.
As recomendações são decisões de arquitetura propostas para o Canon; não constituem
resultados de benchmark nem confirmação de gestos testados em dispositivos físicos.
O escopo desta pesquisa não inclui dados privados do usuário.

## Referências visuais primárias

| Exemplo | Evidência na fonte | Aplicação no Canon (decisão de design) |
| --- | --- | --- |
| [NASA Eyes](https://science.nasa.gov/eyes/) | Família de visualizações interativas para explorar dados e imagens astronômicas. | Superfície contínua, foco no objeto e controles sobrepostos; adaptar para 2D e conteúdo textual. |
| [ESA — mapa interativo Gaia EDR3](https://www.esa.int/ESA_Multimedia/Images/2020/12/Interactive_map_of_the_sky_from_Gaia_s_Early_Data_Release_3) | Mapa de brilho/cor das estrelas observadas por Gaia. | Hierarquia de pontos e fundo escuro com densidade discreta, sem copiar dados astronômicos ou ativos. |
| [TimelineJS, Aeon, Linear e Carbon](timeline-visual-motion.md) | Referências editoriais e de movimento já pesquisadas no TL-12. | Título/data legíveis, chrome discreto e transições produtivas. |

A seleção não é um ranking objetivo. As traduções acima são interpretações locais de design;
nenhuma biblioteca, imagem ou base astronômica desses exemplos foi incorporada.

## Decisão recomendada

Usar **Pointer Events, WheelEvent e requestAnimationFrame**, mantendo a câmera em
um módulo pequeno e independente do layout cronológico. A superfície precisa de
translação e escala uniformes, não de um editor de formas. Não há justificativa
identificada para adicionar três bibliotecas para esse contrato.

A decisão considera a stack informada para a tarefa: React 19, Next 16 e animejs já
disponível. CSS resolve os fades e estados de controles; a câmera não precisa de
uma segunda biblioteca de animação. Essa adequação é uma avaliação de projeto,
não uma alegação de que código próprio será sempre mais rápido que bibliotecas.

## Opções avaliadas

| Opção | Capacidades verificadas | Custo e encaixe para o Canon |
| --- | --- | --- |
| [react-zoom-pan-pinch](https://github.com/BetterTyped/react-zoom-pan-pinch/blob/master/README.md) | API React com `TransformWrapper`, `TransformComponent`, controles imperativos e suporte declarado a mouse, touch e touchpad. | Excelente atalho quando o contrato é transformar conteúdo arbitrário. Introduz um controlador e wrappers que precisam conviver com câmera persistente, culling e foco já próprios do produto. Não elimina a necessidade do layout estável. |
| [d3-zoom](https://d3js.org/d3-zoom) | Transformação uniforme sobre HTML, SVG ou Canvas; wheel, arraste, pinch, filtros de evento, limites e controles programáticos. | Alternativa mais sólida se os gestos passarem a exigir muitos ajustes e compatibilidades. Exige integrar seu estado imperativo ao ciclo React e ao renderizador. Atenção: `zoom.transform` não aplica automaticamente os limites definidos. |
| [Motion — gestos](https://motion.dev/docs/react-gestures) | Hover, tap, pan, drag, focus e inView; a página exige `touch-action` apropriado para pan por toque. | Útil se o produto adotar Motion amplamente. A API listada não entrega um controlador completo de câmera com pinch e wheel; adicioná-la só para chips e hover duplicaria infraestrutura existente. |
| APIs nativas | Pointer Events unifica mouse, pen e touch; wheel representa também zoom de trackpad; rAF sincroniza escrita visual com repaint. | Melhor encaixe atual, desde que câmera, cancelamento, captura e zoom ancorado sejam isolados e testados. A manutenção de peculiaridades de entrada fica no projeto. Fontes detalhadas abaixo. |

O código do react-zoom-pan-pinch permite excluir alvos de wheel e distingue
`ctrlKey` em gestos de touchpad ([wheel.utils.ts](https://github.com/BetterTyped/react-zoom-pan-pinch/blob/master/src/core/wheel/wheel.utils.ts)).
Também verifica alvos excluídos, editáveis e arrastáveis antes de iniciar pan
([panning.utils.ts](https://github.com/BetterTyped/react-zoom-pan-pinch/blob/master/src/core/pan/panning.utils.ts)).
São referências úteis para a política de interação, mesmo sem instalar o pacote.

## Contrato da câmera proposto

Separar três camadas: estrelas decorativas sem eventos; plano cronológico
transformável; título, filtros, controles e detalhes em overlay fora desse plano.
Nenhum painel de detalhes deve alterar dimensões ou coordenadas do plano.

Representar a câmera como `{ x, y, scale }`, com `transform-origin: 0 0` e uma
única transformação `translate(x, y) scale(scale)`. Coordenadas de entrada são
relativas ao viewport, descontando seu retângulo. A identidade geométrica é:

```text
tela = mundo × escala + translação
mundoSobCursor = (cursor − translaçãoAtual) / escalaAtual
novaTranslação = cursor − mundoSobCursor × novaEscala
```

Essa derivação algébrica preserva o mesmo ponto do mundo sob o cursor, inclusive
após limitar a nova escala. Não mudar posições de cartões durante wheel ou pan.
Manter o valor corrente em ref; consolidar escritas de transform em um rAF
pendente, sem reconstruir toda a árvore por evento de entrada.

`requestAnimationFrame` é uma solicitação para antes do próximo repaint, e seu
timestamp permite animações independentes da taxa de atualização. Cancelar a
solicitação ao desmontar; não manter um loop quando nada muda.
([MDN — requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame))

## Gestos e preservação de cliques

Wheel também é disparado por zoom de trackpad, com `ctrlKey: true`; sua unidade
pode ser pixel, linha ou página. Usar listener local com `{ passive: false }`
para cancelar o comportamento nativo dentro da superfície. Não interceptar
wheel de painéis e controles externos. Normalizar a unidade antes de aplicar
escala exponencial; a sensibilidade é uma escolha a calibrar no produto.
([MDN — wheel](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event))

Para este pedido, wheel vertical normal aproxima/afasta; `ctrl+wheel` também
aproxima/afasta. Não inferir com certeza se um wheel veio de mouse ou trackpad.
Uma política adicional de pan horizontal pode usar `deltaX`, sem converter a
rolagem vertical pedida pelo usuário em uma ação diferente.

Pointer Events oferece `pointerId`, captura e cancelamento. A especificação
determina que manipulação nativa por toque seja declarada com `touch-action`,
não apenas `preventDefault` em eventos de ponteiro. Ela também ressalta a
necessidade de equivalentes de teclado.
([W3C — Pointer Events](https://w3c.github.io/pointerevents/))

Política proposta: iniciar pan primário somente no fundo; excluir cartões,
links, botões e campos; capturar o ponteiro permitido; encerrar em `pointerup`,
`pointercancel` e perda de captura. Para touch, manter dois pontos por ID,
calcular distância e ponto médio, ancorar o mundo no ponto médio inicial e
aplicar simultaneamente escala e translação. Ao perder um dedo, reiniciar a
base do pan com a câmera corrente para evitar salto. Aplicar `touch-action:
none` somente à superfície navegável, conservando a interface externa utilizável.

Oferecer botões de zoom, centralizar e ajustar à tela, além de teclado. Evitar
capturar ponteiro de um botão: captura pode mudar o destino do clique subsequente.
Manter foco e retorno de foco após fechar detalhes como contratos explícitos.

## Coordenadas, filtros e muitos eventos

Recomendação de implementação: calcular posições com a coleção completa e a
ordem cronológica, usando dimensões reservadas de cartão e desempate estável.
Filtros operam na visibilidade, nunca na entrada do algoritmo de posicionamento.
Manter a câmera e as caixas de controles; indicador ativo usa posição absoluta,
opacidade ou transform, sem acrescentar largura de borda ao estado selecionado.

Para 500 ou mais aparições, transformar os limites do viewport em coordenadas
do mundo e renderizar a região acrescida de uma margem. Culling e filtro têm
papéis distintos: ocultar por filtro deve animar opacidade sem remontar os
cartões presentes; sair da região visível pode dispensar DOM, mantendo a
coordenada no modelo. Preservar o cartão focado/selecionado durante culling e
retirar itens filtrados da navegação e da árvore acessível, não apenas deixá-los
transparentes. Essas são recomendações locais; não foram medidas nesta pesquisa.

Começar com interseção simples de caixas, sem índice espacial adicional. Só
introduzir índice se o perfil demonstrar custo relevante. Não animar centenas
de entradas em cascata, não recalcular medidas de todos os cartões por frame,
e não criar uma camada GPU por cartão preventivamente.

O guia do Chrome recomenda transform e opacity para animações, investigar
reflow/paint com DevTools e usar `will-change` com parcimônia. Isso orienta a
implementação, mas não garante FPS em uma máquina específica.
([web.dev — animações de alto desempenho](https://web.dev/articles/animations-guide))

## Movimento reduzido e verificação

`prefers-reduced-motion` informa a preferência de reduzir movimentos não
essenciais ([MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).
Manter pan e zoom diretamente controlados; desativar twinkle, parallax, inércia
e deslocamentos automáticos decorativos. Ajustar à tela pode ser imediato.
Filtros podem mudar opacidade brevemente ou atualizar sem animação. Motion,
se adotado no futuro, possui `reducedMotion` e `useReducedMotion`, inclusive
tratamento separado para transform e opacity
([Motion — acessibilidade](https://motion.dev/docs/react-accessibility)).

Verificação proposta com dados sintéticos: âncora de zoom antes/depois,
cancelamento de arraste, pinch de dois dedos, troca de filtro com câmera e
coordenadas inalteradas, controles sem mudança de caixa, detalhes sem pan,
foco visível, movimento reduzido e DOM limitado na coleção de 500 aparições.
Trackpad real e touch físico continuam dependendo de verificação no dispositivo;
eventos sintéticos não comprovam a resposta do hardware ou todas as políticas
de cancelamento do navegador.

## Estado da evidência

- **Verificado nesta pesquisa:** contratos documentados nas fontes e comparação
  de encaixe das quatro opções.
- **Recomendado para a implementação:** câmera nativa, coordenadas independentes
  de filtros, camadas separadas e culling com margem.
- **Não verificado nesta pesquisa:** desempenho real do redesenho, gestos em
  hardware físico e compatibilidade completa entre navegadores. Registrar os
  resultados efetivamente obtidos no relatório de validação da mudança.
