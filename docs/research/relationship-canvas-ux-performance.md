# Canvas de relacionamentos: interface e desempenho

Pesquisa online em **16/11/2026**, com fontes primárias. Apoia o
[plano de retomada](../relationship-graph-plan.md); não é benchmark nem implementação.
Código e documentação do projeto foram consultados; nenhum conteúdo privado foi acessado.

## Conclusão para o Canon

Manter Konva e corrigir a composição da página, o ciclo de vida da cena e as interações antes de
considerar outro motor. Essa recomendação é uma avaliação do projeto, não um ranking universal.
O código atual tem altura fixa de 480 px, largura limitada pelo PageContainer, cores fixas e um
effect que recria a Stage ao mudar filtros/estilos/anotações. A screenshot também evidencia a
quantidade de interface acima do canvas. Esses problemas não demonstram incapacidade do Konva.

Proposta visual: área útil inteira ao lado do menu, grafite quente, cartões compactos, conexões
legíveis e ferramentas flutuantes. Detalhes, filtros e legenda aparecem sob demanda. A paleta vem
do ADR-005 do Canon. Essas escolhas são decisões de design locais; não resultados científicos
nem uma alegação de que uma biblioteca determina a aparência.

## Evidências e aplicação

| Fonte primária | O que a fonte sustenta | Aplicação proposta |
| --- | --- | --- |
| [Konva — desempenho](https://konvajs.org/docs/performance/All_Performance_Tips.html) | Stage grande, layers e hit-testing têm custos; recomenda reduzir trabalho e retirar formas fora de vista. | Canvas do tamanho da área visível, poucas camadas e eventos só onde há interação. Avaliar culling por perfil. |
| [Konva — redraw automático](https://konvajs.org/docs/performance/Batch_Draw.html) | Desde v8, mudanças de atributos agendam desenho; não é necessário chamar draw/batchDraw a cada atualização com auto-draw ativo. | Evitar agendamento duplicado e loop contínuo próprio. Atualizar atributos, não reconstruir a cena. |
| [Konva — zoom no ponteiro](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html) | Exemplo preserva a posição do mundo sob o cursor ao mudar escala. | Usar a mesma invariante para wheel/pinch; testar limites e coordenadas relativas ao host. |
| [Konva — descarte](https://konvajs.org/docs/performance/Avoid_Memory_Leaks.html) | destroy elimina referências do motor; remove permite reutilizar objetos. Tweens exigem atenção ao descarte. | Reconciliar objetos existentes, destruir os removidos definitivamente e limpar recursos no unmount. |
| [React Flow — viewport](https://reactflow.dev/learn/concepts/the-viewport) | Documenta configurações de mapas e ferramentas de design, incluindo pan por arraste/scroll e zoom por pinch. | Definir gestos coerentes e explícitos; distinguir manipulação de cartão, criação de vínculo e câmera. |
| [React Flow — performance](https://reactflow.dev/learn/advanced-use/performance) | Movimentos frequentes podem causar renders desnecessários; trata memoização e simplificação visual. | Isolar câmera/gestos das atualizações de formulários React. Não supor que trocar para React Flow elimina custos. |
| [Obsidian Canvas](https://obsidian.md/help/plugins/canvas) | Organiza cartões e conexões num espaço 2D; oferece ações na base do canvas e em menu contextual. | Referência de produto para manipulação direta e ações próximas do contexto, sem copiar UI ou formato de dados. |
| [WAI-ARIA — toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) | Agrupamento de controles com nome, entrada por Tab e navegação interna por setas. | Barra HTML compacta e operável por teclado; ícones precisam de nomes, foco e estado. |
| [D3 — simulação](https://d3js.org/d3-force/simulation) | Permite layout estático com stop/tick; recomenda worker para grafos grandes para evitar congelar a UI. | Se layout por forças vencer a comparação, calcular posição final fora do gesto; não manter física animada durante exploração. |

O conselho geral de otimizar não autoriza reduzir qualidade indiscriminadamente. Pixel ratio,
cache e camadas de drag só devem mudar após comparação visual e de perfil. Não adotar bloqueio
de zoom do navegador: tamanho da área útil e acessibilidade devem coexistir.

## Alternativas consideradas

| Base | Adequação e custo para esta retomada |
| --- | --- |
| Konva existente | Já suporta as formas e eventos usados. Preserva o trabalho de edição/estilos; exige implementar UI contextual, acessibilidade HTML e gestão eficiente da cena. É a recomendação atual. |
| React Flow | Referência útil de interfaces de nós, portas e câmera. Exigiria adaptar o renderizador e as interações atuais; sua própria documentação exige atenção a estado/renders. Sem benchmark local que justifique a troca. |
| [Cytoscape.js](https://js.cytoscape.org/) | Biblioteca de visualização/análise de redes, com layouts e extensões de interação. Alternativa para foco em exploração/algoritmos de grafo; não prova paridade com o editor de anotações e futuros canvas do Canon. |
| Canvas 2D próprio | Exigiria assumir desenho, hit-testing e ciclo de vida hoje cobertos pelo motor. Só considerar diante de impedimento concreto; não é atalho para polimento visual. |

Nenhuma dependência nova foi instalada. A comparação não escolhe versões de pacotes alternativos,
não mede seus desempenhos relativos e não aprova migração de documentos.

## Contratos técnicos derivados para o plano

- A Stage vive durante a montagem do mundo; alterações reconciliam objetos por ID. Câmera se
  mantém ao filtrar, editar estilo, salvar e abrir painéis. Isso decorre do comportamento desejado
  e da análise do effect atual, não de uma exigência específica do framework.
- Câmera e coordenadas: tela = mundo × escala + translação. Ao fazer zoom, calcular o mundo sob
  o ponteiro e ajustar translação para preservá-lo. Resize preserva o centro do mundo.
- Indexar relações por nó para atualizar somente conexões incidentes durante drag. Medir ganhos
  antes de generalizar infraestrutura para outros editores.
- Culling inclui trajetos de arestas que cruzam o viewport, mesmo com as pontas fora dele.
  Nível de detalhe reduz rótulos distantes, preservando seleção e alternativa HTML completa.
- Layout orientado às conexões deve respeitar posições fixadas e não executar novamente por filtro.
  Resultados assíncronos precisam ser descartados quando pertencerem a um mundo/versão anterior.
- Minimalismo não remove acessibilidade: ferramentas HTML, navegador de registros/vínculos sob
  demanda, criação por teclado e foco restaurado após edição continuam necessários.
- Autosave é proposta de produto para retirar o botão largo de salvamento; exige fila, controle de
  revisão, proteção de edições em andamento e erro persistente. Não é capacidade entregue pelo motor.

## Verificação exigida e limites

Reutilizar a fixture sintética de 500 itens/1.500 relações em pasta temporária isolada. Medir
abertura separada de HTTP, frame pacing, resposta visual, memória e ociosidade em produção.
Comparar antes/depois com hardware, navegador, DPR e resolução registrados. Inspecionar também
grafo vazio, poucos nós, paralelas, loops, filtros, seleção e painéis nos dois temas.

As metas quantitativas e a sequência de execução são canônicas no
[plano](../relationship-graph-plan.md#metas-propostas--ainda-não-medidas).
Não há medição nova nesta pesquisa. Mouse/trackpad/toque físico e leitor de tela precisam de
verificação real; eventos simulados e documentação de bibliotecas não comprovam esses resultados.
As migrações de Quadros, Cenas e Linha do Tempo permanecem a última etapa.
