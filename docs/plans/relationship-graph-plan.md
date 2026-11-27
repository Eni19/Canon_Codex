# Plano do grafo de relacionamentos e dos novos canvas

> **Estado:** parcial (REL-01 a REL-06 e REL-09 implementados; REL-07 em validação no #46; REL-08
> em andamento no #17: Cenas migradas para Konva em 26/11/2026; Quadros com a etapa 1 em 26/11/2026) · **Última verificação:** 25/11/2026, estimativa do REL-08 contra
> `investigation-board.tsx` e `scene-runner.tsx`.

Replanejado em **16/11/2026**, a partir do código atual, da imagem enviada pelo usuário e da
[pesquisa de interface e desempenho](../research/relationship-canvas-ux-performance.md).
**Em validação: REL-02 a REL-07.** A migração dos outros canvas fica por último, depois da
validação visual, funcional e de fluidez do grafo.
Pastas no grafo foram implementadas em REL-09.

## Ponto de retomada

**Implementado:** superfície integral na rota, controles HTML contextuais, duas camadas Konva,
câmera preservada durante filtros e resize, arraste de porta, alternativa pesquisável, setas
livres editáveis e autosave da vista após alterações concluídas. A organização inicial é estática,
reproduzível e usa os vínculos para aproximar registros. As posições fixadas são preservadas.
O desenho é limitado por viewport e nível de zoom; mover um cartão atualiza as arestas incidentes.
O [guia de entidades](../user-guide/entities.md#referências-e-relações) descreve a interface.

O grafo recebe todos os registros ativos do mundo, inclusive os que ainda não têm vínculos.
Eventos, objetos e artefatos, personagens, locais, organizações, linhas do tempo e tipos
personalizados podem aparecer juntos. Os filtros e a vizinhança só mudam o recorte da vista.

**Em validação:** protocolo de fluidez, memória, gesto em hardware físico e leitor de tela.
O [relatório](../performance/relationship-graph.md) distingue as verificações da versão atual
da medição HTTP histórica. As setas livres v3 aceitam IDs opcionais dos cartões nas pontas;
as anotações sem esses campos continuam legíveis.

## Contrato visual obrigatório

Ao abrir Relacionamentos, toda a área ao lado do menu é o canvas; no celular, toda a área abaixo
da navegação móvel. Em repouso, aparecem o grafo e ferramentas compactas. Painéis só aparecem
por ação explícita e se sobrepõem à superfície, sem deslocar o grafo.

| Elemento | Comportamento planejado |
| --- | --- |
| Superfície | 100% da largura/altura úteis, sem moldura externa, largura máxima, margens de página ou rolagem do documento. Menu preservado. Não depende da Fullscreen API. |
| Fundo | Grafite quente com tokens do Canon; pontilhado estático muito discreto, opcional. Sem painel bege ou decoração animada contínua. |
| Cartões | Superfície levemente elevada, título legível, tipo curto e borda sutil; seleção âmbar. Sem descrições, contagens ou metadados adicionais. |
| Conexões | Curvas consistentes, pontas legíveis e destaque ao selecionar. Rótulos completos por seleção/foco ou zoom adequado. Direção e tipo não dependem só da cor. |
| Ferramentas | Uma barra flutuante compacta: Selecionar/Mover, **Conectar** como ação principal, Seta livre, Busca e filtros e Mais. Ícones com nomes acessíveis, tooltip e estado ativo. |
| Câmera | Pequeno grupo de zoom e Enquadrar em um canto; sem minimapa permanente nesta entrega. |
| Busca, filtros e legenda | Busca e filtros com atalho direto na barra; legenda sob demanda via Mais. Indicador de filtro ativo e ação Limpar. A busca esmaece os descartados antes de aplicar o recorte. |
| Detalhes | Inspetor contextual; um painel por vez. No celular, folha sobreposta com altura limitada e rolagem interna. |
| Listas acessíveis | Navegador HTML de itens/vínculos aberto por comando, com busca/paginação; não manter listas abaixo do canvas. |
| Salvamento | Automático após alteração concluída, com indicador compacto durante gravação. Falha/conflito permanece visível até resolução. |
| Vazio | Mensagem curta e ação apropriada: criar registro, conectar existentes ou limpar filtros. Falha de carga não aparece como grafo vazio. |

Remover do estado inicial breadcrumbs, título editorial, instruções, contagens, formulários,
legenda e listas expandidas. Manter identificação acessível da página e navegação selecionada.
Usar os tokens de `globals.css` conforme o [ADR-005](../architecture/ADR-005-design-system.md),
inclusive resolvendo cores para o Konva e reagindo à troca de tema. Preservar a variante clara.
A direção visual é uma adaptação para o Canon; não copiar a decoração da Linha do Tempo.

## Base técnica preservada

Manter **Konva**: os problemas observados não demonstram impedimento do motor. Comparações na
pesquisa servem para orientar a decisão; trocar de biblioteca não resolve por si só dimensionamento,
excesso de controles ou reconstrução da cena. Só reconsiderar o motor após impedimento reproduzível
e perfil. Não adicionar outro renderizador ou framework de animação apenas para redesenhar esta tela.

Preservar operação local sem conta, assinatura, chave, CDN, serviço de layout remoto ou marca-d'água
do motor e manter os avisos MIT do Konva. Ferramentas, formulários e alternativa acessível ficam em
HTML. Separar superfície/ciclo de vida, câmera/gestos, reconciliação de objetos, layout, ferramentas
e persistência. Extrair uma base compartilhada somente quando houver um segundo consumidor real.
Antes de escrever código, ler os guias pertinentes em `node_modules/next/dist/docs/`.

## REL-02 — Ocupar toda a área útil

1. Retirar `PageContainer`, breadcrumbs e título visível de `/relationships`. Dar à rota um modo
   de superfície no `WikiShell`, com cadeia de altura definida, `min-height: 0`, `min-width: 0`
   e overflow controlado. Não alterar o layout das outras páginas.
2. Usar a área calculada pelo layout, sem subtrair largura fixa do menu ou cobri-lo com um elemento
   fixed. Considerar altura dinâmica da janela e navegação móvel.
3. Observar largura **e altura** do host com `ResizeObserver`. O backing canvas tem o tamanho do
   viewport; o mundo é virtual. Resize preserva centro do mundo e zoom, sem fit automático.
4. Sobrepor ferramentas/painéis em HTML; áreas vazias do overlay não interceptam ponteiros.

**Aceite:** retângulo do canvas igual ao da área útil, com tolerância de 1 CSS px, em 1440×900,
1280×720 e 390×844. Verificar resize, orientação e zoom do navegador, sem scrollbar de documento,
margem externa, conteúdo abaixo ou sobreposição ao menu.

## REL-03 — Refinar visual e reduzir controles

1. Implementar o contrato visual com tokens e componentes existentes; foco visível, contraste,
   nomes acessíveis e alvos confortáveis para toque.
2. Mover busca, tipos, vizinhança, legenda, lista acessível e restauração de organização para
   painéis sob demanda. Abrir/fechar painel não altera geometria/câmera. Restaurar organização
   requer ação explícita e confirmação quando descartar posições fixadas.
3. Refazer cartões e seleção. Portas de conexão aparecem ao selecionar ou ativar Conectar,
   inclusive no toque/teclado, sem depender de hover.
4. Gerar conexões e amostras pelo mesmo catálogo de estilos: cor complementar a traço/ponta/símbolo.
   Preservar tipo, rótulo e direção antigos; sem direção usa terminais simétricos. Manter paralelas,
   direções opostas e auto-relações legíveis e selecionáveis.
5. Tratar carregamento, vazio, filtro sem resultado e falha sem adicionar explicações permanentes.

**Aceite:** capturas sintéticas pequeno/denso/vazio/filtrado/selecionado nos dois temas e tamanhos
desktop/móvel. Em repouso, somente menu, canvas, grafo e controles compactos. Inspeção visual em
navegador é obrigatória; build não comprova qualidade visual.

## REL-04 — Estabilizar câmera e gestos

1. Criar Stage uma vez por montagem/mundo e destruir no unmount. Reconciliar nós/arestas por IDs;
   atualizar atributos/visibilidade sem recriar Stage. Não atualizar a árvore React inteira por
   movimento do ponteiro; câmera corrente em estado imperativo isolado.
2. Preservar câmera/seleção/posições ao filtrar, salvar, editar estilos, abrir painel ou criar relação.
   Fit só na abertura inicial sem câmera ou por Enquadrar; **Ver no grafo** centraliza uma vez.
3. Pan pelo fundo/ferramenta Mover e Espaço+arraste fora de campos editáveis. Wheel com zoom ancorado
   no ponteiro; trackpad com pan de dois dedos e pinch tratado como zoom. Normalizar deltas/limites
   e verificar as distinções de eventos em hardware real.
4. Toque: um dedo move cartão ou fundo conforme alvo; dois dedos fazem pinch/pan e cancelam drag
   anterior. Tratar cancelamento, saída da janela e liberação sem modo preso. Formulários não
   movimentam o canvas.
5. Gestos diretos, sem easing/fila de animações; aproveitar redraw automático do Konva. Transições
   breves de painéis/enquadramento respeitam movimento reduzido. Nenhum loop ocioso contínuo.

**Aceite:** filtros, edição e salvamento mantêm transformação; zoom mantém ponto sob cursor e
resize mantém centro. Testar essas invariantes e limpeza de Stage/listeners/observers/frames ao sair.

## REL-05 — Criar relacionamentos no canvas

1. Conectar por arraste de porta ou dois cliques/toques: origem → destino, seta em prévia,
   destaque de alvo, Escape e cancelamento visível. Pan ou soltar no vazio não grava relação.
2. Após escolher o par, formulário compacto sobreposto: tipo existente/novo, direção, rótulo
   opcional e prévia. Alternativa HTML com seleção pesquisável seguindo `CardPicker` do projeto.
3. Confirmar grava pelo caminho de relações usado nas fichas. Seleção da seta abre edição e links
   aos registros; remoção exige confirmação. Prévia nunca é persistida como vínculo.
4. Seta com uma ponta no fundo continua anotação da vista, com início/fim, edição de extremidades e remoção
   contextual; não cria relação entre entidades ou backlinks.
5. Autosave da vista após dragend/alterações confirmadas, agrupando mudanças próximas e
   serializando gravações. Nunca salvar por pointermove. Preservar edições feitas durante request,
   usar revisão/conflito existente e oferecer repetir ou recarregar com aviso de alterações locais.
   Só indicar salvo após resposta; proteger saída com pendências. Relações mantêm confirmação
   explícita no formulário, independentemente do autosave da vista.
6. Preservar validação de origem/destino/mundo no servidor, reenvio idempotente, escrita atômica,
   posições versionadas e catálogo. Backlinks derivados da origem; alvos inativos ocultam vínculos
   sem apagar a relação persistida. Referências de propriedades continuam fora deste recorte.

**Aceite:** criar/editar/remover/recarregar e testar falha, reenvio e conflito com dados sintéticos.
Teclado/leitor de tela operam os mesmos fluxos em HTML; foco retorna ao acionador. Nenhuma mudança
de schema é pressuposta; se necessária, justificar e documentar antes de alterar persistência.

## REL-06 — Organizar o grafo e comprovar fluidez

1. Comparar a grade atual com layout estático orientado às conexões, componentes separados e
   prevenção de sobreposição. Preservar posições fixadas, IDs e resultado estável. Escolher por
   legibilidade/medição. Se usar forças, cálculo finito fora da interação, em worker quando o custo
   justificar; sem simulação contínua durante navegação. Descartar resultados de mundo/versão antigos.
2. Layout inicial ou por comando; filtros não redistribuem itens. Novos cartões não deslocam os
   fixados. Persistir o resultado final e permitir restaurar organização explicitamente.
3. Manter poucas camadas e desligar hit-testing de decoração/textos/pontas sem ações. Camada
   temporária de drag e caches só quando perfil justificar; não criar camada/cache por cartão.
4. Indexar arestas por nó e recalcular somente incidentes ao cartão arrastado. Reconciliar objetos
   alterados em vez de reconstruir toda a cena.
5. Desenhar por área visível com margem e índice espacial quando necessário. Considerar o trajeto
   das arestas: conexões cruzando o viewport continuam visíveis mesmo com pontas fora dele.
   Objetos em interação não desaparecem. Culling não remove itens da alternativa HTML.
6. Nível de detalhe por zoom: formas/linhas simples ao longe, títulos quando legíveis, rótulos por
   seleção/foco. Ajustar limiares visualmente, mantendo direção e distinção entre vínculos.
7. Medir antes/depois no mesmo dispositivo, navegador, viewport e DPR em build de produção.
   Reutilizar fixture de **500 itens/1.500 relações** e cenários pequeno/denso, paralelas e loops.
   Dados exclusivamente sintéticos em diretório temporário isolado.

### Metas e critérios de medição

| Medida | Critério |
| --- | --- |
| Fluidez em desktop de referência, 60 Hz | Três execuções de 10 s para cada gesto: pan, zoom e drag. Mediana próxima de 16,7 ms e p95 dos intervalos de frame ≤ 20 ms no cenário 500/1.500; registrar frames perdidos e traces. Não inferir FPS por HTTP ou só por callbacks rAF. |
| Resposta visual | p95 ≤ 50 ms da entrada ao frame que mostra seleção/movimento, medido por trace/instrumentação. Investigar stalls acima de 50 ms atribuíveis ao grafo. |
| Abertura | Separar HTTP, hidratação/import e primeira cena interativa. Alvo inicial ≤ 1 s entre dados disponíveis no cliente e cena utilizável; registrar cold/warm e ambiente. |
| Ociosidade/memória | Sem redraw contínuo. Após 20 ciclos de abrir/fechar e usar filtros/painéis, sem Stages/listeners acumulados; comparar heap após GC. |
| Estabilidade | Sem branco ou salto da câmera ao filtrar, salvar, redimensionar ou abrir painel. |

**Aceite:** atualizar [perfil do grafo](../performance/relationship-graph.md) com hardware, navegador,
build, dataset, DPR, protocolo, resultados e limites. Metas são orçamento de projeto, não garantia
da biblioteca ou de hardware universal. Não aprovar fluidez somente com HTTP/testes de domínio.

## REL-07 — Validar antes de migrar

- Revisão visual dos temas, resoluções, painéis, conexões e estados. Nenhum controle cobre
  permanentemente o registro focado.
- Mouse, teclado, leitor de tela, trackpad e toque físico; foco, anúncios de resultado/erro,
  alternativa HTML e retorno ao canvas. O que não for testado permanece não verificado.
- Relações antigas, direção, paralelas, loops, filtros/legenda, recarga, falha, reenvio, conflito,
  isolamento entre mundos e lixeira/restauração via fixtures sintéticas.
- Lint, tipos, testes pertinentes e build; inspeção em produção local com runtime sem rede externa,
  chave ou marca-d'água. Ler o guia de testes e **nunca acessar `workspace/`**.
- Atualizar guia de entidades para o comportamento entregue e README, PROJECT, arquitetura/ADRs,
  dados e interfaces conforme mudanças reais.

**Portão de migração:** REL-02 a REL-07 concluídos com evidências visuais, funcionais e de desempenho.
Até lá, Quadros, Cenas e Linha do Tempo ficam fora da execução.

A [validação em produção de 17/11](../performance/relationship-graph.md#validação-da-versão-com-pastas--17112026)
confirmou o fluxo de pastas, os controles e avisos na árvore de acessibilidade do Chrome e o uso por
teclado. O p95 de pan, zoom e arraste no cenário denso ficou acima de 20 ms. Leitor de tela e gestos
em dispositivos físicos seguem pendentes.

### Roteiro manual para fechar REL-07

Estes passos precisam de uma pessoa com o dispositivo real; o ambiente automatizado não substitui
leitor de tela, trackpad ou tela de toque físicos. Use um mundo sintético (veja o
[perfil do grafo](../performance/relationship-graph.md)) e registre falhas em um [issue com label `bug`](https://github.com/Eni19/Canon_Codex/issues?q=is%3Aissue+is%3Aopen+label%3Abug).

1. **Leitor de tela (NVDA no Windows ou VoiceOver no macOS).** Abra **Relacionamentos**, navegue
   com Tab até a barra de ferramentas e confirme que cada botão é lido com nome e estado
   (pressionado/expandido). Abra a lista acessível, busque um registro e confirme que a contagem
   de resultados é anunciada. Abra a ficha pelo teclado, feche com Esc e confirme que o foco volta
   ao botão de origem. Simule uma falha de salvamento (servidor parado) e confirme que o aviso é
   lido sem mover o foco.
2. **Zoom nativo do navegador.** Com Ctrl + e Ctrl − (até 200%), confirme que barras, painéis e a
   navegação de pastas continuam utilizáveis e que nenhum controle cobre o registro focado.
3. **Trackpad.** Dois dedos deslocam a câmera; pinça aproxima e afasta em torno do cursor; um
   clique seleciona; arrastar um cartão move só o cartão. Confirme que a página não rola junto.
4. **Tela de toque.** Toque seleciona; arrastar o fundo desloca; pinça com dois dedos aproxima;
   arrastar um cartão até uma pasta o move; o aviso de salvamento aparece e some.
5. **Desempenho percebido.** No mundo de 500 registros, desloque, aproxime e arraste por alguns
   segundos e anote travadas visíveis, com o modelo do dispositivo e o navegador.

Em 25/11/2026, com o Chrome emulando toque pelo CDP, o toque em um cartão abriu a ficha e a pinça
aproximou a câmera no mundo de 500 registros. Isso não conta como validação física.

## REL-09 — Pastas no grafo

**Implementado.** Organizar cartões de qualquer tipo em pastas diretamente em **Relacionamentos**.
Cada pasta pertence ao mundo atual e agrupa os mesmos registros que já aparecem no grafo.

1. Exibir pastas em um navegador no canto do grafo. Clicar no nome abre os registros dessa
   pasta no canvas inteiro; **Vista principal** mostra os registros sem pasta. Oferecer criação
   e gestão por botões próximos aos nomes. Uma pasta aceita tipos misturados.
2. Permitir arrastar um cartão do canvas até uma pasta ou **Vista principal**, com destaque do
   destino antes de soltar. Oferecer também **Mover para** na ficha e movimentação em lote na
   lista acessível. A busca do canvas consulta a vista aberta; a lista pesquisa os registros
   de todas as pastas. **Ver no grafo** abre a pasta correspondente e focaliza o registro.
   A gestão da pasta oferece seus vínculos externos.
3. Persistir a organização da vista por mundo, com IDs de pasta e de registro. Validar
   no servidor se os registros pertencem ao mundo e manter as posições e os vínculos
   ao mover cartões. Excluir uma pasta devolve os cartões à vista principal.
4. Antes de alterar o armazenamento, definir compatibilidade com vistas já salvas.
   Atualizar a documentação do formato e os testes com mundos sintéticos.

**Critérios de aceite**

Criar uma pasta pela tela, mover registros de tipos diferentes por arraste e pela lista, recarregar e
verificar que a organização foi preservada. Abrir pastas pelo navegador no canto, buscar um cartão
na lista e abrir sua ficha por teclado e toque. Cancelar um arraste e conferir sua posição original.
Excluir a pasta e confirmar que os registros,
vínculos e posições estão disponíveis na vista principal. Verificar o isolamento entre mundos.

O [teste de persistência](../../src/repositories/filesystem/graphSettings.test.ts) cobre leitura de
vistas v1–v3, membros de tipos diferentes, isolamento entre mundos e preservação de posições e
vínculos ao excluir a pasta. Em Chrome com dados sintéticos, foram verificados criação, renomeação,
movimentação em lote, indicador de vínculos externos, busca, recarregamento, abertura da ficha por
teclado, exclusão e recolhimento/expansão com toque emulado. Essa verificação registra a interface
anterior à navegação por pastas de 18/11. A validação em dispositivo físico e
com leitor de tela permanece em REL-07.

## REL-08 — Etapa final: migrar os outros canvas

Esta é a **última etapa**. Quadros e Cenas usavam tldraw/snapshots e já migraram para Konva
(26/11/2026); a Linha do Tempo usa superfície própria com SVG/cartões HTML. Reaproveitar base validada sem impor layout de grafo aos outros editores.

1. **Inventariar/converter:** cartões, desenhos, anotações, texto, imagens, grupos e setas vinculadas.
   Formato Canon versionado; conversor idempotente com prévia, backup, incompatibilidades e restauração.
   Testar snapshots sintéticos; preservar original e bloquear troca automática diante de perda.
2. **Quadros de investigação** (etapas 1 e 2 em 26/11/2026: canvas, cartões, texto, setas e as
   ferramentas de criação, sem marca-texto, laser e moldura; falta o painel de estilo): preservar variações de cartões, imagens, setas, posições, camadas,
   referências por ID, anotação, autosave e recuperação. Validar reabertura das cópias antes da troca.
3. **Cenas** (migradas em 26/11/2026; validação visual em uso real pendente): preservar mapa, grade/encaixe, tokens/transformações, camadas, bloqueio, pontos de
   interesse, revelações e duplicação. Validar Preparar/Mestrar/projeção, câmera e a garantia de
   que itens ocultos não chegam à janela do jogador.
4. **Linha do Tempo, por último entre as superfícies:** preservar coordenadas cronológicas, cartões
   acessíveis, filtros, criação rápida e câmera. Comparar com o
   [perfil atual](../performance/timeline-cosmic-canvas.md); não aceitar regressão para uniformizar motor.
5. **Retirar tldraw:** após conversão, recuperação e paridade validadas, remover pacote e referências
   a `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`. Atualizar README, PROJECT, ADRs e guias de migração, backup,
   quadros/cenas/projeção; verificar produção HTTPS e runtime local sem chave, pagamento, rede
   externa ou marca-d'água em todas as superfícies migradas.

### Estimativa (25/11/2026)

O código acoplado ao tldraw é pequeno (`investigation-board.tsx` com cerca de 290 linhas e
`scene-runner.tsx` com cerca de 100), mas ele delega ao tldraw quase toda a edição. As Cenas usam
três formas próprias (fundo, token e ponto de interesse) sobre a câmera e a seleção do tldraw; os
Quadros usam uma forma de cartão de registro mais as ferramentas nativas de desenho livre, texto,
notas e setas ligadas a formas, que precisariam ser reescritas. Ordem sugerida, do menor risco ao
maior: (1) conversor de snapshots com prévia e backup; (2) **Cenas**, porque o conjunto de formas
é fechado e o motor Konva do grafo já cobre câmera, seleção, arraste e toque; (3) **Quadros**, que
exigem editor de texto no canvas, desenho livre e setas com vínculo. Cada etapa é uma entrega
separada. Enquanto isso, a [verificação da licença](../research/tldraw-license.md) indica usar uma
chave hobby se o app precisar abrir fora de `localhost`.

## Impacto documental

O guia de entidades, README, PROJECT e a arquitetura descrevem a versão implementada. O
[#17](https://github.com/Eni19/Canon_Codex/issues/17) registra a ordem para a migração. O arquivo da vista passa
à versão 4 quando salvo com alterações; versões 1 a 3 são lidas com pastas vazias. Os fluxos
de vínculo continuam usando as mesmas Server Actions.
