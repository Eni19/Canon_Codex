# Quadros, cenas e projeção

## Quadro de investigação

1. Abra `/boards`.
2. Preencha título, descrição e tags e escolha **Criar quadro**.
3. No canvas, adicione entidades pela busca, pelo botão ou arrastando-as para a mesa.
4. Selecione um cartão para escolher visualização mínima, cartão, retrato, dossiê ou, para locais,
   local amplo; altere imagem, tipo, status, tags e rótulo personalizado.
5. O estado do canvas é salvo automaticamente por `PUT /api/boards/<boardId>` após uma pequena
   espera; o indicador mostra salvo, salvando ou erro.

O quadro mantém um snapshot tldraw e uma sessão auxiliar no `localStorage` do navegador. O cartão
continua guardando o ID mesmo se a entidade for movida para a lixeira; nesse caso o canvas sinaliza
que ela está indisponível. Excluir um quadro move sua pasta para a lixeira do mundo.

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

O snapshot e a grade são salvos por `PUT /api/scenes/<sceneId>`. **Duplicar** cria uma nova cena com
novo ID e mantém o mesmo fundo, local, snapshot e configurações de grade. **Excluir** move a pasta
para `trash/` e não oferece restauração na interface.

## Apresentar e projetar

Há dois fluxos:

- Em uma entidade, clique **Projetar** para abrir `/display/entity/<entityId>` em uma janela popup.
- Em uma cena, clique **Projetar cena**. O mestre abre uma janela `/projection/<sessionId>` e
  transmite ao vivo por `BroadcastChannel` do navegador. A janela do jogador também pode ser
  simulada por **Prévia do jogador**.

O estado enviado contém somente tokens e pontos de interesse visíveis. A projeção é local entre
janelas do mesmo navegador/origem; não há sessão persistida ou transmissão para a rede. Se a janela
perder uma revisão, solicita um estado completo. Fechar ou encerrar a projeção interrompe o canal.

## Limitações

- O recurso depende de popup permitido pelo navegador e de duas janelas na mesma origem.
- Não há gravação de uma sessão de narração, controle remoto ou presença de jogadores.
- `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` é lida pelos componentes tldraw, mas não está declarada em
  `.env.example`; sua necessidade/licenciamento permanece uma lacuna de configuração registrada em
  [work-items.md](../work-items.md).
