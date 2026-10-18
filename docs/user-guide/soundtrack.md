# Trilha sonora

A trilha sonora (`/soundtrack`) reúne playlists de links do YouTube que tocam dentro do site, para
ambientar mistério, investigação, combate, melancolia e o que mais a mesa precisar. Só os links (id,
título e autor) são guardados; nenhuma música é baixada e a reprodução exige internet.

## Criar uma playlist

1. Abra **Trilha sonora** na barra lateral (seção Ferramentas).
2. Preencha nome, descrição e etiquetas em **Nova playlist**. Cada mundo tem as suas playlists.

## Adicionar músicas

Na página da playlist, cole um ou mais links do YouTube (um por linha) em **Adicionar faixas**:

| Link | Resultado |
| --- | --- |
| `youtube.com/watch?v=…`, `youtu.be/…`, `shorts/…` | Adiciona só aquela faixa. |
| `youtube.com/playlist?list=…` | Adiciona todas as músicas da playlist, uma a uma. |
| `watch?v=…&list=…` | Adiciona só o vídeo (para importar tudo, use o link `/playlist`). |

Faixas repetidas são ignoradas. Vídeos privados, removidos ou com incorporação desativada não podem
tocar no site e são descartados na importação, com um aviso. A playlist do YouTube precisa ser
pública ou não listada.

## Tocar

Clique numa faixa, em **Tocar tudo** ou em **Aleatório**. O player fica no rodapé da barra lateral e
**continua tocando quando você troca de página**, inclusive entre quadros e cenas: play/pausa,
anterior/próxima, barra de progresso, volume, aleatório e repetição (desligada, playlist ou faixa).
Se uma faixa não puder tocar, o site avisa e passa para a próxima. Com a barra lateral recolhida o
vídeo diminui para uma miniatura, mas continua visível. O volume é lembrado neste navegador.

O botão de trocar de Codex (`/`) e o recarregamento da página interrompem a música.

## No Scene Runner (aba Mestrar)

A aba **Mestrar** tem uma seção **Trilha sonora** no painel lateral: faixa atual, anterior/play/próxima,
aleatório, volume e **Playlists e faixas**, que abre um navegador com todas as playlists do mundo
para tocar outra playlist inteira ou uma faixa específica sem sair da cena. O mesmo navegador abre
pelo rodapé da barra lateral em qualquer página. A música continua ao trocar de cena.

## Música pela projeção

Quando a janela de projeção (**Projetar cena**) está conectada, ela é quem toca a música: assim, ao
compartilhar essa janela ou aba com áudio (Discord, Meet…), quem assiste também ouve. O player da
janela do mestre continua rodando, mas **mudo**, para nada tocar em dobro; se a projeção fechar, ele
volta a tocar sozinho. O volume é o do controle do mestre.

- A projeção mostra um pequeno player no canto inferior esquerdo com o título da faixa. Dá para
  tirá-lo da tela em **Mostrar o player na projeção** (rodapé da barra lateral); a música continua.
- A projeção não termina ao trocar de cena ou de página, então a música também não para.
- Se o navegador bloquear o áudio na janela de projeção, ela mostra o botão **Clique para ativar o
  áudio da trilha**; um clique resolve até a janela ser reaberta.
- Ao compartilhar uma **aba** do Chrome, marque "compartilhar áudio da aba". Compartilhar a tela
  inteira também leva o áudio do sistema.

## Onde ficam os dados

`workspace/worlds/<mundo>/playlists/<id>/playlist.json` (versão de esquema 1). Excluir uma
playlist a move para `trash/` do mundo. Ver [armazenamento](../data/storage.md).
