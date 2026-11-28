# Registros, tipos e relações

> **Estado:** implementado · **Última verificação:** 27/11/2026, rótulos em negrito contra os textos
> de `src/` e silhuetas e texturas dos cartões do grafo em `src/domain/canvas/entitySilhouettes.ts` e
> `src/lib/canvas/entityTextures.ts`.

## Criar e editar

1. Em `/codex`, abra a página do tipo no caderno e clique em **ver todos**, ou abra `/<entityType>`.
2. Clique em **Nova entidade**.
3. Preencha o formulário completo, que é o mesmo da edição: nome, apelidos (quando exibidos) e tags
   no topo; **Ficha** com as propriedades curtas e referências; **Detalhes** com os textos longos;
   o editor específico do tipo, quando existe; e **Conteúdo**. Imagem principal, símbolo (cosmologia),
   cor e status aparecem à direita em telas largas e abaixo do conteúdo em telas estreitas.
4. Escolha **Criar registro**. Para alterar depois, use **Editar** na página e **Salvar
   alterações**. O botão de salvar fica no cabeçalho durante a rolagem. `Ctrl+S` salva nos dois casos.

No celular, os campos da **Ficha** aparecem um abaixo do outro. Em telas maiores, os campos
curtos ocupam duas colunas e as datas e listas de referências ocupam a linha inteira.
Na criação e na edição, as seções seguem a mesma ordem, com o título logo acima dos campos.

Não há mais uma tela intermediária: imagens, conteúdo e editores específicos podem ser preenchidos
antes de o registro existir. A imagem é enviada à biblioteca de assets do mundo assim que é
escolhida (clique ou arraste); se o formulário for abandonado, esse asset fica sem referência no
mundo. Ao trocar ou remover a imagem de um registro salvo, a imagem anterior é apagada quando
nenhum outro registro a usa. A cor escolhida retinge o formulário imediatamente. Se a validação
falhar, a tela leva o foco ao primeiro campo com erro. Por exemplo, se você preencher **Apelidos** e deixar o nome em branco, pode digitar o nome e salvar novamente com os mesmos apelidos. Fechar a aba com
alterações não salvas pede confirmação, assim como **Cancelar**; a navegação pela barra lateral
ainda não pede.

Em **Personagem** e **Criatura**, com uma imagem escolhida, **Ajustar enquadramento** abre uma prévia da página
no tamanho real, com os controles no lugar da barra lateral. Arraste a imagem para movê-la, use a
roda do mouse para aproximar (o ponto sob o cursor fica parado) ou os controles **Horizontal**,
**Vertical** e **Zoom**; com a imagem selecionada, setas movem e `+`/`−` ajustam o zoom.
**Aplicar** guarda o ajuste no formulário, que é gravado ao salvar; **Restaurar padrão** volta à
apresentação original e `Esc` cancela. A prévia usa os valores atuais do formulário, inclusive os
ainda não salvos.

Na criação e na edição, o campo **Nome (obrigatório)** aparece no início da ficha. Para criar um
Personagem, basta preencher o nome e escolher **Criar registro**. O ID é um UUID e não muda quando o título muda; o slug é derivado novamente
do título e não deve ser usado para links. O formulário revalida campos estruturados com Zod antes
de gravar.

Na criação de um **Evento**, informe uma data exata com mês e dia para poder marcar **Evento de
origem**. O sistema coloca essa data no ano zero do mundo. Se já houver um Evento vinculado,
substitua-o pela prévia em **Calendário → Evento de origem**.

Ao criar um Evento, o formulário sugere o Hoje da campanha, quando definido. Ao iniciá-lo pelo
calendário, usa o dia selecionado. O campo pode ser alterado ou limpo, e **Usar hoje da campanha**
preenche novamente uma data. A sugestão é a data apresentada ao abrir o formulário; avançar o Hoje
em outra aba não altera o que já estava preenchido.

## Campos opcionais da ficha

- **Personagem** — Objetivo atual.
- **Caso** — Pergunta central.
- **Pista** — Evidências associadas.
- **Criatura** — Comportamento típico.
- **Evento** — Consequências.
- **Fenômeno** — Condições de manifestação.
- **Objeto** — Efeito conhecido.

