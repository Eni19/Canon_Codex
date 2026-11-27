# Quadros, cenas e projeção

> **Estado:** implementado · **Última verificação:** 26/11/2026, rótulos em negrito e rotas contra
> `src/`.

## Quadro de investigação

1. Abra `/boards`.
2. Preencha título, descrição e tags e escolha **Criar quadro**.
3. No canvas, adicione registros pela busca, pelo botão ou arrastando-os para a mesa.
4. Selecione um cartão para escolher visualização mínima, cartão, retrato, dossiê ou, para locais,
   local amplo; altere imagem, tipo, status, tags e rótulo personalizado.
5. O estado do canvas é salvo automaticamente por `PUT /api/boards/<boardId>` após uma pequena
   espera; o indicador mostra salvo, salvando ou erro.

### Mexer no canvas do quadro

O canvas é infinito e funciona como o editor anterior (tldraw). Ferramentas na barra de baixo:

| Ferramenta | Atalho | Uso |
| --- | --- | --- |
| Selecionar | **V** | clique, **Shift** + clique, arraste numa área vazia para selecionar várias |
| Mão | **H** | arrasta a vista (também: espaço + arraste ou botão do meio) |
| Desenho | **D** (ou **B**, **X**) | desenho livre; terminar perto do começo fecha o traço |
| Borracha | **E** | arraste sobre itens para apagá-los ao soltar, ou clique num item |
| Seta | **A** | arraste de um ponto a outro; sobre um cartão, a ponta fica ligada a ele |
| Texto | **T** | clique para um texto que cresce sozinho; arraste para criar uma caixa de texto com largura e altura, como um retângulo (as linhas quebram dentro dela e as bordas e cantos a redimensionam sem mudar a letra); clique duplo numa área vazia também cria texto |
| Nota | **N** | clique para colar uma nota e escrever nela; ela cresce com o texto |
| Imagem | **Ctrl U** | escolhe arquivos; também dá para arrastar imagens para a mesa ou colá-las |
| Quadrado e círculo | **R**, **O** | arraste para desenhar (**Shift** mantém a proporção) ou clique para o tamanho padrão |
| Linha | **L** | arraste de um ponto a outro; as pontas da linha selecionada são alças |

