# Grafo de relacionamentos: verificação e desempenho

> **Estado:** histórico · **Última verificação:** 27/11/2026, build de produção em Chrome headless
> com 500 registros e 1.500 vínculos sintéticos; cada seção traz a própria data e protocolo.

## Silhuetas por tipo · 27/11/2026

Medição da fatia 2 do #72 ([ADR-011](../architecture/ADR-011-entity-type-visuals.md)): cada cartão
passa a traçar a silhueta do seu tipo, no cartão individual, no lote do zoom afastado e no anel de
destino. Mesmo ambiente da medição de 25/11 (Windows, Ryzen 7 5700U, Next.js 16.3.4), Chrome
158.0.8127.88 headless a 1.440 × 900 e DPR 1. O mundo sintético de 500 registros e 1.500 vínculos foi
gerado com `RELATIONSHIP_STRESS_TYPES=all`, que distribui os registros pelos 17 tipos do mundo
semente, para todas as silhuetas aparecerem.

O ensaio usa `scripts/relationship-graph-profile.mjs` com três repetições de 10 s por gesto, depois
de uma rodada de aquecimento. O layout atual preenche o meio do canvas, então o script passou a
procurar o ponto vazio do pan também nas margens; base e versão nova começaram o pan no mesmo ponto.
A base é o commit `b2e375a`, que desenha o cartão retangular de antes. A versão nova foi medida
duas vezes, a segunda depois de recompilar e com aquecimento.

| Versão | Pan p95 | Zoom p95 | Arraste p95 | `DroppedFrame` pan / zoom / arraste |
| --- | ---: | ---: | ---: | --- |
| Base (`b2e375a`) | 17,48–17,59 ms | 20,24–20,62 ms | 17,22–17,68 ms | 0–1 / 6–11 / 0–2 |
| Silhuetas, 1ª série | 17,69–17,74 ms | 20,13–20,30 ms | 17,18–17,52 ms | 0 / 8–9 / 1–34 |
| Silhuetas, 2ª série | 17,66–17,77 ms | 20,43–20,94 ms | 17,16–17,72 ms | 0 / 8–15 / 0–3 |

O p95 piorou no máximo 0,3 ms em pan e zoom e ficou igual no arraste, dentro do limite de 1 ms do
#72. O p50 ficou em 16,6–16,9 ms nas três séries. A contagem de quadros perdidos variou mais entre
repetições da mesma versão do que entre as versões: o pico de 34 no arraste apareceu só na primeira
repetição da 1ª série, sem aquecimento, e não se repetiu na 2ª. O lote continua com dois
preenchimentos por quadro, porque todas as silhuetas cabem num só caminho, e o clique continua
usando o retângulo da caixa. O ensaio não mede tela física, trackpad ou toque reais.

## Desenho em lote e hit graph sob demanda · 25/11/2026

Build de produção Next.js 16.3.4, Windows, Ryzen 7 5700U, Chrome em modo headless a
1.440 × 900 e DPR 1, com o mundo sintético de 500 registros e 1.500 vínculos gerado por
`scripts/seed-relationship-stress.test.ts` e `PERSISTENCE_DRIVER=filesystem`. O ensaio usa
`scripts/relationship-graph-profile.mjs`: três repetições de 10 s por gesto, intervalos de
`DrawFrame` no trace. O protocolo difere do ensaio de 17/11 (outro gerador de entrada e outro
ponto de partida de cada gesto), então a comparação vale entre as linhas desta tabela.

| Versão | Pan p95 | Zoom p95 | Arraste p95 |
| --- | ---: | ---: | ---: |
| Antes (commit `81f8226`) | 67,0–67,3 ms | 65,1–65,6 ms | 17,2–18,0 ms |
| Hit graph sob demanda e nós fora da tela removidos da camada | 17,8–18,3 ms | 31,6–33,1 ms | 17,3–17,8 ms |
| Cartões em lote abaixo do zoom dos títulos | 17,4–17,6 ms | 20,0–20,7 ms | 17,2–17,3 ms |

