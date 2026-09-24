# Especificação de implementação: linhas do tempo

Status: planejado, ainda não implementado. Este documento é o repasse para uma IA implementadora. As decisões de produto e sua motivação estão nos tickets resolvidos do [mapa Wayfinder](../linha-do-tempo/map.md).

## Resultado esperado

Uma pessoa cria várias linhas temáticas ou gerais em um mundo, inclui registros de qualquer tipo, escolhe quando e como cada aparição é mostrada, filtra sem perder itens e alterna entre vistas vertical e horizontal. Todas usam o calendário configurável daquele mundo. A interface permanece legível com centenas de aparições em desktop e celular.

## Termos e invariantes

- **Mundo**: unidade que possui um calendário e um conjunto isolado de registros e linhas. Nenhum ID de outro mundo pode entrar numa linha.
- **Linha do tempo**: entidade já existente do tipo `timeline`, com título e conteúdo próprios. A linha geral também é uma seleção explícita; novos registros não entram automaticamente.
- **Aparição**: instância com ID estável de um registro dentro de uma linha. O mesmo registro pode ter várias aparições na mesma linha. Uma linha que aponta para outra linha mostra apenas um cartão com link, sem expansão recursiva.
- A aparição guarda ID do registro, título de apresentação opcional, nota curta opcional, data/intervalo próprio, escala mínima opcional e opção de exibir a capa herdada. Categoria e link são derivados do registro. Alterar a aparição não altera o registro.
- Ao incluir um Evento, a data dele preenche a nova aparição uma vez. Não há sincronização posterior automática. Registros sem data entram na área **Sem data**.
- **Adicionar todos** acrescenta uma aparição para cada registro ativo ainda não presente na linha. Executar novamente não duplica esses registros; a inclusão individual pode criar aparições adicionais intencionalmente.

## Calendário por mundo

- O mundo guarda um calendário configurável: nomes dos dias da semana, nomes e comprimentos individuais dos meses, horas por dia, nomes das eras anterior e posterior, nome do marco de origem e regras opcionais e repetíveis de dias intercalares. Os dias da semana avançam continuamente; um mês não precisa conter semanas exatas.
- Regras intercalares são configuradas por recorrência e mês de aplicação, com validação para impedir mês de comprimento não positivo. O mesmo cálculo precisa funcionar para anos negativos, zero e positivos, sem depender de `Date` do JavaScript para representar o tempo fictício.
- O ano `0` é completo. A ordem é `-2, -1, 0, 1, 2`; o acontecimento de origem pode ocorrer em qualquer mês/dia do ano zero. A interface permite marcar **um** Evento como origem durante sua criação. Configurações do calendário permitem substituí-lo, com prévia e confirmação. O Evento marcado deve ter ano zero.
- O marco conserva nome e posição se o Evento de origem estiver na lixeira. Após descarte permanente, somente o vínculo com o Evento é limpo; o calendário e seu ano zero permanecem até substituição explícita.
- A primeira versão posiciona aparições com precisão máxima de dia. Horas por dia são configuráveis, mas horários de aparição ficam fora deste conjunto de entregas.

## Datas, precisão e ordenação

- Uma data pode ter apenas ano, ano e mês, ou ano, mês e dia. Início e fim formam intervalo; fim ausente indica duração aberta. Cada limite pode ser aproximado. Sem início significa **Sem data**. A UI exibe somente a precisão informada.
- Guardar um ordinal temporal independente do formato do calendário para preservar ordem e distância entre dias completos quando o calendário ou a origem mudar. Datas de ano/mês representam o intervalo inteiro correspondente, não um dia inventado. Se uma mudança estrutural quebrar o alinhamento com um único ano/mês novo, exibir o intervalo convertido e sinalizar a mudança de precisão na prévia.
- A ordenação usa o primeiro instante possível de cada aparição; empate usa o ID estável da aparição. O zoom não altera data nem ordenação persistida. Arrastar não reordena nem muda datas silenciosamente.
- Zoom: século, década, ano, mês e dia. Século e década contam anos do calendário do mundo, também antes do zero. Cada tipo de registro possui escala mínima padrão configurável por mundo; uma aparição pode substituí-la. Padrões iniciais: Evento em ano; Personagem, Local e Organização em mês; demais tipos em dia. Em escalas amplas, agregados indicam quantos cartões estão ocultos por detalhe e permitem aproximar o zoom.
- Filtro de categoria usa os tipos de registro existentes no mundo, com seleção múltipla. Busca cobre título de apresentação e título do registro. Ambos ocultam temporariamente, nunca removem aparições. Filtro, busca, vista e zoom ficam na URL; as duas vistas partilham o mesmo estado.

