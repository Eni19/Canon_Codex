# Contribuir com o Canon Codex

> **Estado:** implementado · **Última verificação:** 26/11/2026, `package.json`, `.env.example` e
> labels do repositório.

Este guia leva você do clone ao primeiro PR. Se travar em algum passo, isso é um bug da
documentação: abra um issue ou corrija este arquivo no mesmo PR.

## 1. Preparar o ambiente

Requisitos:

- Node.js `>=24.15.0` (24 LTS recomendado), que já traz o `node:sqlite` usado pelo banco;
- pnpm, de preferência na versão declarada em `package.json`.

```powershell
git clone https://github.com/Eni19/Canon_Codex.git
cd Canon_Codex
pnpm install
pnpm dev
```

Abra <http://localhost:3000>. Num banco novo, o app cria o mundo inicial `Canon Codex`.

### Configuração local

Copie `.env.example` para `.env.local` (ignorado pelo Git) só se precisar mudar algo:

| Variável | Para quê |
| --- | --- |
| `WIKI_WORKSPACE_DIR` | pasta dos dados; padrão `workspace/` na raiz do projeto |
| `SQLITE_DATABASE_PATH` | arquivo do banco, se quiser um específico |
| `PERSISTENCE_DRIVER` | `filesystem` só para abrir uma biblioteca antiga em JSON |
| `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` | chave do tldraw para Quadros e Cenas fora de `localhost` |

Sem a chave do tldraw, Quadros e Cenas funcionam em `localhost` com marca d'água. Detalhes em
[configuração](docs/reference/configuration.md) e no
[levantamento da licença](docs/research/tldraw-license.md).

### Dados privados

`workspace/` guarda a biblioteca real de quem usa o app e está fora do Git. **Nunca** commite,
cite, copie ou use esse conteúdo em testes, exemplos, capturas de tela ou issues. Para testar,
aponte `WIKI_WORKSPACE_DIR` para uma pasta temporária e use dados sintéticos
(`Personagem Exemplo`, `Arquivo de Teste`).

## 2. Entender o código

```text
src/app/            páginas (App Router), Server Actions e rotas HTTP
src/components/     interface React
src/services/       casos de uso
src/domain/         schemas Zod e regras puras, sem I/O
src/repositories/   contratos e adaptadores SQLite e filesystem
```

A regra principal: telas e actions falam com os **contratos** de repositório, nunca com
`node:fs` ou SQL diretamente. Leia, nesta ordem:

1. [PROJECT.md](PROJECT.md): regras fixas e convenções de mudança;
2. [CONTEXT.md](CONTEXT.md): vocabulário do domínio;
3. [Visão de arquitetura](docs/architecture/overview.md): camadas e fluxos;
4. [Guia de uso](docs/user-guide/index.md): o que o app faz, do ponto de vista de quem usa.

## 3. Escolher um trabalho

Todo trabalho começa num [issue](https://github.com/Eni19/Canon_Codex/issues). Os labels de área
ajudam a achar o seu:

| Label | Área |
| --- | --- |
| `cronologia-e-vinculos` | campanha, calendário, linha do tempo e relações |
| `dados-e-desempenho` | persistência, migrações e desempenho |
| `entidades-e-cartografia` | tipos de registro, fichas e mapas |
| `formularios-e-busca` | formulários e busca |
| `documentation` | documentação |
| `good first issue` | bom para começar |
| `sem-responsavel` | ninguém pegou ainda |
| `backlog` | ideia futura, ainda sem compromisso |

Atribua o issue a você antes de começar, para ninguém fazer o mesmo trabalho.

## 4. Fazer a mudança

1. Crie uma branch a partir da `main` atualizada: `git switch -c feat/assunto-curto`.
2. Faça commits pequenos, um assunto por commit, no formato de
   [Commits e branches](docs/contributing/commits.md).
3. Se a mudança toca schema, rota, action, configuração ou fluxo visível, atualize a documentação
   no mesmo PR, seguindo [Como documentar](docs/contributing/documentation.md).
4. Para trazer novidades da `main`, use `git rebase origin/main`, não merge.

## 5. Antes do PR

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm build` é obrigatório quando a mudança mexe em rotas, configuração ou dependências. O que a
suíte cobre e o que não cobre está em [testes](docs/testing.md).

## 6. Abrir o PR

- Título no formato do commit (`feat(calendar): ...`).
- Descrição com o que muda, por quê, como você verificou, o
  [checklist de documentação](docs/contributing/documentation.md#checklist-do-pr) e
  `Closes #N`.
- Peça revisão de pelo menos uma pessoa do time. Não faça merge do próprio PR sem revisão.

## Onde registrar outras coisas

| O quê | Onde |
| --- | --- |
| Bug (algo contradiz o comportamento documentado) | issue com label `bug`, passos mínimos e dados sintéticos |
| Ideia ou melhoria | issue com label `backlog` |
| Decisão de arquitetura | ADR em `docs/architecture/` |
| Validação com uma campanha real | [roteiro de validação](docs/campaign-validation.md) |