Na Pista, selecione evidências do mundo atual. Fichas antigas podem receber os novos valores ao editar.

## Tipos iniciais

O mundo semente define 17 tipos. Casos, Pistas, Fenômenos e Documentos ficam ocultos na navegação principal.

| ID | Nome | Apresentação ou campos destacados |
| --- | --- | --- |
| `character` | Personagem | retrato com enquadramento ajustável, idade, espécie, ocupação, afiliação e local atual |
| `species` | Espécie / Povo | classificação, habitats, idiomas, características e organizações |
| `location` | Local | blueprint/mapa, pontos de interesse e cenas associadas |
| `organization` | Organização | caixa-arquivo, líderes, membros e grupos |
| `case` | Caso | status, data, envolvidos e locais; apresentação genérica |
| `event` | Evento | página padrão, estado, data, local e participantes |
| `tale` | Conto | leitura editorial, capa e até 50 capítulos/páginas |
| `document` | Documento | tipo, autor, data; apresentação genérica |
| `evidence` | Evidência | quadro de evidência, formato, tipo, contexto e descobertas |
| `clue` | Pista | evento relacionado e descobridor; apresentação genérica |
| `creature` | Criatura | natureza, apresentação da imagem, classificação, habitat e perigo |
| `naturalScience` | Natureza / Medicina | disciplina, subtipo, habitat, sintomas, toxicidade e tratamento |
| `phenomenon` | Fenômeno | tipo, primeira observação e locais afetados |
| `artifact` | Objeto | bancada de estudo, tipo, origem, dimensões, conservação e detalhes posicionáveis |
| `concept` | Conceito | texto base e até 40 blocos de referência |
| `cosmology` | Registro Cosmológico | entidade/divindade/reino, domínios, símbolo e artefatos |
| `timeline` | Linha do Tempo | escopo, início e fim; página com vistas vertical e horizontal de aparições |

As propriedades são declaradas no `world.json` por `PropertyDefinition`. Os tipos de campo
disponíveis são texto, área de texto, número, data, booleano, enum, tags, referência, lista de
referências, imagem e galeria. Os campos `image` e `gallery` existem no schema, mas o formulário
genérico atual não os grava; nenhum tipo semeado depende deles.

## Apresentações específicas

O tipo controla propriedades e blocos, mas algumas páginas têm componentes dedicados, por decisão
do [ADR-010](../architecture/ADR-010-hybrid-entity-pages.md). Caso, evento, documento, pista e
fenômeno usam o compositor genérico. Em resumo:

- locais usam pontos em coordenadas percentuais de 0 a 100; cada ponto pode ser texto, evidência
  ou documento e pode ter até 20 descobertas;
- personagens e criaturas abrem com uma formação holográfica: a página começa como um fluido
  escuro e marmorizado, a figura da imagem se forma primeiro e o resto da página aparece a partir dela; um
  clique ou **Esc** pula, e com movimento reduzido no sistema a página abre direto;
- evidências aceitam até 24 descobertas e abrem numa parede 3D (veja abaixo);
- organizações aceitam até 20 grupos e cada grupo até 30 membros;
- objetos aceitam até 24 detalhes com posição, rótulo e descrição;
- conceitos aceitam até 40 blocos entre visão geral, operação, estrutura, regras, exemplos,
  limitações, terminologia, diagrama e notas;
- contos podem ter no máximo 50 páginas, chamadas de capítulos no editor;
- linhas do tempo exibem aparições datadas em ordem cronológica e itens sem data em seção própria;
- tipos que não possuem composição específica usam o compositor de header, propriedades, conteúdo,
  relações e backlinks conforme o layout do mundo.


### Parede da Evidência

A página de uma Evidência é uma parede com as peças pregadas e ligadas por linha vermelha: a
polaroide da evidência, as polaroides dos personagens relacionados, o conteúdo como folhas de
relatório datilografadas (texto que não cabe vira folha nova) e notas adesivas com propriedades,
apresentação, cada descoberta, notas contextuais, relações e referências.

- **Arraste** uma peça para reorganizá-la; ela não sai da parede. A arrumação fica salva neste
  navegador; **Reorganizar** volta à arrumação inicial.
