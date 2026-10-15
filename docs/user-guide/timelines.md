# Linhas do Tempo

A página existente de cada Linha do Tempo é um mapa estrelado em duas dimensões. A orientação
horizontal é inicial; **Vista vertical** oferece outra distribuição das mesmas aparições.
Título, filtros, controles e painéis permanecem sobre o mapa durante a exploração.
A paleta mantém o texto quente e o acento âmbar/latão do aplicativo, com grafite mais escuro
no fundo e nas superfícies para representar o espaço.

## Explorar o mapa

- Arraste o fundo com o botão esquerdo ou com um dedo para deslocar em qualquer direção.
- Use a roda para ampliar no ponto sob o cursor; pinch de trackpad e de dois dedos também amplia.
- Shift + roda ou deslocamento horizontal do trackpad move o mapa.
- **Aproximar/Afastar mapa**, **Centralizar seleção** e **Ajustar toda a linha à tela** oferecem
  alternativas aos gestos. O percentual indica a ampliação espacial, de 0,8% a 240%.
- Com o mapa focado, setas deslocam, `+`/`−` ampliam, Home/End localizam o primeiro/último
  acontecimento da seleção e Enter abre o selecionado.
- **Abrir lista de acontecimentos** oferece todos os cartões filtrados em ordem. Escolher um
  localiza seu cartão no mapa. **Ir para Sem data** alcança os itens sem data diretamente.

A ordenação usa o primeiro dia possível da data, com desempate pelo ID; intervalos usam o início.
Itens sem data vêm depois. As conexões percorrem faixas alternadas de dez acontecimentos.
**A distância espacial representa sequência, não duração proporcional em dias.** Datas completas,
intervalos, aproximações e durações abertas permanecem nos detalhes. Aproximações têm borda tracejada.

Coordenadas são calculadas para a linha inteira, independentemente de filtros ou tamanho da tela.
Filtrar só oculta elementos; não rearranja cartões nem reinicia posição/ampliação. Alterar a
orientação redistribui explicitamente o mapa e o enquadra no cartão selecionado. A câmera é local
à página e não é persistida após recarregar. Abrir detalhes, biblioteca ou edição não move o mapa.
Uma edição de data pode mudar a ordem; ao fechar o editor, o cartão pode ser localizado novamente.

## Detalhe cronológico, categorias e busca

**Detalhe cronológico** é o filtro exclusivo século/década/ano/mês/dia; ele é independente da
ampliação espacial. Um cartão datado aparece a partir de sua escala mínima: por padrão, ano para
Eventos, mês para Personagens/Locais/Organizações e dia para os demais tipos. **Editar cartão**
pode substituir o padrão. Itens sem data aparecem em qualquer detalhe, sujeitos a busca/categorias.

**Categorias** permite marcar vários tipos. **Buscar cartões** aplica a pesquisa imediatamente
sobre título da aparição ou do registro original. A barra tem dimensões estáveis; a contagem
informa visíveis/total e, no desktop amplo, os ocultos por filtros/detalhe. Uma seleção sem resultados
oferece **Mostrar todos os cartões**, limpando busca/categorias e escolhendo dia sem mover a câmera.

`scale`, `q`, `type` repetido e `view` ficam na URL. Categorias, detalhe e orientação geram entradas
no histórico; digitar busca substitui a entrada atual para não criar uma etapa por tecla.
Voltar/Avançar restaura esses filtros. Um `page` antigo é aceito como localização inicial do grupo
de 50 correspondente; o mapa atual não tem paginação. Os filtros da biblioteca são independentes.

## Incluir, editar e remover

Crie a entidade **Linha do Tempo** no catálogo. **Sobre esta linha** abre conteúdo, propriedades,
relações, backlinks, padrões de escala do mundo e **Editar linha e conteúdo**, sem deslocar o mapa.
O botão de projeção continua disponível acima dos controles inferiores.