O perfil de CPU apontou dois custos: o Konva redesenhava o hit graph das duas camadas a cada
quadro e percorria cerca de 17 mil nós para limpar caches de transformação a cada mudança de
câmera, inclusive nós escondidos. Agora o hit graph é redesenhado só antes de um teste de ponteiro,
nós fora da área visível saem da camada, os vínculos usam o desenho em lote quando há mais de 300
na área visível (saindo abaixo de 220) e os cartões ociosos viram um único caminho abaixo do zoom
em que os títulos somem. O desenho em lote mantém as pontas de direção.

Pan e arraste ficaram dentro da meta de p95 ≤ 20 ms; o zoom ficou no limite (20,0–20,7 ms). A
latência entrada → pixel em tela física, trackpad e toque reais continuam sem medição.

## Validação da versão com pastas · 17/11/2026

Build de produção Next.js 16.3.4 (Webpack), Windows, Ryzen 7 5700U e Chrome
157.0.8103.78 em modo headless. Foram usados mundos sintéticos separados da demonstração.
No cenário pequeno, passaram a criação e renomeação de pastas, a movimentação em lote de tipos
mistos, o indicador de vínculos externos, a busca, a recarga, a abertura da ficha pelo teclado,
a exclusão e o recolhimento por toque emulado. Também passaram a pinça emulada e o reenvio
após falha de salvamento simulada. TypeScript, ESLint dos arquivos do grafo e o build passaram.
A suíte registrou 268 testes aprovados e um ignorado.

No mundo denso, **Ida**, **Volta** e **Ambos** mostraram os vínculos esperados. Com a rede
externa bloqueada, o grafo abriu e permitiu selecionar um vínculo. No mundo pequeno, verifiquei
que o cartão voltou à pasta e que o vínculo reapareceu quando o registro sintético retornou do
diretório da lixeira. A restauração foi simulada no filesystem da fixture.

A árvore de acessibilidade do Chrome expôs o painel de pastas, os nomes dos campos e botões,
o estado expandido, a seleção de registros, a contagem de resultados como `status` e a falha
de salvamento como `alert`. A navegação confirmou Tab, Enter, Espaço, Esc e devolução do foco
aos botões Pastas e Mais. A inspeção visual cobriu os temas claro e escuro, com o mundo pequeno
e vazio em 1.440 e 390 CSS px. O painel Pastas também coube na largura de 320 CSS px.
A fala de um leitor de tela, o zoom nativo do navegador e gestos em trackpad e tela de toque
físicos continuam pendentes.

No cenário integral com 500 registros e 1.500 vínculos, sem pastas, o Chrome repetiu cada gesto
por 10 s, três vezes, a 1.440 × 900 e DPR 1. Os intervalos são de `DrawFrame` no compositor.
O intervalo da tabela reúne o menor e o maior valor das três repetições.

| Gesto | p50 | p95 | `DroppedFrame` por repetição |
| --- | ---: | ---: | ---: |
| Pan | 33,93–34,54 ms | 39,98–41,14 ms | 315, 309, 307 |
| Zoom | 35,14–38,98 ms | 52,22–53,08 ms | 212, 184, 206 |
| Arraste | 24,53–24,71 ms | 29,17–30,63 ms | 196, 191, 192 |

Os três gestos ficaram acima da meta de p95 ≤ 20 ms. A duração p95 das entradas `EventLatency`
associadas a um identificador de frame no trace variou entre 81,25 e 84,31 ms no pan, 82,75 e
91,33 ms no zoom e 71,36 e 73,43 ms no arraste. Esse dado do navegador headless é complementar.
A medição de entrada até a alteração visível do cartão ou da seleção em uma tela física segue pendente.

Em 20 ciclos de saída e retorno ao mundo pequeno, o número de Stages alternou entre zero e um
e os sete tipos de listener conferidos mantiveram a mesma contagem. O heap após GC passou de
6,91 para 9,19 MB. Em outros 20 ciclos no mundo denso, Stage e listeners mantiveram o mesmo
comportamento e o heap passou de 21,90 para 25,33 MB. O trace denso registrou zero `DrawFrame`
durante 2 s de ociosidade. A medição de heap inclui a aplicação e o cache de navegação.