| Ação | Como |
| --- | --- |
| Mover | arraste; **Shift** trava em um eixo; **Alt** ao arrastar duplica; setas do teclado movem 1 px (10 px com **Shift**) |
| Redimensionar e girar | alças dos cantos e bordas (**Shift** mantém a proporção, **Alt** escala pelo centro); arraste logo fora de um canto para girar |
| Seta | arraste as pontas para ligar ou soltar; a alça do meio curva a seta; clique duplo ou **Enter** edita o rótulo |
| Texto | clique duplo ou **Enter** edita textos, notas, formas e rótulos de seta; **Esc** termina; texto vazio some |
| Desfazer, refazer | **Ctrl Z**, **Ctrl Shift Z** (ou **Ctrl Y**), também pelos botões no alto |
| Duplicar, copiar, recortar, colar | **Ctrl D**, **Ctrl C**, **Ctrl X**, **Ctrl V**; texto comum colado vira uma caixa de texto |
| Excluir | **Delete** ou **Backspace**; setas ligadas ao item apagado ficam com a ponta solta |
| Ordem | **]** traz para a frente, **[** manda para trás, com **Alt** um passo |
| Travar | **Shift L** trava os itens selecionados, que deixam de ser selecionáveis |
| Selecionar tudo | **Ctrl A** |
| Zoom | **Ctrl** + roda ou pinça; **Ctrl =** e **Ctrl -** (ou **=** e **-**); **Shift 1** enquadra tudo, **Shift 2** a seleção, **Shift 0** volta a 100% |
| Ficha rápida | clique duplo num cartão |

Ao escolher a ferramenta de desenho, seta, texto, nota, quadrado, círculo ou linha (ou clicar nela
de novo), um menu abre acima do botão com 13 cores (nas notas, a cor do papel) e 4 espessuras (no
desenho, a espessura da caneta; em textos e notas, o tamanho da letra). Ele fecha depois da escolha,
com **Esc** ou com um clique fora. A escolha vale para os itens selecionados e para os próximos. Preenchimento, tipo de traço e fonte
ainda usam o padrão do tldraw. Marca-texto, laser e moldura não fazem parte do quadro, e as formas
além de quadrado, círculo e linha não podem ser criadas; as que vieram do editor anterior
continuam aparecendo. Desenhos livres criados no editor anterior aparecem como uma caixa tracejada e
são preservados.

O quadro guarda o canvas por `PUT /api/boards/<boardId>` e a posição da câmera no `localStorage`
do navegador. Quadros do editor anterior abrem normalmente e passam ao formato novo no primeiro
salvamento, com o original guardado dentro do próprio quadro
([detalhes](../data/migrations.md#canvas-do-quadro-snapshot-tldraw--canon-board-canvas-v1)). O cartão
continua guardando o ID mesmo se o registro for movido para a lixeira; nesse caso o canvas mostra
**Entidade indisponível**. Excluir um quadro move sua pasta para a lixeira do mundo.

## Criar uma cena

1. Antes, edite um **Local** e importe ao menos uma imagem de capa ou galeria.
2. Abra `/scenes` e escolha **Preparar nova cena**.
3. Informe nome, local, imagem/mapa, descrição e tags.
4. Escolha **Criar cena**.

A cena guarda o local e o asset de fundo por UUID, além de largura/altura da imagem. Ela começa com
grade quadrada desativada, célula 70, opacidade 0,25 e encaixe desligado.

## Preparar e mestrar

Na cena, use **Preparar** para adicionar tokens de personagem, criatura, organização, evidência e
objeto. Você pode mover, redimensionar, alternar entre recorte e círculo, inverter, travar,
ocultar/revelar, ordenar camadas e configurar a grade. Pontos de interesse vêm dos pontos do local;
no modo **Mestrar**, revele-os individualmente ou todos e revele descobertas progressivamente.

### Mexer no canvas da cena

O canvas da cena reproduz o jeito de mexer do editor anterior:

| Ação | Como |
| --- | --- |
| Selecionar um token | clique; **Shift** + clique acrescenta ou tira da seleção |
| Selecionar vários | arraste a partir de uma área vazia, do fundo ou de um ponto de interesse |
| Mover | arraste o token; **Shift** trava em um eixo; **Alt** ao arrastar duplica |
| Redimensionar | alças dos cantos ou bordas, sempre na proporção; **Alt** escala a partir do centro |
| Girar | arraste logo do lado de fora de um canto; **Shift** encaixa em 15° |
| Empurrar | setas do teclado movem 1 px; com **Shift**, 10 px |
| Excluir | **Delete** ou **Backspace** |
| Cancelar ou limpar a seleção | **Esc** |
| Rolar a vista | roda do mouse ou dois dedos no trackpad; **Shift** + roda rola na horizontal |
| Aproximar | **Ctrl** + roda, pinça no trackpad ou na tela; espaço + arraste ou botão do meio movem a vista |
| Ficha rápida | clique duplo no token ou no ponto (em **Mestrar** e **Apresentar**) |

Com um token selecionado, **F** inverte, **<** e **>** diminuem e aumentam, **H** oculta ou revela e
**L** trava ou destrava. Token travado não muda de tamanho, mas ainda pode ser movido e girado.
Contornos e alças aparecem só em **Preparar**; em **Mestrar** a seleção continua valendo para os
atalhos, mas fica invisível. Pontos de interesse não são selecionáveis: um clique abre a ficha.

O canvas e a grade são salvos por `PUT /api/scenes/<sceneId>`. Cenas criadas com o editor anterior
(tldraw) abrem normalmente e passam ao formato novo no primeiro salvamento; o original fica guardado
dentro da própria cena ([detalhes](../data/migrations.md#canvas-da-cena-snapshot-tldraw--canon-scene-canvas-v1)).
**Duplicar** cria uma nova cena com
novo ID e mantém o mesmo fundo, local, snapshot e configurações de grade. **Excluir** move a pasta
para `trash/` e não oferece restauração na interface.

## Apresentar e projetar

Há dois fluxos:

- Em um registro, clique **Projetar** para abrir `/display/entity/<entityId>` em uma janela popup.
- Em uma cena, clique **Projetar cena**. O mestre abre uma janela `/projection/<sessionId>` e
  transmite ao vivo por `BroadcastChannel` do navegador. A janela do jogador também pode ser
  simulada por **Prévia do jogador**.

O estado enviado contém somente tokens e pontos de interesse visíveis. A projeção é local entre
janelas do mesmo navegador/origem; não há sessão persistida ou transmissão para a rede. Se a janela
perder uma revisão, solicita um estado completo.

A sessão de projeção pertence à janela do mestre, não à cena: **trocar de cena ou de página não a
encerra**. A janela continua conectada e passa a mostrar a nova cena assim que ela abre. Só o botão
**Encerrar projeção** (ou recarregar a janela do mestre) interrompe o canal. Enquanto a projeção
está conectada, a [trilha sonora](soundtrack.md) toca por ela (ver abaixo).

## Limitações

- O recurso depende de popup permitido pelo navegador e de duas janelas na mesma origem.
- Não há gravação de uma sessão de narração, controle remoto ou presença de jogadores.
- Os canvas de quadros e cenas não usam tldraw e funcionam fora de `localhost` sem chave.
