# Entidades, tipos e relações

## Criar e editar

1. Em `/codex`, escolha um catálogo ou abra `/<entityType>`.
2. Clique em **Nova entidade**.
3. Preencha o formulário completo, que é o mesmo da edição: nome, apelidos (quando exibidos) e tags
   no topo; **Ficha** com as propriedades curtas e referências; **Detalhes** com os textos longos;
   o editor específico do tipo, quando existe; e **Conteúdo**. À direita ficam imagem principal,
   símbolo (cosmologia), cor e status.
4. Escolha **Criar registro**. Para alterar depois, use **Editar** na página e **Salvar
   alterações**. `Ctrl+S` salva nos dois casos.

Não há mais uma tela intermediária: imagens, conteúdo e editores específicos podem ser preenchidos
antes de o registro existir. A imagem é enviada à biblioteca de assets do mundo assim que é
escolhida (clique ou arraste); se o formulário for abandonado, esse asset fica sem referência no
mundo. Ao trocar ou remover a imagem de um registro salvo, a imagem anterior é apagada quando
nenhum outro registro a usa. A cor escolhida retinge o formulário imediatamente. Se a validação
falhar, a mensagem aparece no topo do formulário e o que foi digitado é mantido. Fechar a aba com
alterações não salvas pede confirmação, assim como **Cancelar**; a navegação pela barra lateral
ainda não pede.

Em **Personagem** e **Criatura**, com uma imagem escolhida, **Ajustar enquadramento** abre uma prévia da página
no tamanho real, com os controles no lugar da barra lateral. Arraste a imagem para movê-la, use a
roda do mouse para aproximar (o ponto sob o cursor fica parado) ou os controles **Horizontal**,
**Vertical** e **Zoom**; com a imagem selecionada, setas movem e `+`/`−` ajustam o zoom.
**Aplicar** guarda o ajuste no formulário, que é gravado ao salvar; **Restaurar padrão** volta à
apresentação original e `Esc` cancela. A prévia usa os valores atuais do formulário, inclusive os
ainda não salvos.

O título é obrigatório. O ID é um UUID e não muda quando o título muda; o slug é derivado novamente
do título e não deve ser usado para links. O formulário revalida campos estruturados com Zod antes
de gravar.

Na criação de um **Evento**, informe uma data exata com mês e dia para poder marcar **Evento de
origem**. O sistema coloca essa data no ano zero do mundo. Se já houver um Evento vinculado,
substitua-o pela prévia em **Calendário → Evento de origem**.

## Tipos iniciais

O mundo semente atual define 17 tipos. `showInSidebar = false` em **Caso**, **Documento**,
**Pista** e **Fenômeno** apenas os oculta da navegação principal; eles continuam sendo tipos
persistidos e podem ser usados por referências.

| ID | Nome | Apresentação ou campos destacados |
| --- | --- | --- |
| `character` | Personagem | retrato com enquadramento ajustável, idade, espécie, ocupação, afiliação e local atual |
| `species` | Espécie / Povo | classificação, habitats, idiomas, características e organizações |
| `location` | Local | blueprint/mapa, pontos de interesse e cenas associadas |
| `organization` | Organização | dossiê, líderes, membros e grupos |
| `case` | Caso | status, data, envolvidos e locais; apresentação genérica |
| `event` | Evento | jornal, estado, data, local e participantes |
| `tale` | Conto | leitura editorial, capa e até 50 capítulos/páginas |
| `document` | Documento | tipo, autor, data; apresentação genérica |
| `evidence` | Evidência | quadro de evidência, formato, tipo, contexto e descobertas |
| `clue` | Pista | evento relacionado e descobridor; apresentação genérica |
| `creature` | Criatura | natureza, apresentação da imagem, classificação, habitat e perigo |
| `naturalScience` | Natureza / Medicina | disciplina, subtipo, habitat, sintomas, toxicidade e tratamento |
| `phenomenon` | Fenômeno | tipo, primeira observação e locais afetados; oculto da barra |
| `artifact` | Objeto / Artefato | catálogo, registro, materiais, conservação e detalhes posicionáveis |
| `concept` | Conceito | texto base e até 40 blocos de referência |
| `cosmology` | Registro Cosmológico | entidade/divindade/reino, domínios, símbolo e artefatos |
| `timeline` | Linha do Tempo | escopo, início e fim; página com vistas vertical e horizontal de aparições |

