# Grafo de relacionamentos: verificação e desempenho

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