- **Clique** numa peça para chegar perto e abrir a leitura completa ao lado; **Esc** ou um clique na
  parede fecha.
- **Arraste a parede** para movê-la e use a **roda do mouse** para aproximar, dentro de limites.
- A luz da lanterna segue o ponteiro. Com movimento reduzido no sistema, a câmera não balança.
- Sem WebGL, ou com a interface **Prática** escolhida em **Configurações**, a página mostra o
  quadro em HTML.

### Caixa-arquivo da Organização

A página de uma Organização é uma caixa-arquivo de papelão sobre uma mesa de madeira. A caixa
começa fechada, com a etiqueta da tampa preenchida à mão (nome, tipo, fundação e sede). Por dentro
da tampa fica o índice do conteúdo. Cada tipo de informação é um objeto só, qualquer que seja o
tamanho da organização (só a liderança, que costuma ser pequena, tem uma peça por pessoa):

- **Dossiê:** insígnia ou capa e os dados da organização.
- **Polaroides da liderança:** uma para cada líder, com o retrato do personagem; na leitura, os
  subgrupos do líder e o link para a ficha.
- **Folhas do relatório:** o conteúdo, datilografado; texto que não cabe vira folha nova.
- **Livro de registro:** todos os membros, numerados, com a liderança primeiro (★) e os subgrupos
  de cada um. Na leitura, **‹ ›** ou as setas viram as páginas do livro na mesa; a busca filtra por
  nome ou subgrupo e o botão do livro abre na página daquele membro.
- **Pasta sanfonada:** uma aba por subgrupo (as que não cabem viram "+N"). Na leitura, cada
  subgrupo é uma divisória que abre com a descrição e os integrantes.
- **Estatuto:** objetivos e ideais como artigos, com lacre de cera. Só aparece quando há objetivos
  ou ideais.
- **Correspondência:** um maço de envelopes amarrado, endereçado aos registros relacionados. Na
  leitura ficam as relações institucionais (editáveis) e as citações em outros registros.

- **Clique na tampa** (ou em **Abrir a caixa**) para abrir; clique de novo para fechar.
- **Clique** num documento dentro da caixa para tirá-lo: ele sobe acima da borda e vai para a mesa.
  Na mesa, **clique** para chegar perto e abrir a leitura ao lado; **Esc** ou um clique na mesa fecha.
- **Arraste** documentos pela mesa ou de volta para dentro da caixa. **Tirar tudo** espalha o que
  está na caixa pelo espaço livre da mesa; **Guardar tudo** devolve tudo para a pilha.
- **Arraste a caixa** (pelas paredes, pelo fundo ou pela tampa) para mudá-la de lugar: o que está
  dentro vai junto, e os documentos da mesa que ficarem embaixo dela são empurrados para o lado.
  Clicar na tampa sem arrastar continua abrindo e fechando.
- A arrumação e a posição da caixa ficam salvas neste navegador.
- Arraste a mesa para movê-la e use a roda do mouse para aproximar.
- Sem WebGL, ou com a interface **Prática** escolhida em **Configurações**, a página mostra o
  dossiê em HTML.

### Bancada do Objeto

A página de um Objeto é uma bancada de estudo: a foto técnica do objeto num tapete de corte, com
ferramentas, notas adesivas (identificação, proveniência, efeito conhecido, outros nomes, relações e
referências), etiquetas (tipo e marcadores) e o conteúdo como folhas do relatório de conservação.

- **Paquímetro:** leve-o até a foto e ele abre os bicos e mostra no visor a medida de **Dimensões**
  (o primeiro número e a unidade). Clique nele para ler o texto completo.
- **Lupa:** sobre a foto, o vidro amplia o que está embaixo. Os detalhes marcados na edição só
  aparecem dentro da lente, como adesivos numerados; clique num deles para ler aquele detalhe.
  Clique na lupa para a lista de todos.
- **Clique** numa peça para chegar perto e abrir a leitura ao lado; **Esc** ou um clique na bancada
  fecha.
