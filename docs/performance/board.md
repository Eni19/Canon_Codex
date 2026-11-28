# Quadro de investigação: desempenho

> **Estado:** histórico · **Última verificação:** 27/11/2026, build de produção em Chrome headless
> com o quadro sintético de 1.400 itens; cada seção traz a própria data e protocolo.

## Silhueta, textura e ícone do tipo · 27/11/2026

Medição da fatia 4 do #72 ([ADR-011](../architecture/ADR-011-entity-type-visuals.md)): o cartão de
registro passa a usar a silhueta do tipo na sombra, no recorte e na borda, a textura do tipo no
fundo e o ícone do tipo antes do rótulo. Windows, Ryzen 7 5700U, Next.js 16.3.4, Chrome
158.0.8127.88 headless a 1.440 × 900 e DPR 1, com o mundo gerado por
`scripts/seed-board-stress.test.ts` e `BOARD_STRESS_TYPES=all`, que distribui os 300 cartões pelos
17 tipos do mundo semente. Mesmo protocolo da seção abaixo (`scripts/board-profile.mjs`, três
repetições de 10 s por gesto, depois de uma rodada de aquecimento). A base é o commit `b2e375a`,
compilado nesta mesma pasta e medido com o mesmo mundo.

Neste Chrome, o pan pela roda fica em p50 de 33 ms nas duas versões, o dobro da medição de 26/11 em
Edge: a cadência dos eventos de roda mudou com o navegador, então só vale a comparação entre as
linhas desta tabela.

| Vista | Gesto | Base (p95) | Identidade do tipo (p95) | `DroppedFrame` base / nova |
| --- | --- | ---: | ---: | --- |
| Quadro inteiro | Pan | 35,68–37,31 ms | 36,31–37,22 ms | 55–70 / 79–85 |
| Quadro inteiro | Zoom | 31,56–31,64 ms | 31,58–32,05 ms | 250–251 / 251–262 |
| Zoom 100% | Pan | 34,38–34,67 ms | 34,66–34,95 ms | 0–1 / 4–6 |
| Zoom 100% | Zoom | 20,09–20,75 ms | 19,95–20,61 ms | 280–285 / 284–285 |
| Zoom 100% | Arraste de cartão | 23,47–24,00 ms | 22,33–23,85 ms | 45–60 / 20–44 |

A primeira versão desenhava a imagem SVG do ícone em cada cartão: com o quadro inteiro na tela, o
p95 do pan foi a 43,41–45,61 ms e o perfil de CPU mostrou `drawImage` como o maior custo. O ícone
passou a ser rasterizado uma vez por ícone e cor num bitmap de 64 px, e deixa de ser desenhado abaixo
de 3 px na tela, como o texto. A textura também não é desenhada em cartões com menos de 48 px de
altura na tela. Com isso o p95 ficou no máximo 0,4 ms acima da base, dentro do limite de 1 ms do #72.
Os quadros perdidos no pan subiram (de 55–70 para 79–85 com o quadro inteiro e de 0–1 para 4–6 a
100%), então o critério "nenhum gesto com mais quadros perdidos" não foi atingido no pan; no arraste
eles caíram. Os contornos ficam em cache por silhueta e tamanho, e os ladrilhos de textura são os
mesmos do grafo (no máximo 34). Heap após GC e tela física não foram medidos.

## Caches por objeto e itens fora da vista · 26/11/2026

Build de produção Next.js 16.3.4, Windows, Edge (Chromium) em modo headless a 1.440 × 900 e
DPR 1, com `PERSISTENCE_DRIVER=filesystem` e o mundo sintético gerado por
`scripts/seed-board-stress.test.ts` numa pasta temporária: 500 registros e um quadro com 300
cartões, 300 setas ligadas entre eles, 200 notas, 200 formas, 200 desenhos livres, 100 textos e
100 linhas. O ensaio usa `scripts/board-profile.mjs`: três repetições de 10 s por gesto,
intervalos de `DrawFrame` no trace, gravações bloqueadas. Pan é a roda do mouse; zoom, a roda
com Ctrl; o arraste move um cartão com setas ligadas (o script confirma que o cartão se moveu
pelo salvamento disparado). A versão "antes" é o commit `2730588`, construída numa cópia
separada do repositório e medida com o mesmo protocolo.

| Vista | Gesto | Antes (p95) | Depois (p95) |
| --- | --- | ---: | ---: |
| Quadro inteiro (1.400 itens na tela) | Pan | 32,0–34,8 ms | 17,5–22,2 ms |
| Quadro inteiro | Zoom | 37,7–40,6 ms | 14,4–18,0 ms |
| Zoom 100% sobre os cartões | Pan | 29,7–32,1 ms | 14,9–15,2 ms |
| Zoom 100% | Zoom | 38,2–40,0 ms | 15,2–15,5 ms |
| Zoom 100% | Arraste de cartão | 37,8–42,0 ms | 12,3–13,6 ms |

O perfil de CPU mostrou que cada quadro recalculava tudo para todos os itens: busca linear da
forma por ID (cerca de 2 milhões de comparações por quadro), contorno do perfect-freehand,
traço desenhado à mão, geometria das setas e quebra de linhas com `measureText`. Mudanças:

- índice de formas por ID, refeito só quando a lista muda;
- molduras, contornos, traços, rótulos e linhas quebradas em cache por objeto (as formas são
  imutáveis); a geometria de uma seta é refeita só quando ela ou uma forma ligada a ela muda;
- itens fora da vista (com folga para sombras e rótulos) ficam invisíveis para o Konva;
- texto com menos de 3 px na tela não é desenhado, o que não muda o que se vê;
- o filtro de cor da imagem do cartão é aplicado uma vez por imagem, não a cada quadro.

Todos os gestos ficaram dentro da meta de p95 ≤ 20 ms, exceto uma das três repetições de pan
com o quadro inteiro na tela (22,2 ms). O filtro das imagens não entrou na medição, porque os
cartões sintéticos não têm imagem. Latência em tela física, trackpad e toque reais continuam
sem medição.
