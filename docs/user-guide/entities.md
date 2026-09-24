# Entidades, tipos e relações

## Criar e editar

1. Em `/codex`, escolha um catálogo ou abra `/<entityType>`.
2. Clique em **Nova entidade**.
3. Informe título, aliases (quando exibidos), tags e tema quando disponível.
4. Escolha **Criar e continuar editando**.
5. Na tela de edição, preencha propriedades, referências, conteúdo e recursos específicos; clique
   em **Salvar**.

O título é obrigatório. O ID é um UUID e não muda quando o título muda; o slug é derivado novamente
do título e não deve ser usado para links. O formulário revalida campos estruturados com Zod antes
de gravar.

## Tipos iniciais

O mundo semente atual define 17 tipos. `showInSidebar = false` em **Caso**, **Documento**,
**Pista** e **Fenômeno** apenas os oculta da navegação principal; eles continuam sendo tipos
persistidos e podem ser usados por referências.

| ID | Nome | Apresentação ou campos destacados |
| --- | --- | --- |
| `character` | Personagem | retrato, perfil, idade, espécie, ocupação e locais referenciados |
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
| `timeline` | Linha do Tempo | escopo, início e fim; apresentação genérica |

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
