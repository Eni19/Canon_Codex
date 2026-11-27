# Canon Codex

Vocabulário do mundo narrativo, de seus registros e de suas cronologias. Este glossário registra
apenas conceitos de produto já acordados. Cada termo traz o que evitar e, quando difere, o nome
usado no código. Rótulos de botão citados nos guias ficam como aparecem na interface, mesmo quando
usam outra palavra.

## Mundo e biblioteca

**Mundo**:
Universo narrativo que reúne registros, linhas do tempo e um calendário próprio.
_Evitar_: Codex como nome de um mundo no texto dos guias; instalação inteira, quando a regra pertence a apenas um mundo.
_No código_: `World`.

**Canon Codex**:
Nome do produto. "Codex" sozinho aparece em rótulos da interface (como **Criar Codex**) e no tema
visual padrão, mas não designa um conceito próprio.
_Evitar_: Codex como sinônimo de mundo ou de biblioteca.

**Biblioteca**:
Conjunto de mundos disponíveis nesta instalação, apresentado na página inicial.
_Evitar_: biblioteca de Codex, workspace.

**Preferências do mundo**:
Escolhas de um mundo sobre a própria interface: tipos de conteúdo e ferramentas que aparecem na
barra lateral, a ordem dos tipos e, para cada tipo com interface interativa, se a página usa a interativa ou a prática.
Ficam no próprio mundo, não no navegador.
_Evitar_: configurações do navegador, guias ocultas.
_No código_: `WorldPreferences` (`world.preferences`).

**Interface prática**:
Versão de página única de um tipo que também tem interface interativa (caixa-arquivo, parede de
investigação, bancada de estudo), com a mesma informação organizada para achar rápido.
_Evitar_: modo simples, versão antiga, modo sem 3D.
_No código_: `plainInterfaces`.

**Mundo ativo**:
Mundo aberto no momento, em que todas as leituras e gravações acontecem.
_Evitar_: mundo atual da sessão, mundo selecionado no servidor.

## Registros e conteúdo

**Registro**:
Elemento narrativo de um mundo, como evento, personagem, local ou objeto.
_Evitar_: entidade no texto dos guias; evento como nome genérico de todo registro.
_No código_: `Entity`.

**Tipo de registro**:
Categoria que define quais propriedades e seções um registro tem, como Personagem ou Local. Cada
mundo tem seus próprios tipos e pode criar novos.
_Evitar_: classe, modelo, tabela.
_No código_: `EntityTypeDefinition`.

**Propriedade**:
Campo curto de um registro, declarado pelo seu tipo, como data, local atual ou status.
_Evitar_: atributo, metadado.
_No código_: `PropertyDefinition` (a definição) e `properties` (os valores).

**Ficha**:
Seção de um registro que reúne as propriedades curtas e as referências.
_Evitar_: formulário, quando se fala da leitura.

**Página de conteúdo**:
Texto rico de um registro, com nome próprio. Um registro tem ao menos uma página e pode ter
várias, como os capítulos de um conto.
_Evitar_: documento, nota, aba.
_No código_: item de `ContentDocument.pages`.

**Lixeira**:
Estado de um registro, quadro, cena, playlist ou Codex excluído pela interface. Ele some dos
catálogos, mas continua existindo por 7 dias e suas referências mostram que está indisponível.
Nesse prazo pode ser restaurado ou apagado agora; depois é apagado de vez.
_Evitar_: exclusão permanente, apagado.
_No código_: `trash/` no driver legado e `deleted_at` no SQLite.

**Ausência definitiva**:
Situação em que um registro não existe nem na lixeira: venceu o prazo da lixeira, foi apagado
agora na lixeira ou sumiu fora da interface. Faz o app limpar as aparições e referências que
apontavam para ele.
_Evitar_: lixeira, registro indisponível.

## Relações

**Relação**:
Ligação dirigida de um registro de origem a um registro alvo, com tipo e rótulo opcional. Fica
gravada no registro de origem.
_Evitar_: link, conexão; vínculo só onde a interface já usa a palavra.
_No código_: `relations`.

**Relação mútua**:
Relação que vale nos dois sentidos sem precisar ser gravada duas vezes.
_Evitar_: relação dupla, duas relações espelhadas.
_No código_: `bidirectional`.

