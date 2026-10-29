# Mundos e biblioteca de Codex

## Selecionar um Codex

Abra `/`. A biblioteca lista os mundos encontrados em `WIKI_WORKSPACE_DIR`: o mundo ativo aparece em
destaque, com o botão **Continuar**, e os demais ficam em **Outros mundos**, do atualizado mais
recentemente ao mais antigo. Escolha **Continuar** ou clique no nome de um mundo para gravar o cookie
`canon-codex-world` e abrir `/codex`. A barra lateral da biblioteca reúne as ações **Criar Codex**,
**Carregar pasta** e os atlas incluídos.

Se não houver mundo, a primeira leitura cria automaticamente o seed `Canon Codex` com 17 tipos
iniciais.

## Criar um mundo

1. Na barra lateral da biblioteca, escolha **Criar Codex**.
2. Informe um nome não vazio e, opcionalmente, uma descrição.
3. Escolha **Criar e abrir**.

O aplicativo cria um UUID, um slug de diretório único e o catálogo padrão. Dois nomes que gerariam
o mesmo slug recebem sufixos como `-2`; renomear depois muda o nome exibido, não a identidade nem a
pasta.

## Abrir o atlas de Tal’Dorei Renascido

Na barra lateral da biblioteca, em **Atlas incluídos**, escolha **Tal’Dorei Renascido**. Na primeira abertura, o aplicativo
importa uma cópia do pacote local em `world-packs/taldorei-renascido-completo/`; nas próximas, abre
o mesmo mundo sem duplicá-lo. Esta edição tem um UUID diferente do primeiro pacote experimental:
importá-la preserva as alterações feitas no teste anterior.

O pacote contém 215 registros nos 17 tipos do catálogo padrão, todos visíveis na barra lateral.
Inclui 13 regiões, 28 assentamentos,
14 outros locais, 27 organizações ou grupos, 14 povos, 34 registros cosmológicos, 12 eventos,
11 personagens, 16 criaturas, 11 artefatos e duas linhas do tempo, além de conceitos, contos,
fenômenos, ciências naturais, casos, evidências e uma pista. Propriedades ligam assentamentos às
regiões, personagens a organizações e locais, e ganchos de aventura a eventos e lugares. Cada ficha
mostra sua página de origem. Os 12 eventos têm data e suas informações aparecem em uma única página
de detalhe. As duas linhas do tempo têm aparições vinculadas a esses eventos. As datas antigas sem
ano expresso no livro são estimativas para navegação, marcadas como aproximadas; o ano zero da
Divergência e o cenário em 836 P.D. vêm da cronologia do livro. Ao abrir o atlas novamente, o botão
preenche datas ausentes e reúne páginas de detalhe dos eventos já importados, preservando datas
personalizadas e o texto existente.

| Evento sem ano exato no livro | Ano aproximado usado para teste |
| --- | ---: |
| Fundação; Cisma; Era do Arcanum; Calamidade | -5000; -4000; -1200; -100 |
| Guerra Dispersa; ascensão de Zan Tal’Dorei | 500; 510 P.D. |
| Fim da monarquia; Conclave Croma; derrota d’O Sussurrado | 810; 810; 812 P.D. |
| Despertar dos serpentinos Vos’skyriss | 836 P.D. |

Esses anos são hipóteses de ordenação, não datas canônicas. A rotina de atualização corrige a
estimativa anterior de 816 P.D. para o Conclave Croma, de modo que ele preceda a derrota
d’O Sussurrado.

Quinze documentos de referência guardam o texto extraído de todas as 284 páginas do PDF, em ordem.
Eles incluem história, panteão, opções de personagem, tesouros, regras e criaturas, além da gazeta.
A extração de texto não preserva mapas, ilustrações, diagramação e todo o significado de tabelas; o
PDF original continua sendo a referência para esses elementos. As fichas não têm fotos, para que
possam ser adicionadas depois. O calendário do pacote usa os 11 meses e 328 dias descritos no livro.

Para reconstruir o pacote com outra cópia da mesma edição, execute
`python scripts/build-taldorei-world.py "CAMINHO_DO_PDF"` com Python e `pypdf` disponíveis. A saída
fica fora de `workspace/`; o aplicativo só copia o pacote quando o usuário clica para abri-lo. O
catálogo de tipos usado pelo gerador está em `scripts/taldorei-entity-types.json`.

## Configurar o calendário

Com um mundo aberto, escolha **Calendário** na barra lateral. A tela permite editar:

- os sete nomes dos dias, o dia da semana no início do ano zero, horas por dia e os nomes/comprimentos individuais dos meses;
- as eras anterior e posterior, o nome da origem e sua posição em mês/dia no ano zero;
- regras de dias intercalares: o mês define onde o dia entra, como último dia do mês ou depois dele; a recorrência define de
  quantos em quantos anos ele aparece; o deslocamento move o primeiro ano do ciclo. As opções de
  salto e inclusão permitem exceções, como saltar anos divisíveis por 100 e incluir novamente os
  divisíveis por 400.

