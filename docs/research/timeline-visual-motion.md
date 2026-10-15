# Linha do Tempo: referências de apresentação e movimento

Pesquisa em **14/10/2026** para o TL-12. A seleção privilegia fontes dos próprios produtos,
design systems e padrões; não constitui um ranking objetivo dos “melhores” exemplos.
As recomendações abaixo são decisões de projeto para o Canon. O comportamento efetivamente
entregue e os resultados de medição ficam no [guia](../user-guide/timelines.md) e no
[relatório de desempenho](../performance/timeline-500.md).

## Referências e aplicação

| Referência primária | O que ela oferece | Tradução para o Canon |
| --- | --- | --- |
| [Knight Lab — TimelineJS](https://timeline.knightlab.com/) | Narrativa cronológica com mídia e evento como parte de uma história maior. O próprio projeto recomenda não ultrapassar 20 slides. | Títulos, datas e capas com presença editorial; sequência de leitura clara. A navegação por slides não é modelo de escala para 500 aparições. |
| [Aeon Timeline — The Timeline View](https://www.aeontimeline.com/guides/the-timeline-view) | Escalas de detalhe e visão geral, intervalo visível, contexto condensado e botões para deslocamento horizontal. | Régua legível, período atual reconhecível, seleção coerente entre vistas e botões equivalentes ao arraste. Adotar a orientação espacial sem adicionar novos contratos de calendário. |
| [Linear — A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh) | O relato de março de 2026 descreve navegação com menor peso visual, ações previsíveis e separadores mais suaves para reduzir ruído em interfaces densas. | Fazer o cartão e a data prevalecerem sobre filtros e chrome. Acento latão reservado ao estado ativo, foco e marcos relevantes; eixo discreto, com contraste suficiente para orientar. |
| [Carbon — Motion](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview) | Distingue movimento produtivo, sutil e rápido, de movimento expressivo; oferece durações e curvas por função. | Movimento produtivo nas tarefas frequentes. Evitar mola, overshoot e efeitos que disputem atenção com a leitura. |

A adaptação segue o [ADR-005](../architecture/ADR-005-design-system.md): grafite, texto quente,
latão e tokens semânticos existentes; serifada nos títulos de entidade e sans-serif nos controles.
Não copiar paletas, fontes ou componentes das referências.

## Direção visual recomendada

- **Vertical:** eixo fino e contínuo, marcas de período com contraste hierárquico, data antes do
  título, metadados compactos e respiro entre grupos. No celular, uma coluna de cartões evita
  comprimir títulos e ações.
- **Horizontal:** mesma linguagem de cartão, régua com marcas maiores e menores, conectores
  discretos e trilhas que conservam a leitura de cartões próximos. O eixo tem rolagem própria;
  a página não deve ganhar largura por causa dele.
- **Cartões:** título como primeiro nível de leitura; data e categoria reconhecíveis; nota curta
  subordinada; capa com área reservada para não alterar a geometria após carregar. A seleção usa
  borda e superfície sem depender exclusivamente de cor.
- **Estados:** distinguir linha vazia, filtro sem resultados, Sem data e registro indisponível.
  Cada estado explica a situação e apresenta a ação útil correspondente, mantendo a linguagem
  editorial. Indisponibilidade conserva os dados próprios da aparição.

## Orçamento de movimento proposto

Carbon publica 110 ms para fades, 150 ms para pequenas expansões/deslocamentos e 240 ms para
expansões maiores. Estas são referências, não exigências normativas.
([Durações e curvas do Carbon](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview))

| Situação | Decisão para o TL-12 |
| --- | --- |
| Hover, foco e seleção | Feedback imediato; transição curta de superfície/borda, até 110 ms. |
| Entrada/saída de cartão | Opacidade e deslocamento de até 6 px, 150 ms; somente os poucos itens relevantes para a mudança. |
| Abrir detalhes ou editor | Até 240 ms, sem atrasar foco ou ações. |
| Vista, escala, filtro ou página | Uma transição breve do conjunto; conservar âncoras estáveis. Não remontar nem animar todos os cartões para decorar a troca. |
| Movimento reduzido | Remover deslocamento, escala, cascata e rolagem suave; atualizar instantaneamente ou usar mudança discreta de opacidade. |

Curvas produtivas sugeridas: `cubic-bezier(0.2, 0, 0.38, 0.9)` para mudanças visíveis,
`cubic-bezier(0, 0, 0.38, 0.9)` para entrada e `cubic-bezier(0.2, 0, 1, 0.9)` para saída.
O [Carbon — Choreography](https://www.carbondesignsystem.com/building-blocks/foundations/motion/choreography)
associa consistência semântica à mesma família de movimentos e recomenda manter sequências
escalonadas abaixo de 500 ms. Para o Canon, a recomendação é dispensar a cascata global:
ela alonga a navegação de páginas densas sem acrescentar contexto.

## Acessibilidade e estabilidade

O [WCAG 2.3.3, nível AAA](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)
prevê desativar movimento não essencial disparado por interação. A
[técnica C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html) documenta
`prefers-reduced-motion`; preferir estilos estáticos como base e movimento em `no-preference`.
Isso deve abranger CSS e rolagem programática.

O [WCAG 2.4.11, nível AA](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum)
exige que o componente focado não fique totalmente oculto por conteúdo criado pela aplicação.
Preservar o botão focado e o ID da aparição quando possível; após fechar o editor, devolver foco
ao cartão correspondente. Uma transição visual não deve desabilitar a próxima ação nem apagar
o contexto selecionado. Medir também cabeçalhos fixos e bordas do contêiner rolável.

O [WCAG 2.5.7, nível AA](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)
exige alternativa de ponteiro sem arraste; teclado sozinho não atende esse requisito.
Conservar botões de incluir/remover/navegar utilizáveis por clique ou toque, além do teclado.

## Escala e verificação

A [MDN — CSS performance optimization](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS#handling_animations)
recomenda reduzir animações desnecessárias, priorizar `transform`/`opacity` e medir o efeito;
`will-change` é último recurso para um problema observado, não otimização preventiva global.
Reservar dimensões de capas e evitar transições de propriedades que recalculam toda a geometria.

Preservar a paginação de 50 aparições do TL-11 e o editor montado sob demanda. O cenário sintético
de 500 itens deve exercitar as duas vistas, páginas finais/Sem data, filtros e alternância rápida.
Registrar navegador, versão, máquina, viewport, modo de build, fontes e eventual throttling.
Separar tempo de automação de CPU/FPS: respostas de ferramentas não medem a fluidez de quadros.
Quando disponível, coletar intervalos de `requestAnimationFrame`, long tasks e deslocamentos
de layout durante interações aquecidas, explicitando limitações da amostragem.

Critérios de aceitação recomendados: no máximo 50 cartões montados por página; nenhum movimento
simultâneo dos 500 itens; nenhuma perda de foco ou rolagem inesperada; dimensões externas dentro
do viewport em desktop e celular. Fontes e imagens carregadas, títulos longos e cartões próximos
precisam de inspeção visual. A pesquisa não comprova esses resultados: a validação do TL-12
deve registrar o que foi de fato observado.