Na abertura do mundo denso, o primeiro byte chegou em 32–50 ms e o HTML terminou em 448–549 ms.
Entre o fim do HTML e a primeira detecção da cena pronta no DOM passaram 1.616 ms com cache
frio e 763–856 ms em três recargas com cache já preenchido. Essa medida usa sondagem a cada
100 ms e inclui carga de scripts, hidratação e criação da cena. O ensaio não isolou o instante
em que os dados ficaram disponíveis para o cliente.

## Canvas de área útil · 16/11/2026

Build de produção no Windows (Ryzen 7 5700U, Chrome 157.0.8103.78 em modo headless).
A fixture densa tem os mesmos 500 registros e 1.500 relações da verificação anterior. Os cenários
pequeno e vazio são derivados da fixture, com vínculos paralelos, direções opostas e uma
auto-relação no cenário pequeno. Nenhuma verificação usa dados reais.

| Viewport CSS | Retângulo do canvas (x, y, largura × altura) | DPR |
| --- | --- | --- |
| 1440 × 900 | 256, 0, 1184 × 900 | 1 |
| 1280 × 720 | 256, 0, 1024 × 720 | 1 |
| 390 × 844 | 0, 56, 390 × 788 | 2 |
| 844 × 390 | 256, 0, 588 × 390 | 2 |
| 844 × 390, ponteiro de toque emulado | 0, 56, 844 × 334 | 2 |

O host e o canvas coincidiram com a área principal, sem rolagem do documento. Os botões das barras
mediram 44 CSS px. A troca entre tamanhos preservou o centro no mundo e o zoom. O canvas manteve
a mesma Stage e câmera ao abrir painéis e aplicar e limpar busca sem correspondências.

Na inspeção visual foram usados tema escuro e claro, desktop e celular emulado, com os cenários
pequeno, denso, vazio, filtrado e selecionado. No build de produção, o teste de navegador percorreu
busca e paginação, criação por arraste de porta, edição e remoção confirmada de vínculo. Também
confirmou recarga de uma seta livre, gravação da posição ao soltar, conflito de revisão entre
duas abas e restauração da organização. Esses fluxos terminaram sem exceções de JavaScript.
Também passaram foco de teclado, retorno de foco do seletor, falha de salvamento simulada e
reenvio, e pinça emulada pelo Chrome.

O layout usa componentes conexos e percorre seus registros por vizinhança. Comparado à grade
anterior na fixture densa, o comprimento mediano entre centros caiu de 3.369 para 2.261 unidades
de mundo; a média caiu de 2.796 para 2.557, enquanto o p95 subiu de 4.827 para 5.653. A distância
ajuda a descrever o arranjo; não mede cruzamentos, legibilidade ou custo de desenho.

### Protocolo de interação

Comparação do commit `0219e44` com o canvas novo na mesma máquina e no mesmo Chrome. Ambos foram
compilados em produção, com viewport de 1440 × 900 a DPR 1. O commit anterior desenha em uma região
de 480 CSS px de altura dentro da página; o canvas novo ocupa 1184 × 900. As diferenças de área e
de enquadramento são parte da comparação. Após enquadrar o mundo inteiro, o ensaio envia pan
no fundo, roda sobre o centro e arraste de um cartão. São três repetições de 10 s por gesto.

Os números usam eventos `DrawFrame` da trilha de composição do Chrome e contam os registros
`DroppedFrame`. A entrada do CDP aguarda a confirmação do navegador antes de enviar o próximo
evento; a cadência varia com a carga. O ensaio é comparativo em modo headless; não mede a
apresentação em um monitor físico nem substitui a medição de latência entrada → pixel.

