# Como criar commits e branches

> **Estado:** implementado · **Última verificação:** 26/11/2026, os 57 commits de `main`.

Um bom histórico deixa qualquer pessoa do time entender o que mudou e por quê sem abrir o diff,
e permite reverter uma mudança sem levar outras junto. Esta é a convenção do Canon Codex.

## O que corrigir no histórico atual

Nos 57 commits da `main` até 26/11/2026:

- 20 assuntos fogem do formato (`Calendario criado e aprimorado`,
  `Refine relationship graph and world library`);
- inglês e português misturados, inclusive no escopo (`feat(entities)` e `feat(entidades)`);
- commits gigantes que juntam vários assuntos (`ede2613` com 168 arquivos, `951d301` com 93);
- merges de sincronização sem conteúdo (`Merge branch 'main' of https://github.com/...`);
- assuntos acima de 72 caracteres e corpos que dizem *o que* mas não *por quê*.

## Formato

```text
tipo(escopo): resumo no imperativo

Por que a mudança existe e qual problema resolve. O que muda para quem
usa ou para quem mantém. Como foi verificado.

Refs #N
```

- **Português**, inclusive no escopo.
- **Assunto** com até 72 caracteres, minúsculo depois dos dois-pontos, sem ponto final, no
  imperativo: "adicionar", "corrigir", "mover" (não "adicionado", "adiciona").
- **Corpo** separado por uma linha em branco, com quebra em ~72 colunas. Obrigatório quando o
  porquê não é óbvio pelo assunto. Listas com `-` servem para várias partes de uma mesma mudança.
- **Rodapé** com o issue: `Refs #N` enquanto a branch não chega à `main`; `Closes #N` só no
  commit ou PR que entra na `main` e encerra o trabalho. Coautoria (`Co-Authored-By:`) na última
  linha.

### Tipos

| Tipo | Quando usar |
| --- | --- |
| `feat` | funcionalidade nova ou mudança visível ao usuário |
| `fix` | correção de bug |
| `perf` | melhoria de desempenho sem mudar comportamento |
| `refactor` | reorganização de código sem mudar comportamento |
| `test` | só testes |
| `docs` | só documentação |
| `chore` | build, dependências, scripts, configuração, limpeza |

Mudança que quebra dados ou contrato: `feat(storage)!:` e um parágrafo `BREAKING:` no corpo
explicando a migração.

### Escopos

Use a área do produto, não o nome do arquivo. Os escopos em uso:

`calendar`, `timeline`, `relations`, `entities`, `content`, `search`, `worlds`, `storage`,
`assets`, `boards`, `scenes`, `soundtrack`, `locations`, `launcher`, `app`, `docs`.

Para uma área nova, escolha uma palavra curta em inglês, igual ao nome usado no código, e
acrescente aqui. O escopo pode ser omitido quando a mudança é transversal
(`docs: criar guia de commits`).

## Tamanho: um assunto por commit

Um commit deve poder ser revertido sozinho. Sinais de que é hora de separar:

- o resumo precisa de "e" para descrever duas coisas;
- o diff mistura refatoração com funcionalidade nova;
- arquivos de áreas diferentes sem relação entre si.

Ferramentas:

```powershell
git add -p             # escolhe trechos de um arquivo
git commit --amend     # corrige o último commit antes de enviar
```

Um commit não precisa ser pequeno em linhas; precisa ser **um** assunto. Uma migração com schema,
repositório, testes e documentação é um commit só.

## Branches

- Nunca commite direto na `main`. Cada trabalho tem sua branch a partir da `main` atualizada.
- Nome: `tipo/assunto-curto`, por exemplo `feat/pastas-no-grafo`, `fix/calendario-page-up`,
  `docs/guia-de-commits`.
- Para trazer a `main` para sua branch, use rebase em vez de merge:

```powershell
git fetch origin
git rebase origin/main
```

- Para atualizar a `main` local: `git pull --rebase`. Isso evita os merges
  `Merge branch 'main' of ...` no histórico.
- Não reescreva (rebase, amend, force push) uma branch que outra pessoa já está usando sem
  combinar antes.

## Pull requests

- Um PR por issue ou por entrega coerente. Título no mesmo formato do commit.
- Descrição: o que muda, por quê, como foi verificado, o checklist de documentação de
  [Como documentar](documentation.md#checklist-do-pr) e `Closes #N`.
- Antes de pedir revisão: `pnpm typecheck`, `pnpm lint`, `pnpm test` e, se mexeu em build ou
  rotas, `pnpm build`.

## Exemplos

Bom, do próprio histórico:

```text
fix(calendar): trocar de mês pelo link do período em vez de useRouter

O teste da página do calendário importa a página com a condição
react-server, e importar next/navigation na grade quebrava esse teste.
Page Up e Page Down agora acionam o próprio link "Mês anterior"/
"Próximo mês". Suíte completa volta a passar e o comportamento foi
reconferido no Chrome.
```

Reescrevendo os ruins:

| Antes | Depois |
| --- | --- |
| `Calendario criado e aprimorado` (93 arquivos) | vários commits: `feat(calendar): criar calendário por mundo`, `feat(calendar): adicionar luas`, ... |
| `Refine relationship graph and world library` | `feat(relations): refinar visual do grafo` e `feat(worlds): ...` separados |
| `Correção de BUG: Tela inicial não carrega se não houver mundo` | `fix(worlds): abrir a biblioteca sem mundo ativo` |
| `Merge branch 'main' of https://github.com/...` | nenhum commit: `git pull --rebase` |
