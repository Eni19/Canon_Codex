# Cosmic Canvas — validação de 500 aparições

Verificação em **15/10/2026**, Windows, navegador integrado Chrome 155. Dados exclusivamente
sintéticos no diretório temporário canon-timeline-visual-tl12. Nenhum conteúdo privado foi acessado.

## Implementação e limites

A página de Linha do Tempo existente foi refatorada em três camadas: estrelas CSS independentes,
mapa transformado e UI fixa. Coordenadas pertencem à coleção inteira, com ordenação cronológica e
faixas alternadas de dez; filtros só alteram visibilidade. Distâncias não representam duração em dias.
Datas, intervalos, escala mínima e campos próprios permanecem nos detalhes/editor.

Pointer Events, wheel não passivo e requestAnimationFrame implementam a câmera, sem dependência
nova. O plano recebe um transform por quadro. React recebe somente mudanças de faixas de
visibilidade; SVG e cartões memoizados evitam revisar toda a coleção durante pan.
Há 500 pontos SVG, mas cartões HTML só próximos do viewport (teto 96). Abaixo de 28% de ampliação,
pontos e navegador preservam acesso ao conjunto. Todos os dados continuam carregados.

## Medição de exploração

O harness scripts/timeline-canvas-profile.html carrega a página real em iframe de mesma origem.
O cabeçalho ocupa 100 px; viewports do navegador 1440×1000 e 390×944 deixam a aplicação em
1440×900 e 390×844. O ensaio envia 75 movimentos de ponteiro, com wheel periódico, e coleta
74 intervalos de requestAnimationFrame, tarefas longas, layout shift, cartões e animações.

| Ambiente | p95 de intervalo | Máximo | Quadros >32 ms | Tarefas longas | Cartões máximos | Layout shift |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Desenvolvimento, antes de memoizar | 69,3 ms | 94,4 ms | 10 | 90/84/78/65/64 ms | 18 | 0 |
| Desenvolvimento, depois | 28,7 ms | 51,8 ms | 2 | nenhuma | 18 | 0 |
| Produção desktop, coleta final | 31,9 ms | 55,7 ms | 3 | nenhuma | 18 | 0 |
| Produção mobile, coleta final | 26,5 ms | 27,3 ms | 0 | nenhuma | 12 | 0 |

As coletas desta tabela antecedem a correção posterior do fundo animado: tinham 500 pontos e
uma animação contínua (somente brilho). O fundo corrigido compartilha uma animação de deriva
entre estrelas e névoa; os números abaixo não são uma medição desse novo efeito. JSON bruto:
[antes](timeline-cosmic-dev-before.json), [depois](timeline-cosmic-dev-after.json),
[produção desktop](timeline-cosmic-production-desktop.json) e
[produção mobile](timeline-cosmic-production-mobile.json).

O ensaio é curto e sensível à instrumentação. Nas primeiras coletas, captura da árvore acessível
ocorreu durante os quadros; desktop registrou 41,6 ms e mobile 71,2 ms de p95, este último com uma
tarefa de 124 ms. Houve também testes concorrentes na primeira coleta desktop. Esses resultados
foram preservados em [desktop inicial](timeline-cosmic-production-desktop-initial.json) e
[mobile inicial](timeline-cosmic-production-mobile-initial.json). As coletas finais ocorreram sem
testes concorrentes, aguardando o marcador de conclusão antes da captura da árvore acessível.
Os resultados não garantem 60 FPS, nem desempenho equivalente em hardware físico ou outras máquinas.

## Invariantes e fluxos

Os nove checks do harness passaram em produção, em desktop, mobile e tablet:

1. Pan touch com translação exata.
2. Pinch de dois ponteiros mantendo a âncora no ponto médio.
3. Continuação com um dedo sem salto de escala/posição.
4. Cancelamento limpa o estado de arraste.
5. Ctrl-wheel amplia no cursor.
6. Busca preserva câmera.
7. Busca preserva retângulo da barra.
8. Busca preserva as 500 coordenadas.
9. Busca não remonta filhos do mapa (zero mutações childList).

Evidências: [gestos desktop](timeline-cosmic-gestures-desktop.json) e
[gestos mobile](timeline-cosmic-gestures-mobile.json) e [tablet](timeline-cosmic-gestures-tablet.json). São eventos sintéticos nos handlers reais;
não comprovam pinch em tela física, trackpad físico ou gestos reservados de Safari/iOS.
Uma recarga do Fast Refresh invalidou o documento do primeiro ensaio móvel; a repetição estável
e as duas verificações de produção passaram.

No navegador também foram verificados: arraste real de mouse com delta −120/−90; wheel real
preservando exatamente o ponto do mundo sob o cursor; categorias combinadas e detalhe cronológico
sem reset da câmera; teclado Home; orientação e Voltar; navegador para Sem data com foco no cartão;
detalhes/editor sobrepostos; edição de data movendo a aparição, foco correto ao fechar e restauração
da data original; remoção/Desfazer; cancelamento de inclusão com contagem preservada e foco na
biblioteca; criação rápida de Evento com aparição, inclusão individual no celular, inclusão em
lote (89 ausentes) e repetição idempotente (total conservado em 91); conteúdo, propriedades, relações, backlinks e padrões no painel Sobre esta linha.
Com 500 aparições, Ajustar à tela mostrou os 500 pontos sem cartões HTML; Ir para Sem data
localizou a aparição 451, devolvendo foco ao título e montando apenas 15 cartões próximos.
Desktop 1440×900 e mobile 390×844 não apresentaram overflow externo na página de sete aparições.
A revisão de tablet 768×1024 encontrou o navegador de acontecimentos fora da barra ao manter a
sidebar aberta. Consultas de contêiner passaram a usar a largura útil do mapa, com duas fileiras
fixas abaixo de 720 px. Todos os controles ficaram contidos em tablet (área útil 512 px) e celular
estreito 320×740, sem overflow externo. A busca ocupa sempre a segunda fileira compacta.