- **Arraste** peças e ferramentas para reorganizar; nada sai da bancada. A arrumação fica salva
  neste navegador; **Reorganizar** volta à inicial. Arraste a bancada para movê-la e use a roda do
  mouse para aproximar.
- O texto guia na barra de baixo tem um **×** para fechá-lo; fechado, não volta neste navegador.
- Sem WebGL, ou com a interface **Prática** escolhida em **Configurações**, a página mostra a
  ficha de catalogação em HTML.

## Referências e relações

Propriedades `reference` e `referenceList` oferecem candidatos de outros registros do tipo
esperado. Essas referências guardam IDs; renomear o alvo não quebra a seleção.

Na seção **Relacionado**, adicione uma relação escolhendo o alvo, tipo, rótulo opcional e marque **Relação mútua** quando o vínculo valer nos dois sentidos. Com a caixa desmarcada, o vínculo vai da origem ao alvo. A relação fica no registro fonte. O alvo mostra o vínculo em **Backlinks**, calculado
por varredura de todos os registros. Remover a relação altera somente o registro fonte.

**Relacionamentos** ocupa a área ao lado do menu ou abaixo da navegação móvel. Arraste o fundo
para mover a câmera ou o cartão para fixar sua posição. Use a roda, pinça ou os botões de zoom;
**Enquadrar** ajusta a câmera ao recorte atual. **Ver no grafo**, na ficha, abre a vizinhança do registro.
Na vista do mundo inteiro, aparecem registros ativos de todos os tipos, inclusive personalizados
e registros que ainda não têm vínculos.
Em um grafo denso, aproxime para ver rótulos e pontas das conexões ou selecione um vínculo para
realçá-lo.

Cada tipo do mundo semente tem um contorno de cartão próprio, para reconhecer o tipo mesmo com o
zoom afastado, quando o nome do tipo some: Personagem é um crachá de cantos bem arredondados,
Evento uma bandeira com ponta à direita, Pista uma etiqueta com furo à esquerda, Documento uma
folha com o canto dobrado, e assim por diante. Tipos criados no mundo mantêm o cartão retangular.
O contorno não muda o lugar das conexões nem a área de clique, que continua sendo o retângulo
inteiro do cartão. Cada tipo também tem uma textura discreta no fundo do cartão, como pautas no
Documento, tijolos na Organização e curvas de nível no Local. Ela some quando o zoom fica tão
afastado que os cartões viram poucos pixels, e nunca deixa o texto do cartão com contraste abaixo
de 4,5:1. O ícone do tipo abre a linha com o nome do tipo. **Mais → Legenda e estilos** começa
pela seção **Tipos de registro**, com o cartão em miniatura, o ícone, o nome e a forma e a textura
por extenso de cada tipo presente no grafo. A intensidade da textura se escolhe em
**Configurações → Aparência**; com o alto contraste do sistema, a textura some e o contorno fica
mais grosso e na cor do texto.

Abra **Busca e filtros** direto na barra do grafo. Ao buscar por nome, os cartões sem correspondência
ficam esmaecidos enquanto você digita. Eles saem do recorte com **Enter** ou uma pausa na digitação.
Escolha um registro de referência para filtrar **Ida** (vínculos que saem), **Volta** (que chegam)
ou **Ambos**. Vínculos de duas direções e sem direção aparecem nos três modos. **Expandir conexões** acrescenta um
passo no sentido escolhido. Os filtros preservam a câmera e as posições; **Enquadrar resultados**
aproxima o recorte. **Mais → Registros e vínculos** oferece uma alternativa HTML pesquisável, com até 25
resultados por página. Selecione um registro para ir até ele ou um vínculo para editá-lo.
Em **Mais → Legenda e estilos → Novo tipo de seta**, escolha um nome, cor, traço contínuo,
tracejado ou pontilhado, formato da ponta, símbolo opcional e sentido padrão. A prévia acompanha
as mudanças. Use Tab para chegar ao seletor de sentido e as setas do teclado para alternar
entre uma direção, duas direções e sem direção. O sentido padrão se aplica aos próximos vínculos. Cada vínculo salvo guarda seu
próprio sentido.

