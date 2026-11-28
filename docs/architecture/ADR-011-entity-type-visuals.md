# ADR-011: Forma e textura próprias por tipo de registro

> **Estado:** parcial; grafo e Quadros usam silhuetas e texturas, legenda e ajustes ainda não · **Última
> verificação:** 27/11/2026, `src/domain/entities/entityVisual.ts`,
> `src/domain/canvas/entitySilhouettes.ts`, `src/lib/canvas/entityTextures.ts`,
> `src/lib/canvas/textureTheme.ts`, `src/components/relations/relationship-scene.ts` e
> `src/components/boards/board-render.ts`.

## Estado atual em 27/11/2026

O catálogo de identidade visual está no domínio (`entityVisual.ts`), com testes de unicidade e do
padrão neutro. As silhuetas são traçadas por `entitySilhouettes.ts` em qualquer caminho 2D, e o grafo
de relacionamentos já as usa no cartão individual, no lote do zoom afastado e no anel de destino.
As texturas são ladrilhos gerados em `entityTextures.ts`, com cache único de até 34 ladrilhos, e o
grafo as desenha com a opacidade de `textureOpacity` (`colorContrast.ts`), que preserva 4,5:1 nos
textos do cartão. Os cartões dos Quadros usam a mesma silhueta (sombra, recorte e borda), a mesma
textura com a mesma regra de tinta e opacidade (`textureTheme.ts`) e o ícone do tipo antes do
rótulo. As fatias do #72, uma por PR e cada
uma com medição de desempenho:

1. catálogo de domínio e testes (feito);
2. silhuetas no grafo, no cartão individual e no lote (feito; medição em
   [relationship-graph.md](../performance/relationship-graph.md#silhuetas-por-tipo--27112026));
3. gerador de ladrilhos compartilhado e texturas no grafo (feito; medição em
   [relationship-graph.md](../performance/relationship-graph.md#texturas-por-tipo--27112026));
4. silhueta, textura e ícone nos cartões dos Quadros (feito; medição em
   [board.md](../performance/board.md#silhueta-textura-e-ícone-do-tipo--27112026));
5. legenda, intensidade da textura em Configurações, modos de contraste e guias de uso.

## Contexto

No grafo, todo cartão é o mesmo retângulo de 180×70 com cantos arredondados, e o tipo só aparece
como texto, que some quando o zoom se afasta. Nos Quadros o tipo também é só um rótulo. As conexões
já têm identidade sem cor (traço, ponta e símbolo); os cartões não. A WCAG 1.4.1 pede que a cor não
seja o único meio de transmitir informação, e o REL-07 (acessibilidade do grafo) ainda está aberto.

## Decisão

- Cada tipo tem uma **identidade visual**: uma **silhueta** (contorno do cartão) e uma **textura**
  (padrão sutil sobre o preenchimento). A silhueta é o canal principal, a textura reforça, e o
  ícone e o rótulo do tipo continuam sendo a garantia. Nenhum canal sozinho carrega o tipo.
- O catálogo é **código no domínio**, consultado pelo id do tipo, como as páginas próprias do
  [ADR-010](ADR-010-hybrid-entity-pages.md). Os 17 tipos do mundo semente têm silhueta e textura
  exclusivas; a tabela completa está no #72 e em `ENTITY_VISUAL_CATALOG`.
- Qualquer id fora do catálogo (tipo criado pelo usuário, id renomeado) recebe o **cartão neutro**:
  a silhueta `rounded` de hoje e textura `none`, com o próprio ícone. Não se sorteia uma forma para
  tipos novos, para não sugerir um significado que o usuário não escolheu.
- Toda silhueta cabe na **caixa 180×70 atual** e passa pelos pontos médios dos quatro lados. Âncoras
  das conexões, porta, faixas de relação, enquadramento e área de clique não mudam.
- **A forma persistida não muda.** Um campo opcional `visual` em `EntityTypeDefinition` fica para
  quando existir editor de tipos, com migração e documentação próprias.
- As texturas são geradas em código, em ladrilhos pequenos reaproveitados por textura, tema e DPR,
  sem arquivos de imagem nem `cache()` do Konva por cartão.

## Alternativas consideradas

- **Campo `visual` persistido no tipo já agora.** Deixaria o usuário escolher, mas exige migração e
  editor de tipos que ainda não existe. Adiado.
- **Só ícone e cor.** O ícone some no zoom afastado e a cor sozinha não atende a WCAG 1.4.1.
- **Formas fora da caixa (círculo, losango).** Mudaria âncoras, faixas, enquadramento e área de
  clique, e reduziria o espaço do título.
- **Texturas em PNG ou SVG.** Precisaria de pipeline de assets e variantes por tema e DPR; o projeto
  já gera texturas em código na parede de evidência.

## Consequências

- Um tipo novo do seed precisa de uma entrada no catálogo; o teste de cobertura falha até ela
  existir, e o teste de unicidade impede repetir silhueta ou textura.
- O catálogo depende dos ids do seed, com o mesmo risco do ADR-010; o padrão neutro evita que um id
  desconhecido quebre o desenho.
- Cada fatia que desenhar silhuetas ou texturas mede o grafo e os Quadros pelo protocolo de
  [relationship-graph.md](../performance/relationship-graph.md) e [board.md](../performance/board.md)
  e entra no roteiro do REL-07.
