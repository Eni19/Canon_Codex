# Plano do grafo de relacionamentos e dos novos canvas

**Estado** · Há uma prova de conceito isolada em `/canvas-prototype` e uma área em `/relationships` com índices, filtros, vizinhança, legenda, organização persistida, criação e edição de vínculos e setas livres. Relações paralelas recebem curvas distintas e a gravação detecta conflitos. A conexão usa cliques nos cartões ou campos HTML; arrastar de um cartão a outro ainda não foi implementado. A validação de toque físico, acessibilidade assistiva, desempenho, a migração dos editores e a verificação de produção no navegador permanecem pendentes. O Konva é uma dependência local; seu aviso de licença MIT acompanha o pacote instalado.

## 1. Escolher e provar a base do canvas

Construir o editor do Canon Codex sobre **Konva**, que renderiza em `<canvas>` HTML5, tem licença MIT e funciona sem chave. A base e os recursos deste plano devem rodar localmente, sem assinatura, marca-d’água, conta, CDN ou serviço de layout hospedado. Manter os avisos de licença na distribuição. A implementação do editor, das ferramentas de edição e dos documentos será do Canon Codex. [Documentação do Konva](https://konvajs.org/docs/about.html) · [Licença MIT](https://github.com/konvajs/konva/blob/master/LICENSE)

- Fazer uma prova de conceito com arraste de nós, conexão entre cartões, setas personalizadas, pan, zoom por pinça e uma amostra de cartões, imagens e texto para antecipar a migração. Verificar o build de produção com os recursos servidos localmente. Usar apenas dados sintéticos.
- Se a prova indicar um impedimento no Konva, implementar a superfície própria com Canvas 2D nativo. Dimensionar o trabalho de desenho, seleção, transformação, testes de acerto do ponteiro e desempenho antes de seguir. Manter a mesma experiência de uso e o mesmo formato de dados do Canon Codex.
- Compartilhar câmera, coordenadas, gestos, seleção, arraste, redimensionamento e desenho de setas quando a implementação tiver mais de um consumidor. Carregar a superfície interativa no cliente. Manter a barra de ferramentas, a legenda e os formulários em HTML para operação por teclado e leitor de tela.

## 2. Implementar a área de relacionamentos

- Incluir **Relacionamentos** na navegação do mundo, com proposta de rota `/relationships`. Adicionar **Ver no grafo** na ficha para abrir o mesmo canvas centrado no registro. Permitir alternar entre a visão do mundo e a vizinhança do registro selecionado, com expansão de conexões, busca, filtros por tipo de item e relação e botão para enquadrar o recorte.
- Montar o grafo a partir das relações explícitas já gravadas nos registros. Consultar os dados do mundo uma vez por carregamento, montar os índices de entrada e saída em memória e enviar ao cliente os resumos necessários. Uma relação gera uma conexão por ID, inclusive quando aparece como backlink. Campos de referência da ficha ficam fora do primeiro recorte.
- Gerar uma disposição inicial automática, permitir mover ou fixar cartões e restaurar a organização automática sob comando. Salvar posições fixadas e preferências do grafo localmente por mundo, em dados versionados. Mostrar os detalhes do vínculo ao selecioná-lo e oferecer um atalho para abrir os registros conectados. Curvar conexões paralelas para manter cada seta selecionável.
- Tratar registros indisponíveis pelo estado atual do repositório. Ocultar do grafo os vínculos sem alvo ativo e preservar a relação gravada para que reapareça se o alvo voltar da lixeira.

## 3. Definir setas e legenda editável

Gerar as setas do canvas e as amostras da legenda a partir do mesmo catálogo de estilos do mundo. Cada tipo terá uma combinação visual distinta, identificável pelo traço e pela ponta ou por um símbolo, com cor complementar. A direção vem da relação gravada. Quando a relação for sem direção, usar terminais simétricos que não sugiram origem ou destino.

| Tipo de exemplo | Estilo na legenda | Leitura |
| --- | --- | --- |
| Pertence a | Linha contínua com triângulo preenchido | Do membro para o grupo |
| Investiga | Linha tracejada com ponta aberta | De quem investiga para o alvo |
| Protege | Linha dupla com uma ponta triangular | De quem protege para o protegido |
| Aliado de | Linha pontilhada com marcas iguais nas duas extremidades | Vínculo sem direção |

- A legenda mostra amostra, nome, significado, direção e controle para mostrar ou ocultar cada tipo. Em tela estreita, pode ser aberta como painel. Disponibilizar também uma lista navegável com origem, tipo e destino.
- Sugerir uma combinação distinta para tipos existentes e recém-criados. Dar ao usuário um editor com prévia para ajustar cor, traço, ponta e símbolo. Quando duas combinações ficarem visualmente iguais, pedir um segundo elemento de distinção. Preservar os valores de `type`, rótulo e direção das relações antigas ao introduzir o catálogo.

## 4. Criar e editar setas no próprio canvas

1. Clicar em **Conectar**, arrastar do item de origem para o destino ou selecionar os dois por clique, toque ou teclado.
2. Selecionar um tipo existente ou cadastrar um tipo, escolher a direção, acrescentar um rótulo opcional e conferir a prévia da seta.
3. Salvar a relação no mesmo repositório usado pelas fichas. Atualizar o grafo, a origem e os backlinks do destino. Ao selecionar uma seta existente, permitir editar tipo, rótulo e direção ou remover a relação com confirmação.
4. Oferecer **Seta livre** para desenhar uma anotação visual com estilo configurável. Permitir reposicionar e apagar a anotação. Gravar essa seta com a vista do grafo. A ferramenta **Conectar** é a que cria vínculos nas fichas.

Reusar o caminho de gravação de relações tanto no grafo quanto nas fichas. Validar no servidor a origem, o destino e o mundo e tornar a gravação segura para reenvio. Manter a escrita atômica no repositório local. Persistir posições, estilos e anotações como estado do grafo, com indicação de falha e opção de tentar salvar de novo.

## 5. Validar o grafo antes de migrar os editores existentes

- Conferir com dados sintéticos que relações antigas aparecem, dois tipos entre o mesmo par continuam legíveis, o sentido respeita os dados, filtros acompanham a legenda e as alterações feitas por qualquer uma das telas aparecem na outra. Conferir também recarga, falha de salvamento, repetição de envio, isolamento entre mundos e comportamento com lixeira e restauração.
- Testar teclado, leitor de tela, mouse e toque. Medir abertura, pan, zoom e seleção com um grafo denso, incluindo um cenário sintético de 500 itens e 1.500 relações. Ajustar nível de detalhe e desenho por área visível conforme o perfil medido.
- Rodar lint, checagem de tipos, testes e build. Conferir em navegador de produção que o grafo e qualquer exportação oferecida funcionam sem rede externa, chave ou marca-d’água.
- Documentar a navegação e a edição no guia de entidades. Atualizar README, PROJECT.md, documentação de arquitetura, ADRs de armazenamento e design e guias de dados conforme os contratos efetivamente implementados.

## 6. Etapa final — migrar os canvas do aplicativo

Quadros de investigação e Cenas usam tldraw e persistem snapshots desse editor. A licença hobby mantém a marca-d’água em produção. A Linha do Tempo usa uma superfície própria, com SVG e cartões HTML. Migrar primeiro os editores dependentes do tldraw e portar a superfície da Linha do Tempo ao final, preservando os resultados medidos do canvas atual. [Licença do tldraw](https://tldraw.dev/community/license) · [Guia de quadros, cenas e projeção](user-guide/boards-scenes-and-projection.md) · [Perfil da Linha do Tempo](performance/timeline-cosmic-canvas.md)

1. **Inventariar e converter.** Mapear os tipos de objetos e vínculos suportados nos snapshots, inclusive anotações, desenhos, textos, imagens, grupos e setas ligadas a objetos. Criar um formato versionado do Canon Codex e um conversor com prévia, backup, relatório de itens incompatíveis e restauração. Testar a conversão com snapshots sintéticos. Uma execução repetida deve produzir o mesmo resultado. Preservar o original até a validação da cópia e bloquear a troca automática se a conversão detectar perda.
2. **Migrar Quadros de investigação.** Preservar cartões e suas variações, imagens, setas, posições, camadas, referências por ID, ferramentas de anotação, autosave e recuperação da sessão. Validar reabertura de documentos convertidos e edição dos novos antes de substituir o editor.
3. **Migrar Cenas.** Preservar mapa, grade e encaixe, tokens e suas transformações, camadas, bloqueio, pontos de interesse, revelações e duplicação. Validar os modos Preparar e Mestrar e a projeção ao vivo, incluindo a câmera e a garantia de que itens ocultos não chegam à janela do jogador.
4. **Portar a Linha do Tempo.** Reusar a base de câmera e gestos e desenhar a camada gráfica no novo canvas, mantendo os cartões interativos e acessíveis em HTML. Preservar as coordenadas cronológicas, os filtros e a criação rápida. Comparar a fluidez e a navegação com o perfil atual antes de trocar a superfície.
5. **Retirar o tldraw.** Após a validação da conversão, da recuperação e da paridade dos fluxos, remover o pacote e as referências a `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`. Atualizar README, PROJECT.md, ADRs, guias de migração, backup, quadros, cenas e projeção. Verificar o build em HTTPS de produção e o funcionamento local sem chave, pagamento, rede externa ou marca-d’água em todas as superfícies migradas.