Para criar um vínculo, ative **Conectar** e arraste da porta de um cartão até o destino ou escolha os
dois cartões por clique/toque. Também é possível pesquisar origem e destino nos campos do painel.
Depois de marcar a origem, digite o nome do próximo cartão. A busca esmaece os demais durante a
digitação, mantém a origem visível e oferece os resultados no grafo e em uma lista.
Digite um tipo, escolha uma das sugestões ou use **Novo tipo de seta** no próprio formulário.
As sugestões começam pelos tipos mais usados entre os mesmos tipos de registro (por exemplo,
personagem → organização) e depois seguem os mais usados no mundo. O botão entre os campos troca
origem e destino. Se já existir um vínculo do mesmo tipo entre os dois registros, o formulário
avisa, bloqueia a duplicata e oferece **Abrir vínculo existente**; sem sentido único, a ordem
das pontas não importa para essa conferência.
Você pode alterar o sentido para este vínculo e adicionar um rótulo. Na criação e na edição,
o formulário mostra uma prévia quando o tipo tem um estilo no catálogo. **Criar relação** grava o vínculo na ficha de
origem e a referência aparece na ficha de destino. Selecione um vínculo no canvas ou na lista para editá-lo ou removê-lo;
a remoção exige confirmação. Os backlinks vêm da ficha de origem. Fichas de Local, Evidência e
Organização também exibem suas referências vindas de outros registros. Se o alvo deixa de estar ativo,
o vínculo fica oculto sem ser apagado da origem.

Em **Seta livre**, clique em um cartão ou no fundo para marcar cada ponta. Depois do primeiro
clique, você também pode digitar para buscar o próximo cartão. Se as duas pontas forem cartões,
abre-se o formulário do vínculo. Com uma ponta no fundo, a seta é uma anotação da vista
e acompanha o cartão a que estiver presa. A prévia mostra a cor e o traço escolhidos antes de
salvar. Selecione uma seta para mover as pontas, mudar o estilo ou apagar.

As **Pastas** ficam no canto inferior esquerdo do grafo. Clique no nome de uma pasta para
mostrar seus registros no canvas inteiro. **Vista principal** mostra os registros que estão
fora das pastas. O nome da vista aberta aparece acima do canvas; a lista no canto informa a
quantidade de registros em cada destino. Abrir uma pasta limpa os filtros e enquadra seus cartões.
Uma pasta pode reunir eventos, personagens, locais, itens e registros personalizados.

Com **Selecionar e mover** ativo, arraste um cartão até o nome da pasta no canto. O destino fica
destacado; solte para mover o registro. Arrastar até **Vista principal** retira o registro da pasta.
Soltar sobre o canvas ajusta a posição do cartão. A movimentação entre pastas conserva a posição
e os vínculos do registro. Use **+** no navegador de pastas ou **Pastas** na barra para criar uma.
O botão **Gerenciar pasta**, ao lado do nome, oferece renomeação, vínculos externos e exclusão.

Pelo teclado, abra a ficha de um cartão na lista e use **Mover para**. Para mover vários,
abra **Mais → Registros e vínculos → Selecionar para mover**, marque os registros e escolha
o destino. A busca no canvas se aplica à vista aberta. A lista **Registros e vínculos** permite
pesquisar registros de todas as pastas, inclusive pelo nome da pasta. Escolher um registro na
lista ou usar **Ver no grafo** abre sua pasta e centraliza o cartão. Ao excluir uma pasta,
seus registros voltam à vista principal nas mesmas posições e conservam seus vínculos.

A vista salva automaticamente alterações concluídas de posição, filtros de tipo, estilo, anotação ou pasta.
**Mais → Restaurar organização** pede confirmação antes de descartar posições fixadas. Em caso de
falha, use **Repetir**; se outra aba tiver salvo uma revisão mais recente, **Recarregar** descarta
as alterações locais após aviso.

## Buscar e organizar catálogos

Os catálogos permitem pesquisar por nome ou título. A busca do catálogo é textual e não pesquisa o corpo completo dos documentos. A paleta de comandos e a busca contextual de registros usam a mesma fonte de dados, com correspondência aproximada sobre título, aliases e tags; a API limita o resultado a 100 itens e a paleta normalmente solicita até 8.

