# Guia de uso

O Canon Codex é uma aplicação local. O fluxo normal é: escolher um Codex na biblioteca, criar
registros, enriquecer o conteúdo, conectar referências e, quando necessário, preparar um quadro ou
uma cena para apresentação.

## Atalhos de navegação

| Objetivo | Caminho |
| --- | --- |
| Biblioteca de Codex | `/` |
| Início do mundo ativo | `/codex` |
| Consulta mensal, anual e agenda de Eventos; configuração do calendário | `/calendar` |
| Todos os registros | `/all` |
| Catálogo de um tipo | `/<entityType>` |
| Nova entidade | `/<entityType>/new` |
| Leitura/edição | `/entity/<entityId>` e `/entity/<entityId>/edit` |
| Quadros | `/boards` |
| Cenas | `/scenes` |
| Trilha sonora | `/soundtrack` |

Os links da barra lateral mostram apenas tipos cujo `showInSidebar` é verdadeiro; tipos ocultos
continuam acessíveis por referências ou pela URL direta quando existem.

## Caderno do Codex (experimental)

O início do mundo (`/codex`) é um caderno em 3D. Fechado, ele mostra a capa com o
nome do mundo e, por cima, o papel do índice. Clique no caderno (ou em **Abrir o Codex**, ou tecle
`Enter`) para abri-lo: o índice desliza para o lado do livro e a capa se abre, levando a primeira
página junto.

Cada página dupla é uma área:

- **Prefácio**: a descrição do mundo, a contagem de registros, os registros recentes e os tipos com
  mais registros.
- **Uma página por tipo** que aparece na barra lateral: o nome, quantos registros há, **ver todos**,
  **+ novo registro** e polaroids dos quatro registros mais recentes, com a imagem de capa.
- **Ferramentas**: Calendário, Relacionamentos, Quadros, Cenas, Trilha sonora e Todos os conteúdos.

Para virar, arraste a página, clique nela (fora dos links), use as setas desenhadas nos cantos
(**continue** e **voltar**), as setas do teclado ou uma linha do índice ao lado do livro. Clicar fora
do caderno, a seta **fechar** da primeira página ou `Esc` fecham o caderno. Depois de abrir um
registro a partir do caderno, o botão voltar do navegador reabre o caderno na mesma página. Para
abrir direto numa página, use `/codex?pagina=<tipo>` (por exemplo, `?pagina=character`).

## Fluxo recomendado

1. [Crie, importe ou selecione um mundo](worlds.md).
2. [Crie e edite entidades](entities.md), começando pelo título, tags e campos específicos.
3. Use o [editor](editor.md) para páginas, blocos, imagens e links internos.
   Para datas ISO antigas, siga a [conversão por mundo](../data/migrations.md#datas-de-propriedades-durante-a-transição).
4. Para investigação ou narração, siga [quadros, cenas e projeção](boards-scenes-and-projection.md).
5. Para organizar registros por data, siga o [guia de Linhas do Tempo](timelines.md).
6. Para ambientar a mesa, monte playlists na [trilha sonora](soundtrack.md).

Exemplos deste guia usam nomes sintéticos como `Arquivo de Teste`, `Biblioteca Norte` e
`Personagem Exemplo`; nenhum conteúdo real de `workspace/` é necessário.
