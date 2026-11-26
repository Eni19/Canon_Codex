# Licença do tldraw (DOC-GAP-003)

> **Estado:** histórico · **Última verificação:** 25/11/2026, texto da licença, página de preços e
> código do pacote `tldraw` 5.4.1.

Verificação de 25/11/2026 sobre `tldraw` 5.4.1, usado em Quadros e Cenas
(`src/components/boards/investigation-board.tsx` e `src/components/scenes/scene-runner.tsx`).
Isto é um levantamento técnico, não uma análise jurídica.

## O que a licença diz

Fontes: o [texto da licença](https://github.com/tldraw/tldraw/blob/main/LICENSE.md) (sem data ou
versão no arquivo) e a [página de preços](https://tldraw.dev/pricing), lidas em 25/11/2026.

- **Grátis:** usar em ambientes de desenvolvimento (desenvolvimento interno, testes ou staging
  sem acesso de usuários finais ou do público), modificar e empacotar com o próprio projeto.
- **Produção:** fora da licença gratuita; exige uma chave de avaliação (válida por tempo limitado)
  ou um acordo comercial. A página de preços anuncia licença comercial com 100 dias de avaliação,
  preço por valor (sem números publicados), desconto para startups e uma **licença hobby
  gratuita**, cujos termos não foram lidos nesta verificação.
- **Marca-d'água:** a licença menciona medidas técnicas para exibir a marca-d'água; as regras
  de quando ela aparece com chaves hobby ou de avaliação não estão nas páginas lidas.

## O que o código do pacote faz (5.4.1)

Lido em `@tldraw/editor/src/lib/license/` dentro de `node_modules`:

| Situação | Comportamento |
| --- | --- |
| Host `localhost`, `127.x.x.x`, `::1` ou `*.localhost`, sem chave | Funciona com todos os recursos e mostra a marca-d'água |
| Qualquer outro host sem chave válida (ex.: IP da rede local, domínio próprio) | Estado `unlicensed-production`: o editor aparece por 5 s e depois some, ficando a tela em branco |
| Chave expirada | Mesmo bloqueio de 5 s |
| Sem chave em produção | O pacote envia uma requisição ao CDN do tldraw com o endereço da página (`url`) para registrar o uso sem licença |

## Consequências para o Canon Codex

- No uso atual (servidor local aberto em `localhost`), Quadros e Cenas funcionam com
  marca-d'água. Se isso conta como "ambiente de desenvolvimento" para a licença é uma questão
  dos termos, não do código; vale confirmar com a licença hobby.
- **Abrir o app por outro endereço quebra Quadros e Cenas**, inclusive a projeção de uma cena em
  outro aparelho pelo IP da rede local: o canvas some depois de 5 s sem chave válida.
- O registro de uso sem licença envia o endereço da página a um serviço externo, o que contraria
  a política local-first de [operação e privacidade](../reference/operations-and-privacy.md) quando o app
  é aberto fora de `localhost`.
- `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` é lida no cliente; por ser `NEXT_PUBLIC_`, a chave fica visível
  no navegador. Isso é esperado pelo tldraw (a chave é validada por domínio), mas não deve ser
  confundida com um segredo.

## Recomendação

1. Curto prazo: se o app for usado só em `localhost`, nada muda. Para usar pela rede local ou
   em outro domínio, obter a licença hobby (ou comercial) e definir
   `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` em `.env.local`, conferindo os domínios aceitos pela chave.
2. Médio prazo: seguir o [REL-08](../plans/relationship-graph-plan.md#rel-08--etapa-final-migrar-os-outros-canvas)
   para trocar Quadros e Cenas pelo canvas próprio em Konva (licença MIT), já usado no grafo,
   o que elimina a dependência de chave, a marca-d'água e a requisição externa.