**Pesquisa por etiquetas.** Na paleta de comandos, termos com `#` filtram por etiqueta: `#nob`
encontra registros com a etiqueta "nobreza", `#nob #porto capitão` combina duas etiquetas com
busca pelo nome. A comparação ignora maiúsculas e acentos. Em **Todos os conteúdos**, as etiquetas
do mundo aparecem com a contagem de registros; escolher uma ou mais filtra a lista (todas as
escolhidas precisam estar presentes) e o endereço guarda o filtro, como `/all?tag=nobreza`.
Na ficha, cada etiqueta leva a essa lista filtrada.

As telas também agrupam ou ordenam os resultados conforme o tipo. Personagens podem ser agrupados por nome, organização ou local atual; locais, por hierarquia ou nome; criaturas, por natureza ou nome; espécies, por tipo de registro ou nome; e ciências naturais, por disciplina, subtipo ou nome. Os demais catálogos usam principalmente o nome/título.

Na organização **Regiões** de Locais, cada local que tem sub-locais (pelo campo **Região/local pai**)
forma uma divisão própria. Uma região mostra só os filhos diretos: os que não têm filhos aparecem
como cartões e os que têm aparecem como divisões aninhadas, com seus próprios filhos dentro. Assim,
uma sub-região de uma sub-região aparece apenas na divisão da sub-região, não na região original.
Na busca, aparecem os locais encontrados e o caminho de regiões até eles; quando uma região é
encontrada, ela aparece com tudo o que contém. Referências circulares (A dentro de B e B dentro de
A) não somem da lista: o ciclo é quebrado no primeiro local em ordem alfabética.

Essa busca é diferente da navegação por relações: pesquisar encontra registros existentes, enquanto referências e backlinks mostram como elas se conectam.

## Imagens

Use o seletor de imagem na edição para capa ou símbolo cosmológico. Os formatos aceitos pelo código
são PNG, JPEG, WebP, GIF, SVG e AVIF; a entrada de arquivo do editor visual lista apenas PNG,
JPEG, WebP e GIF. A importação copia o arquivo para o workspace, atribui um asset ID e tenta criar
thumbnail. Ao remover ou substituir uma capa, o asset antigo é movido para `trash/` quando não há
outra referência encontrada.

Nos catálogos e na lista de todos os conteúdos, os cartões de **Personagens** e **Criaturas** são
mais altos (3:4) e mostram a imagem inteira, sem cortar o corpo; o espaço que sobra é preenchido
pela própria imagem, desfocada. Os demais tipos recortam a capa para preencher o cartão.

## Excluir e limitações

**Excluir** um registro o leva para a **Lixeira** (barra lateral, em Ferramentas, ou `/trash`); ele
some dos catálogos, e referências ou cartões de quadro que ainda guardem o ID mostram **Entidade
indisponível**. A lixeira lista registros, quadros, cenas e playlists excluídos, com a data da
exclusão e o tempo que falta para o descarte, como "Será apagado em 6 dias". Cada item tem:

- **Restaurar**: devolve o item ao lugar, com relações, conteúdo e aparições;
- **Apagar agora**: pede confirmação e apaga de vez, sem volta.

Sete dias depois da exclusão o item é apagado de vez automaticamente, ao abrir o app ou, com ele
aberto, na checagem de hora em hora. Depois disso só um [backup](../data/sqlite.md#backup-e-restauração)
recupera o item. No driver filesystem legado não há prazo nem restauração: o registro vai para
`trash/` e a tela da lixeira pede a conversão para SQLite.

Nas linhas do tempo, registros na lixeira mantêm cartões, título próprio, nota e data, com aviso
**Registro indisponível** e sem link para abrir o registro. Apagar o registro de vez, pela lixeira ou
pelo fim do prazo, remove suas aparições e relações; no filesystem legado, a ausência definitiva
provoca a remoção das aparições na próxima consulta de linha ou origem, ou ao criar uma origem. Se o registro era o
Evento de origem, o vínculo é limpo e o calendário preservado. Veja [linhas do tempo](timelines.md).

Ao tentar salvar uma ficha inválida, confira o aviso no topo e as orientações junto aos campos ou editores que precisam de correção. Os valores digitados continuam no formulário.
