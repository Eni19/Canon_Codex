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

O quadro mantém um snapshot tldraw e uma sessão auxiliar no `localStorage` do navegador. O cartão
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
artefato. Você pode mover, redimensionar, alternar entre recorte e círculo, inverter, travar,
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
- O canvas das cenas não usa tldraw e funciona fora de `localhost` sem chave.
- `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` é lida pelo tldraw dos Quadros, mas não está declarada em
  `.env.example`; sua necessidade/licenciamento permanece uma lacuna de configuração registrada em
  [#16](https://github.com/Eni19/Canon_Codex/issues/16).