As propriedades são declaradas no `world.json` por `PropertyDefinition`. Os tipos de campo
disponíveis são texto, área de texto, número, data, booleano, enum, tags, referência, lista de
referências, imagem e galeria. Os campos `image` e `gallery` existem no schema, mas o formulário
genérico atual não os grava; nenhum tipo semeado depende deles.

## Apresentações específicas

O tipo controla propriedades e blocos, mas algumas páginas têm componentes dedicados. Em resumo:

- locais usam pontos em coordenadas percentuais de 0 a 100; cada ponto pode ser texto, evidência
  ou documento e pode ter até 20 descobertas;
- evidências aceitam até 24 descobertas;
- organizações aceitam até 20 grupos e cada grupo até 30 membros;
- artefatos aceitam até 24 detalhes com posição, rótulo e descrição;
- conceitos aceitam até 40 blocos entre visão geral, operação, estrutura, regras, exemplos,
  limitações, terminologia, diagrama e notas;
- contos podem ter no máximo 50 páginas, chamadas de capítulos no editor;
- linhas do tempo exibem aparições datadas em ordem cronológica e itens sem data em seção própria;
- tipos que não possuem composição específica usam o compositor de header, propriedades, conteúdo,
  relações e backlinks conforme o layout do mundo.

## Referências e relações

Propriedades `reference` e `referenceList` oferecem candidatos de outros registros do tipo
esperado. Essas referências guardam IDs; renomear o alvo não quebra a seleção.

Na seção **Relacionado**, adicione uma relação escolhendo o alvo, tipo, rótulo opcional e se ela é
direcional. A relação fica no registro fonte. O alvo mostra o vínculo em **Backlinks**, calculado
por varredura de todas as entidades. Remover a relação altera somente o registro fonte.

## Buscar e organizar catálogos

Os catálogos permitem pesquisar por nome ou título. A busca do catálogo é textual e não pesquisa o corpo completo dos documentos. A paleta de comandos e a busca contextual de entidades usam a mesma fonte de dados, com correspondência aproximada sobre título, aliases e tags; a API limita o resultado a 100 itens e a paleta normalmente solicita até 8.

As telas também agrupam ou ordenam os resultados conforme o tipo. Personagens podem ser agrupados por nome, organização ou local atual; locais, por hierarquia ou nome; criaturas, por natureza ou nome; espécies, por tipo de registro ou nome; e ciências naturais, por disciplina, subtipo ou nome. Os demais catálogos usam principalmente o nome/título.

Na organização **Regiões** de Locais, cada local que tem sub-locais (pelo campo **Região/local pai**)
forma uma divisão própria. Uma região mostra só os filhos diretos: os que não têm filhos aparecem
como cartões e os que têm aparecem como divisões aninhadas, com seus próprios filhos dentro. Assim,
uma sub-região de uma sub-região aparece apenas na divisão da sub-região, não na região original.
Na busca, aparecem os locais encontrados e o caminho de regiões até eles; quando uma região é
encontrada, ela aparece com tudo o que contém. Referências circulares (A dentro de B e B dentro de
A) não somem da lista: o ciclo é quebrado no primeiro local em ordem alfabética.

Essa busca é diferente da navegação por relações: pesquisar encontra entidades existentes, enquanto referências e backlinks mostram como elas se conectam.

## Imagens

Use o seletor de imagem na edição para capa ou símbolo cosmológico. Os formatos aceitos pelo código
são PNG, JPEG, WebP, GIF, SVG e AVIF; a entrada de arquivo do editor visual lista apenas PNG,
JPEG, WebP e GIF. A importação copia o arquivo para o workspace, atribui um asset ID e tenta criar
thumbnail. Ao remover ou substituir uma capa, o asset antigo é movido para `trash/` quando não há
outra referência encontrada.

## Excluir e limitações

**Excluir** uma entidade move sua pasta inteira, inclusive `content.json`, para `trash/`; ela some
dos catálogos e não há botão de restaurar. Referências ou cartões de quadro que ainda guardem o ID
podem mostrar “entidade indisponível”. Não existe exclusão permanente exposta pela aplicação.

Nas linhas do tempo, registros na lixeira mantêm cartões, título próprio, nota e data, com aviso
**Registro indisponível** e sem link para abrir o registro. Ausência definitiva também da lixeira
provoca a remoção das aparições na próxima consulta de linha ou origem, ou ao criar uma origem. Se o registro era o
Evento de origem, o vínculo é limpo e o calendário preservado. Veja [linhas do tempo](timelines.md).