**Adicionar registro** abre a Biblioteca de registros. Pesquise título, filtre tipo e use
**Adicionar** ou arraste um registro até o mapa. O nó mais próximo sugere o início de uma data;
revise o formulário e escolha **Confirmar inclusão**. Cancelar não grava. A gaveta é sobreposta
sem bloquear o destino de arraste. No celular, use o botão de inclusão como alternativa ao arraste.

**Adicionar todos os registros ainda ausentes** inclui uma aparição para cada registro ativo não
representado. Repetir não duplica; inclusão individual continua permitindo repetições. Novos
registros não entram automaticamente. Qualquer tipo pode aparecer, inclusive outra linha.

Título de apresentação, nota, data/intervalo, escala mínima e opção de capa pertencem à aparição.
Categoria, capa disponível e link vêm do original. Título vazio acompanha o original. Ao incluir
um Evento, sua data é copiada uma vez; editar uma das datas depois não altera a outra.

Clique no título/ponto para abrir detalhes sobrepostos, com nota e data completas, edição,
remoção e link do registro ativo. **Editar cartão** monta apenas um formulário. **Salvar cartão**
conserva os seletores e informa sucesso. Fechar descarta alterações não salvas e devolve o foco.
Se os filtros ocultarem a aparição editada, a interface informa o motivo sem mudar os filtros.

**Criar Evento rápido** cria Evento e aparição juntos e oferece o editor completo. Nesse editor
você altera o registro; para alterar só a aparição, use **Editar cartão**.

**Remover da linha** ou arrastar o cartão para a área de remoção retira somente a aparição.
O aviso oferece **Desfazer** imediatamente, inclusive para alvo na lixeira. Se houver outra
alteração concorrente, atualize e revise o estado antes de tentar novamente.

Registros na lixeira conservam título/categoria para filtros e os campos próprios da aparição,
com aviso **Registro indisponível** e sem link para abrir o original. Ausência definitiva reconcilia
as referências na próxima consulta, removendo aparições e limpando só o vínculo de origem;
ano zero e nome do marco permanecem. Falhas de leitura interrompem a limpeza. Não há interface
de descarte permanente/restauração de registros; Desfazer não recupera um registro descartado.

## Centenas de acontecimentos e movimento

Todos os pontos/conexões continuam no mapa; somente cartões próximos do viewport são montados,
com margem de segurança e teto de 96. Abaixo de 28% de ampliação, a visão geral mostra os pontos;
a lista de acontecimentos permite localizar e abrir os cartões. Biblioteca e lista têm páginas
próprias de 50 itens. Os dados completos continuam carregados; essa otimização limita o DOM.

O fundo tem um brilho muito discreto; filtros/seleção usam transições de 180 ms e controles de
câmera 200 ms. Gestos respondem por quadro, sem tween atrasado. **Reduzir movimento** desativa
animações/transições e torna os controles imediatos. Foco visível e alternativas por teclado
permanecem. Medidas, ensaios e limites: [perfil do canvas](../performance/timeline-cosmic-canvas.md).
As [referências pesquisadas](../research/timeline-cosmic-canvas.md) documentam a escolha técnica.

## Mundo de demonstração permanente

No PowerShell, a partir da raiz, execute:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-timeline-demo.ps1
```

Abra `http://localhost:3127/`, **Laboratório da Linha do Tempo** e **Crônica principal**.
O comando cria o mundo na primeira execução e conserva alterações em `demo-data/`, ignorado pelo
Git e separado dos dados privados. Se a porta estiver ocupada, encerre seu servidor antes de executar.
O cenário contém 14 registros ativos de seis tipos, duas linhas, datas negativas/zero/positivas,
intervalo, ISO legado, sem data, repetições, capa sintética e alvo na lixeira, além de registros
para testar inclusão individual/em lote. Nenhum dado privado foi usado nos ensaios desta entrega.