## Interface e ações

- O catálogo existente de `timeline` continua criando linhas. A página de leitura de uma linha recebe composição específica, mantendo a linguagem editorial e tokens semânticos existentes.
- Cabeçalho: título, acesso a edição da linha e calendário. Barra: alternância vertical/horizontal, zoom, categorias, busca, contagens de itens totais/visíveis/ocultos.
- Biblioteca de registros pesquisável e filtrável: painel fixável no desktop, gaveta no celular. Inclusão individual, inclusão em lote e criação rápida de Evento com título e data; após criar, acesso ao editor completo do Evento.
- Soltar um registro em um período apenas sugere a data e abre formulário compacto para confirmar título de apresentação, nota, data e escala mínima. O botão **Adicionar** realiza a mesma ação sem arrastar. Soltar uma aparição na área **Remover da linha** remove somente aquela aparição e oferece **Desfazer**; menu e teclado oferecem ação equivalente.
- Clicar num cartão abre painel para editar seus campos e acessar o registro original. A capa do registro pode ser exibida ou ocultada. Não há imagem ou cor exclusiva por aparição nesta entrega.
- Vista vertical: uma coluna agrupada por período, com seção **Sem data**. Vista horizontal: eixo rolável com marcas de tempo e trilhas automáticas para impedir sobreposição. No celular, a vertical é a vista inicial, mantendo a horizontal acessível por toque.
- Mostrar estados vazios distintos: linha vazia, filtro sem resultados, apenas itens sem data e registro na lixeira. Foco, nomes acessíveis, contraste, alternativa ao arraste e avisos de confirmação/desfazer são critérios de aceite.

## Migração e ciclo de vida

- O projeto atual grava campos `kind: 'date'` como strings ISO de `<input type="date">`. A conversão deve abranger **todos** os campos `date` definidos no `EntityTypeDefinition` de cada mundo, inclusive tipos personalizados, além dos dados de Evento e Linha do Tempo. O leitor e editor aceitam o formato antigo durante uma fase de expansão; a migração explícita converte os valores com prévia, relatório de inválidos, backup e confirmação. Uma migração interrompida deve ser retomável ou revertível, sem conversão silenciosa parcial.
- O calendário inicial de mundos existentes deve reproduzir as datas convencionais atuais antes de qualquer personalização. A conversão preserva ordem e distância entre datas ISO completas. Valores que não puderem ser convertidos permanecem identificados e editáveis para revisão, sem descarte.
- Alterar comprimento de mês, regra intercalar ou origem mostra o efeito em amostra e contagem de datas, preserva ordinais temporais e exige confirmação. Renomear unidades ou eras não desloca datas.
- O repositório deve distinguir registro ativo, registro em `trash/` e ausência definitiva. Uma aparição de registro na lixeira permanece com seu título/data próprios e aviso **Registro indisponível**. Depois de descarte permanente, suas aparições são retiradas da linha. Falha de leitura não deve ser confundida com ausência definitiva. A UI de descarte permanente de entidades pertence a outro esforço.

## Forma de implementação e documentação

- A UI e as ações usam contratos de repositório. O calendário é dado do mundo; as aparições têm persistência versionada própria vinculada à entidade `timeline`, evitando que o formulário genérico de entidade sobrescreva a lista. IDs são UUIDs, nunca paths ou slugs.
- Concentrar cálculo, formatação, validação e conversão temporal num módulo de domínio com interface pequena; vistas e formulários consomem o mesmo resultado. Evitar cálculos de calendário espalhados pelos componentes.
- Antes de editar Next.js, ler o guia relevante em `node_modules/next/dist/docs/`, conforme `AGENTS.md`. Usar os tokens de `src/app/globals.css`. Não copiar dados reais de `workspace/` para exemplos ou testes.
- Cada ticket atualiza as páginas afetadas de README, PROJECT, ADRs e `docs/`, ou registra explicitamente por que não há mudança documental. Verificar schema/migração, round-trip, isolamento entre mundos e ações destrutivas nos tickets correspondentes.

## Fora deste esforço

- Interface de descarte permanente ou restauração de entidades.
- Horários de aparição inferiores a um dia.
- Imagem ou cor própria por aparição; sincronização automática posterior da data com o registro original.
- Colaboração remota, autenticação, publicação pública e troca de calendário entre mundos.

## Entregas

Executar os tickets em [issues/](issues/) respeitando **Blocked by**. Cada ticket produz um comportamento verificável de ponta a ponta; a especificação e os tickets de decisão do mapa são a fonte para resolver dúvidas. Não marcar uma entrega como pronta apenas por concluir componentes visuais ou schemas isoladamente.
