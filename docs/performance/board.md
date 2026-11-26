# Quadro de investigação: desempenho

> **Estado:** histórico · **Última verificação:** 26/11/2026, build de produção em Edge headless
> com o quadro sintético de 1.400 itens; cada seção traz a própria data e protocolo.

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