**Backlink**:
Relação vista a partir do registro alvo. Não é gravada: é calculada a partir das relações de origem.
_Evitar_: relação reversa gravada, referência de volta.

**Tipo de seta**:
Estilo reutilizável do grafo (nome, cor, traço e sentido padrão) aplicado às relações de um tipo.
_Evitar_: tipo de relação, quando se fala só da aparência.
_No código_: `styles` em `GraphSettings`.

**Seta livre**:
Anotação desenhada no grafo entre dois pontos ou cartões. Não é uma relação entre registros.
_Evitar_: relação, vínculo.
_No código_: `annotations` em `GraphSettings`.

**Pasta**:
Agrupamento de registros de qualquer tipo dentro do grafo de relações, para organizar a vista.
Não muda o registro nem suas relações.
_Evitar_: pasta do sistema de arquivos, categoria, tipo.
_No código_: `folders` em `GraphSettings`.

**Vista principal**:
Grafo com os registros que não estão em nenhuma pasta.
_Evitar_: raiz, pasta padrão.

## Quadros, cenas e mesa

**Quadro**:
Mesa de investigação livre em que se dispõem cartões de registros, desenhos, notas e setas.
_Evitar_: board, mural, grafo.
_No código_: `BoardDocument`.

**Cena**:
Mapa de jogo baseado na imagem de um local, com grade, tokens e pontos de interesse.
_Evitar_: mapa, quadro.
_No código_: `Scene`.

**Token**:
Peça de um registro (personagem, criatura, organização, evidência ou objeto) posicionada na cena.
_Evitar_: cartão, peão.

**Ponto de interesse**:
Marca de um local que aparece na cena e pode ser revelada aos jogadores.
_Evitar_: marcador, pino.

**Preparar e Mestrar**:
Modos da cena: Preparar monta a cena; Mestrar conduz a sessão e revela itens aos jogadores.
_Evitar_: edição e apresentação.

**Projeção**:
Janela do jogador que mostra só o que o mestre revelou de uma cena ou de um registro. Pertence à
janela do mestre, não à cena.
_Evitar_: apresentação, compartilhamento, transmissão pela rede.

**Trilha sonora**:
Área de playlists que toca durante a sessão, inclusive na projeção.
_Evitar_: música, player.

**Playlist**:
Lista nomeada de faixas do YouTube de um mundo. Guarda só links e metadados das faixas.
_Evitar_: álbum, fila.
_No código_: `Playlist`.

## Tempo

**Calendário do mundo**:
Sistema único de contagem e nomeação do tempo usado por todas as linhas do tempo de um mundo.
_Evitar_: calendário da linha do tempo.

**Hoje da campanha**:
Data que o mundo considera como o presente da campanha. Serve de ponto de partida no calendário
e como sugestão ao criar Eventos.
_Evitar_: data de hoje, data do sistema.
_No código_: `campaignToday`.

**Linha do tempo**:
Seleção temática ou geral de registros organizada no tempo. Podem existir várias linhas do tempo para o mesmo conjunto de registros.
_Evitar_: calendário, cronologia global obrigatória.

**Aparição na linha**:
Participação de um registro em uma linha do tempo, com data e apresentação próprias. Um registro pode ter várias aparições na mesma linha.
_Evitar_: cópia do registro, evento como nome de toda aparição.

**Ano zero**:
Ano do acontecimento escolhido como origem do calendário do mundo; há anos anteriores e posteriores a ele.
_Evitar_: primeiro ano depois da origem.

**Evento de origem**:
Único registro do tipo Evento associado ao marco que nomeia o ano zero de um mundo.
_Evitar_: qualquer aparição escolhida como primeira em uma linha do tempo.

**Filtro de categoria**:
Critério de visualização que oculta temporariamente registros de certas categorias na linha do tempo, preservando sua participação nela.
_Evitar_: remoção da linha do tempo.

**Detalhe cronológico**:
Nível de seleção temporal (século, década, ano, mês ou dia) que determina quais aparições datadas
estão visíveis segundo sua escala mínima.
_Evitar_: zoom espacial, ampliação do mapa.

**Ampliação do mapa**:
Proximidade visual dos acontecimentos e conexões na superfície explorável da linha do tempo,
sem alterar a seleção temporal ou as datas das aparições.
_Evitar_: detalhe cronológico, escala mínima da aparição.
