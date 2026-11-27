# ADR-010: Catálogo híbrido de páginas de registro

> **Estado:** decidido; a diretriz de contrato ainda não está implementada · **Última verificação:**
> 27/11/2026, `src/components/entities/entity-page.tsx`, `src/domain/entities/entityFormRules.ts` e
> `src/domain/worlds/defaultWorldSeed.ts`.

## Estado atual em 27/11/2026

O modelo híbrido é o oficial (#49). Revoga a parte do [ADR-002](ADR-002-entity-model.md) que previa
um único compositor para todos os tipos; o resto do ADR-002 (entidade genérica, `properties` livres,
`EntityTypeDefinition` como dado do mundo) continua valendo.

Dos 17 tipos do mundo semente, 12 têm página própria e 5 usam o compositor genérico:

| Caminho | Tipos | Como `entity-page.tsx` escolhe |
| --- | --- | --- |
| Página própria | local, evidência, organização, criatura, objeto, cosmologia, conto, conceito, espécie, natureza/medicina, linha do tempo | pelo id do tipo |
| Página de retrato | personagem | pelo bloco `portraitHero` no layout do tipo |
| Compositor genérico | caso, evento, documento, pista, fenômeno | blocos de `layout` do tipo |

Evento teve um jornal próprio até o commit `4a71b77`, que o devolveu ao compositor genérico.

A diretriz de contrato descrita em [Decisão](#decisão) ainda não está no código: hoje as páginas
próprias leem campos por nome fixo e são escolhidas por uma cadeia de `if` sobre o id do tipo.

## Contexto

O ADR-002 queria que qualquer tipo fosse só dado: propriedades e blocos de layout em `world.json`,
renderizados por um compositor genérico. Na prática, o time investiu em apresentações que o
compositor não consegue expressar: a planta do local, a parede 3D da evidência, a caixa-arquivo da
organização, a bancada do objeto e a formação holográfica de personagens e criaturas. Essas páginas
são o diferencial do produto e foram ampliadas nos PRs #65 e #66.

Ao mesmo tempo, elas acoplam a UI ao seed: cada uma lê propriedades com id fixo (`leaders`,
`pointsOfInterest`, `evidenceFindings`, `conceptBlocks` e outras), e `entityFormRules.ts` decide
campos do formulário pelo id do tipo. Um mundo que renomeie esses campos, ou um tipo criado pelo
usuário, não tem garantia do que verá. Ainda não há editor de tipos, então isso não afeta ninguém
hoje, mas afetaria assim que tipos passarem a ser editáveis.

## Decisão

- O catálogo de páginas é **híbrido de propósito**. Um tipo pode ter página própria quando precisa de
  uma apresentação que os blocos genéricos não expressam; os outros usam o compositor genérico.
- Uma página própria é um **tema opcional sobre o registro genérico**, não um modelo de dado novo. O
  registro continua sendo uma `Entity` comum, e nenhuma página própria pode exigir mudança na forma
  persistida.
- Diretriz para páginas novas e para quando as atuais forem tocadas:
  - a página declara quais propriedades (id e tipo de campo) usa;
  - quando o tipo do mundo não tem essas propriedades, ou o tipo não foi criado pelo seed, a página
    cai no compositor genérico em vez de quebrar ou esconder dados;
  - a escolha da página sai de um registro único de renderizadores, e não de testes de id espalhados
    por `entity-page.tsx` e `entityFormRules.ts`;
  - cada página própria tem teste de fallback para o compositor.
- O compositor genérico continua obrigatório: todo tipo precisa renderizar nele, e é ele que atende
  tipos criados pelo usuário.

## Alternativas consideradas

- **Voltar ao compositor único (ADR-002 original).** Cumpre a extensibilidade por dado, mas exigiria
  remover ou rebaixar 11 páginas e o CSS delas, e o compositor precisaria de blocos muito mais ricos
  para recuperar parte do resultado. Contraria a direção que o produto tomou.
- **Manter o híbrido sem regra.** Custo zero agora, mas o acoplamento por id e nome de campo cresce a
  cada página nova e vira dívida quando os tipos ficarem editáveis.

## Consequências

- Tipo novo continua podendo ser só dado, desde que use o compositor genérico. Página própria exige
  código em `src/components/entities/`, testes e atualização do
  [guia de registros](../user-guide/entities.md#apresentações-específicas).
- Implementar o registro de renderizadores e os fallbacks é trabalho separado, sem migração: os dados
  salvos não mudam.
- A revisão dos tipos (#12) deve usar esta regra para decidir o que cada página exige de um tipo.