| Gesto | p95 anterior, intervalo das 3 repetições | p50 novo | p95 novo |
| --- | ---: | ---: | ---: |
| Pan | 64,46–80,11 ms | 17,39–19,40 ms | 33,67–34,14 ms |
| Zoom | 98,11–161,97 ms | 33,93–34,06 ms | 51,00–51,48 ms |
| Arraste | 49,08–70,55 ms | 16,74–16,79 ms | 33,11–33,14 ms |

O desenho em lote reduziu o custo da visão geral: antes dele, o p95 no canvas integral era de
81,66–105,71 ms em pan, 70,93–100,07 ms em zoom e 70,92–92,41 ms em arraste. A
[série por repetição](relationship-graph-traces.json) inclui os eventos descartados. A meta
proposta de p95 ≤ 20 ms ainda não foi atingida neste ensaio.

Os traces comparativos e os ciclos abaixo foram coletados antes do ajuste que passou a carregar
o player da trilha apenas quando solicitado. A cena e o algoritmo medidos permanecem os mesmos.
No build final, o navegador abriu o grafo, desenhou e selecionou um vínculo na visão geral com a
rede externa bloqueada. Nenhuma requisição externa foi registrada até abrir o seletor da trilha;
nesse momento o navegador tentou carregar a API do YouTube e o bloqueio do ensaio impediu a conexão.

Em 20 ciclos de navegação, com busca e painéis no mundo pequeno, o número de Stages alternou entre
zero e um e as contagens dos listeners de janela conferidos ficaram iguais. O heap após GC foi
de aproximadamente 7,03 MB para 9,14 MB; o ensaio não isolou cache de navegação da aplicação e não
exclui retenção. A latência entrada → pixel, abertura separada por fases, heap no mundo denso,
zoom nativo do navegador, toque/trackpad físicos e leitor de tela seguem sem validação.

## Primeira verificação densa (histórico)

Verificação em **16/11/2026**, com build de produção local e um mundo exclusivamente sintético:
500 registros, 1.500 relações, três tipos de relação e dois tipos de item. A distribuição e as
conexões são definidas por `scripts/relationship-stress-fixture.ts`; não há dados reais no teste.

Na primeira inspeção, a organização automática em quatro colunas excedeu a altura do canvas mesmo
após enquadrar. A lista HTML apresentava todos os 500 itens e 1.500 vínculos simultaneamente. Após
o ajuste, uma grade adaptativa mostrou o conjunto dentro da área do canvas e as listas passaram a
exibir até 50 entradas por página. No navegador, foram conferidos a página inicial com as contagens,
o enquadramento visual, a seleção de vizinhança e o avanço para a segunda página de itens. A
visualização integral ainda é densa: busca e vizinhança continuam úteis para examinar detalhes.

Três requisições HTTP locais sequenciais para `/relationships`, medidas com `Stopwatch` e
`Invoke-WebRequest`, responderam com status 200 em **798, 397 e 399 ms**, com resposta de 482.313
bytes em cada tentativa. São tempos observados de resposta e transferência neste computador; não
medem hidratação, desenho, quadros por segundo, latência de pan, zoom ou seleção. Não há comparação
numérica anterior equivalente nem meta de desempenho estabelecida.

O teste `src/domain/relations/relationshipStress.test.ts` confere as contagens, índices, expansão
completa e coordenadas finitas. Para reproduzir a inspeção, crie uma pasta temporária ainda
inexistente (o comando não sobrescreve uma pasta existente):

```powershell
$env:RELATIONSHIP_STRESS_ROOT = Join-Path $env:TEMP ("canon-graph-stress-" + [guid]::NewGuid())
pnpm exec vitest run --config scripts/vitest.relationship-stress.config.mts
$env:WIKI_WORKSPACE_DIR = $env:RELATIONSHIP_STRESS_ROOT
pnpm build
pnpm start --port 3211
```

Abra `http://localhost:3211/relationships`. A geração recusa caminhos fora do diretório temporário.
Não execute esses comandos com o diretório privado `workspace/` como destino.

Naquela versão ainda não havia medição de abertura ou interação no canvas, memória ou avaliação
de desenho por área visível e nível de detalhe.
