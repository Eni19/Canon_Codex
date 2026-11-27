# ADR-007: Canvas próprio em Konva para relações e, depois, para os outros canvas

> **Estado:** parcial (grafo, Cenas e Quadros usam Konva; faltam o painel de estilo dos Quadros e a
> retirada do pacote tldraw, que continua no `package.json` sem nenhum import em `src/`) ·
> **Última verificação:** 27/11/2026,
> `package.json`, `src/components/boards/board-stage.ts`, `src/components/scenes/scene-stage.ts` e
> `src/domain/canvas/`.

## Contexto

O app tem quatro superfícies de canvas. Até esta decisão, cada uma seguia um caminho próprio:

- **Quadros** (`investigation-board.tsx`) e **Cenas** (`scene-runner.tsx`) usam tldraw 5.4.1 e
  guardam snapshots do tldraw;
- a **Linha do Tempo** usa uma superfície própria com SVG e cartões HTML;
- o **grafo de relações** precisava de um canvas para centenas de cartões e milhares de vínculos.

A [verificação da licença do tldraw](../research/tldraw-license.md) mostrou três problemas para um
app local-first:

1. fora de `localhost` e sem chave válida, o editor some depois de 5 s, o que quebra Quadros e
   Cenas abertos pelo IP da rede local (por exemplo, a projeção de uma cena em outro aparelho);
2. sem chave em produção, o pacote envia o endereço da página ao CDN do tldraw, o que contraria
   a [política de operação e privacidade](../reference/operations-and-privacy.md);
3. em `localhost` funciona, mas com marca-d'água, e o uso fora de desenvolvimento depende de uma
   licença hobby ou comercial.

A [pesquisa de interface e desempenho](../research/relationship-canvas-ux-performance.md) comparou
Konva, React Flow e Cytoscape.js para o grafo. O [perfil de desempenho](../performance/relationship-graph.md)
de 25/11/2026, com 500 registros e 1.500 vínculos sintéticos, mediu pan p95 de 17,4–17,6 ms, zoom
p95 de 20,0–20,7 ms e arraste p95 de 17,2–17,3 ms em Konva, depois de otimizar o hit graph e o
desenho em lote. Antes dessas otimizações, pan e zoom passavam de 65 ms; o gargalo era o uso do
motor, não o motor.

## Decisão

- O grafo de relações usa **Konva** (licença MIT), com ferramentas, formulários e a alternativa
  acessível em HTML sobre o canvas.
- Konva é o motor de canvas do projeto. Não se adiciona outro renderizador ou framework de animação
  só para redesenhar uma tela; o motor só é reconsiderado diante de um impedimento reproduzível
  e medido.
- Cenas e depois Quadros migram do tldraw para o canvas Konva, com conversor de snapshots
  idempotente, prévia, backup e restauração, e então o tldraw e `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`
  saem do projeto. A Linha do Tempo só migra se não houver regressão em relação ao perfil atual.
  As etapas estão no [REL-08](../plans/relationship-graph-plan.md#rel-08--etapa-final-migrar-os-outros-canvas);
  os issues #16 e #17 foram fechados com a migração das Cenas e dos Quadros.
- Uma base compartilhada entre canvas só é extraída quando houver um segundo consumidor real.

## Alternativas consideradas

| Alternativa | Por que não foi escolhida |
| --- | --- |
| Manter tldraw em todos os canvas | Depende de chave para uso fora de `localhost`, exibe marca-d'água e faz uma requisição externa sem chave |
| React Flow | Boa referência de nós, portas e câmera, mas exigiria adaptar o renderizador e as interações; não havia medição local que justificasse a troca |
| Cytoscape.js | Focado em análise e layout de redes; não prova paridade com as anotações do grafo nem com os futuros Quadros e Cenas |
| Licença hobby ou comercial do tldraw | Resolve o bloqueio no curto prazo e continua válida até a migração, mas mantém a dependência de chave e de termos externos |

## Consequências

- O grafo funciona sem conta, chave, CDN ou marca-d'água, inclusive fora de `localhost`.
- **Cenas migradas (26/11/2026):** o editor Konva (`scene-stage.ts`) reproduz a câmera, a
  seleção, as alças, a rotação pelos cantos, a seleção por área e os atalhos que a cena tinha no
  tldraw, com as mesmas cores de seleção. A câmera e a geometria foram portadas como funções puras
  em `src/domain/scenes/`. Funcionam fora de `localhost` sem chave.
- **Quadros migrados, etapa 1 (26/11/2026):** canvas infinito com a câmera do tldraw, cartões de
  registro nas cinco visualizações, texto e setas vinculadas, seleção, alças, desfazer/refazer,
  copiar/colar e os atalhos do tldraw. As fontes do tldraw (Shantell Sans e IBM Plex) são servidas
  pelo app. A base comum (câmera, geometria, histórico) foi extraída para `src/domain/canvas/`,
  agora que há dois consumidores.
- **Quadros, etapa 2 (26/11/2026):** desenho livre, borracha, nota, 20 formas geométricas, linha e
  imagem (seletor, arrastar e colar). O traço livre usa `perfect-freehand` (MIT), a biblioteca
  original do mesmo autor, em vez da cópia interna do tldraw, que segue a licença dele. Marca-texto,
  laser e moldura ficaram de fora por decisão do usuário. **Pendente:** painel de estilo (etapa 3).
- Nenhum canvas depende mais de `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`.
- Câmera, seleção, toque, culling e desenho em lote passam a ser responsabilidade do projeto, e
  cada canvas migrado precisa de um perfil de desempenho próprio.
- A migração exige converter snapshots tldraw para um formato Canon versionado. Os formatos
  `canon-scene-canvas` e `canon-board-canvas` e as conversões estão em
  [migrações](../data/migrations.md#canvas-do-quadro-snapshot-tldraw--canon-board-canvas-v1); o
  documento tldraw original fica guardado no próprio registro.
- Não verificado: latência real em tela física, trackpad e toque, e o comportamento com leitor de tela.
