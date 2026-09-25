# Mundos e biblioteca de Codex

## Selecionar um Codex

Abra `/`. A biblioteca lista os mundos encontrados em `WIKI_WORKSPACE_DIR` e marca o ativo. Clique
no nome de um mundo para gravar o cookie `canon-codex-world` e abrir `/codex`.

Se não houver mundo, a primeira leitura cria automaticamente o seed `Canon Codex` com 17 tipos
iniciais.

## Criar um mundo

1. Na biblioteca, escolha **Criar Codex**.
2. Informe um nome não vazio e, opcionalmente, uma descrição.
3. Escolha **Criar e abrir**.

O aplicativo cria um UUID, um slug de diretório único e o catálogo padrão. Dois nomes que gerariam
o mesmo slug recebem sufixos como `-2`; renomear depois muda o nome exibido, não a identidade nem a
pasta.

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
[Armazenamento e modelo de dados](../data/storage.md). A conversão em lote ainda é planejada para o
ticket 03.

Mundos existentes recebem o calendário inicial na migração v15→v16. A migração v16→v17 faz o dia
bissexto desse calendário corresponder a 29 de fevereiro e ajusta os dias da semana; a leitura
normal aplica a migração em memória. A importação grava o `world.json` já migrado na cópia local, e
uma alteração feita na tela grava o calendário validado de forma atômica.

## Importar uma pasta

1. Selecione **Carregar pasta**.
2. Informe uma pasta que contenha `world.json` ou a raiz de outro Canon Codex. Também são
   reconhecidos `workspace/worlds/` e `worlds/` dentro da pasta escolhida.
3. Use uma cópia privada ou um backup; a aplicação copia a fonte para sua biblioteca e não move a
   origem.
4. Escolha **Importar e abrir**.

O importador aceita vários mundos encontrados na raiz. Ele rejeita `world.json` inválido, pasta
ausente, IDs que já existem na biblioteca e duas cópias do mesmo ID na mesma importação. Em colisão
de slug, o diretório de destino recebe um sufixo; o `World.id` permanece o mesmo.

## Renomear e remover

1. Na linha do mundo, abra **Gerenciar**.
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
