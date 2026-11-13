# Calendário em produção

Medição de 13/11/2026 no Windows 10.0.26200, AMD Ryzen 7 5700U, Node 24.21.0 e
Next.js 16.3.4. O servidor rodou via `pnpm build` e `pnpm start`, em loopback, com
`WIKI_WORKSPACE_DIR` apontando para um diretório sintético. Chrome 157.0.8103.78 e Edge
157.0.4341.46 foram usados sem limitação artificial de CPU ou rede. A largura de
360 px foi emulada. A latência em dispositivos reais pode ser diferente.

## Navegação e imagem

O mundo de teste tinha 11 meses, cinco luas, estações, marcos e uma imagem de fundo
enviada pelo upload do calendário. Foram alternados os dias 15 e 16, já visitados,
em 14 cliques por navegador e largura. O tempo vai do clique à atualização do detalhe
do dia mais dois quadros de animação do navegador. O p95 usa o posto mais próximo e,
com 14 amostras, coincide com o maior valor observado.

| Navegador | 1440 px, p95 | 360 px, p95 | Upload de PNG de 208.230 bytes |
| --- | ---: | ---: | ---: |
| Chrome | 163,5 ms | 158,5 ms | 875 ms |
| Edge | 164,6 ms | 164,1 ms | 750 ms |

- O mês de 28 dias montou 28 links e 992 elementos em `main`, nas três larguras. No
  mundo com um mês de 1.000.000 de dias, as janelas inicial e final montaram 36 e 28
  links respectivamente, dentro do teto de 42.
- A variante móvel usada em 360 px teve 22.808 bytes, abaixo da meta de 350 KB nesta amostra.
  A imagem de origem tinha 360 px de largura, e ambas as variantes ficaram com o mesmo
  tamanho. O teste confirma a escolha da URL de variante e não estima o peso de imagens maiores.
- Com a imagem bloqueada inicialmente e carregada em seguida, o topo da grade variou
  0 px em 1440 e 360 px. Não houve entradas de `layout-shift` nesses dois ensaios.
- A primeira resposta do mês em uma navegação direta, antes da série, levou 1.509 ms
  no Chrome com o processo recém-iniciado e 107 ms no Edge com o processo já usado.
  Uma troca para um mês ainda não visitado pelo cliente levou 152 ms no Chrome.
  O cache de disco do Windows não foi limpo e a pré-busca do Next.js permaneceu ativa.

## Leitura da agenda

O benchmark opt-in comparou o caminho anterior, que lê e valida todos os registros a
cada consulta, com a projeção em memória da Agenda. Os arquivos foram gerados pouco
antes do teste. Na primeira consulta da projeção para 5.000 registros, os primeiros
500 já estavam na memória do processo. As medidas de repositório excluem o navegador.

| Registros | Eventos | Varredura anterior, três consultas | Projeção, primeira consulta | Projeção, duas consultas seguintes |
| ---: | ---: | --- | ---: | --- |
| 500 | 50 | 534,1 / 458,5 / 446,7 ms | 882,9 ms | 216,5 / 153,6 ms |
| 5.000 | 500 | 5.601,2 / 5.975,9 / 4.734,3 ms | 4.037,8 ms | 631,6 / 620,5 ms |

A agenda com 5.000 registros permanece acima de 200 ms nas leituras medidas. O custo
inclui conferir os metadados no disco para detectar edições externas, importações e
exclusões. O teste de repositório cobre redatação, edição externa e exclusão. Para
repetir a comparação, use o [comando do benchmark](calendar-metadata-baseline.md#repetir).

## Verificação funcional

Chrome e Edge foram exercitados em 360, 768 e 1440 px, com as vistas Mês, Ano e Agenda,
tema Celeste na paleta clara da época, tema personalizado escuro e preferência de movimento reduzido.
A revisão conferiu largura útil, entrada única na sequência de Tab, setas, foco
visível, Enter e histórico do navegador. A árvore de acessibilidade expôs o dia, as
fases das luas e os controles. A confirmação de fala em leitor de tela e os testes em
dispositivo móvel físico ou em motores fora do Chromium permanecem pendentes.