A prévia mostra a mesma posição no ano `-1`, `0` e `1`, incluindo o nome do dia e da era. Ano zero
é um ano completo. Salvar valida nomes, meses positivos, origem válida, recorrências e regras que
apontem para meses existentes; o formulário mantém o erro explicativo na tela quando algo é inválido.
Cada mundo lê e grava seu próprio calendário; se o mundo ativo mudar em outra aba antes de salvar,
o formulário pede para reabrir o calendário, evitando gravar no mundo errado. Datas de entidade
já gravadas como `AAAA-MM-DD` continuam legíveis e não são reescritas por esta configuração. Ao
editar uma entidade, campos `kind: 'date'` usam esse calendário para aceitar ano, mês, dia, ano zero,
anos negativos, aproximação e intervalo; o formato persistido e a compatibilidade ISO estão em
[Armazenamento e modelo de dados](../data/storage.md). Para converter strings antigas, abra
**Prévia e conversão das datas antigas deste mundo** na tela do calendário; o procedimento e a
recuperação estão no [guia de migração](../data/migrations.md).

Para vincular um acontecimento ao ano zero, crie um **Evento** com data completa e marque **Evento
de origem**. A criação coloca a data no ano zero, no mês e dia informados. Só pode haver um Evento
de origem por mundo. Para trocar, abra **Ver ou substituir o Evento de origem** no calendário,
selecione outro Evento, revise a prévia do deslocamento de dias e confirme. A troca remarca as datas
de propriedades em registros ativos e na lixeira. A precisão de ano ou mês é preservada quando o
intervalo deslocado ainda coincide com uma unidade inteira; caso contrário, a prévia avisa sobre a
mudança de precisão. Uma duração sem fim permanece aberta. Datas inválidas ou que terminariam em um
dia intercalar sem representação editável impedem a troca antes da gravação. Um backup em
`origin-backups/` restaura uma operação interrompida antes da próxima leitura ou gravação de
metadados do mundo. A data do Evento vinculado não pode ser alterada para fora do marco;
para isso, substitua a origem.

Se o Evento de origem estiver na lixeira, a tela do calendário mostra seu título e o aviso
**na lixeira**. O vínculo e o marco permanecem; escolha outro Evento ativo para substituir a origem.

Se houver campos de data preenchidos em registros ativos ou na lixeira, o salvamento recusa mudanças
no comprimento dos meses ou nas regras intercalares. O erro informa a quantidade
de campos encontrados. A conversão de strings antigas não libera alterações estruturais: objetos
de data já existentes também precisariam de uma remarcação ordinal, ainda não implementada. Nomes,
eras, horas por dia e nomes dos dias da semana ainda podem ser editados. Enquanto houver Evento
vinculado, sua posição em mês/dia só muda por substituição da origem.

Mundos existentes recebem o calendário inicial na migração v15→v16. A migração v16→v17 faz o dia
bissexto desse calendário corresponder a 29 de fevereiro e ajusta os dias da semana; a leitura
normal aplica a migração em memória. A importação grava o `world.json` já migrado na cópia local, e
uma alteração feita na tela grava o calendário validado de forma atômica.

## Importar uma pasta

1. Na barra lateral da biblioteca, selecione **Carregar pasta**.
2. Informe uma pasta que contenha `world.json` ou a raiz de outro Canon Codex. Também são
   reconhecidos `workspace/worlds/` e `worlds/` dentro da pasta escolhida.
3. Use uma cópia privada ou um backup; a aplicação copia a fonte para sua biblioteca e não move a
   origem.
4. Escolha **Importar e abrir**.

O importador aceita vários mundos encontrados na raiz. Ele rejeita `world.json` inválido, pasta
ausente, IDs que já existem na biblioteca e duas cópias do mesmo ID na mesma importação. Em colisão
de slug, o diretório de destino recebe um sufixo; o `World.id` permanece o mesmo.

## Renomear e remover

1. Na linha do mundo (ou no destaque do mundo ativo), abra **Gerenciar** (ícone de ajustes).
2. Edite o nome e salve para renomear.
3. Para remover, confirme **Excluir**.

A remoção tira o mundo da biblioteca e move a pasta para o `trash/worlds` do workspace. É uma
exclusão lógica, não uma restauração disponível na interface: preserve um backup antes de tratar a
ação como reversível. A política detalhada está em [backup e restauração](../data/backup-and-restore.md).

## Limites atuais

- O cookie seleciona contexto; não identifica usuário nem impede acesso a quem consegue acessar o
  processo local.
- Não há sincronização entre computadores, colaboração ou importação por upload HTTP.
- Alterar o caminho de workspace exige reiniciar o servidor para que o processo leia a nova variável.