O arraste nativo de registros para inclusão e cartões para remoção mantém MIME/handlers anteriores,
mas não foi confirmado com dispositivo físico nesta verificação. Os botões equivalentes e os testes
de repositório cobrem inclusão, remoção, validação e recuperação. Movimento reduzido tem cobertura
de domínio/remoção e implementação CSS/câmera; não foi emulado visualmente no navegador.

## Reproduzir

Use a fixture opt-in e o diretório temporário validados conforme o
[perfil histórico](timeline-500.md). A aplicação deve executar com WIKI_WORKSPACE_DIR apontando
explicitamente para esse cenário sintético. Copie temporariamente o harness para public/,
abra /timeline-canvas-profile.html na mesma origem e aguarde Pronto. Execute um ensaio de cada vez;
para medidas independentes, recarregue entre ensaios. Evite builds/testes/capturas durante a coleta.
Remova a cópia de public/ ao terminar; o harness em scripts/ é uma ferramenta de QA, não uma rota
ou aplicação entregue ao produto.

## Qualidade e documentação

Build Next 16.3.4 de produção e TypeScript passaram. ESLint de src/ e scripts/ passou. Os 36 testes
de linha do tempo passaram, incluindo cinco de câmera/geometria (500 cartões, ambas as orientações).
Suíte completa: 137 aprovações e uma falha preexistente em taldoreiPack.test.ts:49, que espera mais
de 100 relações e encontra 49. Essa falha não exercita o canvas.

Foram atualizados guia, README, PROJECT, glossário, ADR-005, arquitetura, referência de URL/actions,
testes e trabalho registrado. Perfis/especificação antigos foram identificados como históricos.
Armazenamento, migrações, backup, autenticação, variáveis e contratos de repositório/actions não
mudaram nesta refatoração; suas páginas não precisam de nova versão ou procedimento de migração.
Após as medições, o ajuste exclusivamente cromático solicitado pelo usuário passou a derivar
os tokens da paleta do aplicativo: âmbar/latão, texto pergaminho, cinza quente e as mesmas bordas.
Somente fundo e superfícies são escurecidos por mistura com preto. A inspeção de estilos no
navegador confirmou igualdade de acento/texto/borda com o tema global. Geometria, gestos e lógica
não foram alterados por esse ajuste; as capturas abaixo foram atualizadas com a paleta final. A
[pesquisa](../research/timeline-cosmic-canvas.md) compara bibliotecas e reúne referências primárias.

## Capturas

- [Desktop](timeline-cosmic-desktop.jpg)
- [Mobile](timeline-cosmic-mobile.jpg)
- [Tablet](timeline-cosmic-tablet.jpg)

## Correção do fundo animado — 15/10/2026

O fundo anterior variava apenas a opacidade de poucas estrelas minúsculas em 14 s, parecendo
estático. A correção aumenta a densidade/luminosidade, acrescenta névoa em tons da paleta global e
compartilha deriva/cintilação entre os três elementos decorativos em **uma animação CSS de 22 s**.
A camada usa transform/opacity, fica abaixo do canvas e não intercepta ponteiros. Movimento
reduzido mantém o campo estático. Não há loop React ou nova dependência.

O probe de estilos computados passou de visibleSpatialMotion=false para true; duas amostras
registraram transform e posição diferentes do fundo, com pointer-events=none. Veja a
[evidência de movimento](timeline-cosmic-background-motion.json) e a
[captura atual](timeline-cosmic-background.jpg). O arraste real da versão final preservou delta 60/20 e a busca
preservou a câmera. Build de produção/TypeScript e lint do componente passaram. Não houve novo
teste unitário de CSS: a verificação usa o efeito renderizado na página real.

A primeira variante animava as duas camadas de estrelas e a névoa separadamente. O ensaio de
500 acontecimentos indicou custo maior; a versão final compartilha um único plano animado.

| Variante | Viewport da aplicação | p95 | Máximo | Tarefas longas | Animações ativas | Layout shift |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| Três animações separadas | 1440×900 | 61,7 ms | 138,4 ms | 68 ms | 3 | 0 |
| Final compartilhada | 1440×900 | 39,5 ms | 74,8 ms | nenhuma | 1 | 0 |
| Três animações separadas | 390×844 | 56,9 ms | 74,8 ms | nenhuma | 3 | 0 |
| Final compartilhada | 390×844 | 32,2 ms | 38,4 ms | nenhuma | 1 | 0 |

JSON: [primeira desktop](timeline-cosmic-background-three-layers-desktop.json),
[primeira mobile](timeline-cosmic-background-three-layers-mobile.json),
[final desktop](timeline-cosmic-background-desktop.json) e
[final mobile](timeline-cosmic-background-mobile.json). Os ensaios tiveram 74 intervalos, 500 pontos
SVG e máximos de 18/12 cartões montados. São coletas curtas, sensíveis ao ambiente e aquecimento;
a primeira câmera desktop inicializou antes de terminar o redimensionamento do viewport.
Não constituem isolamento do custo de GPU nem promessa de 60 FPS. Touch físico e a preferência
de movimento reduzido continuam sem emulação visual neste ensaio.
