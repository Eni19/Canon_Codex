# Canon Codex

Canon Codex é uma wiki local para criação, organização e apresentação de universos ficcionais. O projeto reúne personagens, locais, organizações, criaturas, evidências, artefatos, cosmologia, eventos e narrativas em uma interface voltada para worldbuilding e RPG.

Os dados permanecem no computador do usuário. Cada Codex é armazenado como uma pasta independente e pode ser criado, importado, renomeado ou removido pela própria aplicação.

> O projeto está em desenvolvimento ativo. Estruturas de dados e interfaces ainda podem mudar.

## Recursos

- Biblioteca com múltiplos Codex e importação de mundos por pasta.
- Páginas próprias para personagens, locais, organizações, criaturas, evidências, artefatos e cosmologia.
- Catálogos pesquisáveis com agrupamentos por nome, organização, local, hierarquia regional e natureza.
- Editor de conteúdo em blocos com texto formatado e dados de RPG.
- Relações e referências entre entidades.
- Mapas de locais com pontos de interesse.
- Quadro de investigação em canvas infinito.
- Scene Runner para preparação, condução e projeção de cenas.
- Temas de cor por entidade e interface responsiva.
- Persistência local em JSON com validação e migrações de esquema.

## Requisitos

- Node.js 20.9 ou mais recente.
- [pnpm](https://pnpm.io/) 12 ou compatível.

## Instalação

```bash
git clone https://github.com/Eni19/Canon_Codex.git
cd Canon_Codex
pnpm install
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Dados locais e privacidade

Por padrão, o Canon Codex guarda todo o conteúdo em `workspace/` dentro da pasta do projeto. Essa pasta contém mundos, textos, imagens, cenas e quadros do usuário e está inteiramente excluída do Git.

Para manter os dados em outro local, copie `.env.example` para `.env.local` e defina um caminho absoluto:

```env
WIKI_WORKSPACE_DIR=C:\caminho\para\meus-codex
```

Nunca publique a pasta configurada em `WIKI_WORKSPACE_DIR`. Para fazer backup de um mundo, copie sua pasta separadamente para um local privado.

## Comandos

```bash
pnpm dev        # inicia o ambiente de desenvolvimento
pnpm build      # gera a versão de produção
pnpm start      # executa a versão de produção
pnpm typecheck  # verifica os tipos TypeScript
pnpm lint       # executa o ESLint
pnpm test       # executa os testes com Vitest
```

## Arquitetura

O projeto usa Next.js com App Router, React, TypeScript, Tailwind CSS, Tiptap, Zod, Anime.js e tldraw.

```text
src/
  app/                         rotas, ações de servidor e APIs
  components/                  interface, editores, entidades e ferramentas
  domain/                      esquemas e tipos do domínio
  repositories/               contratos e persistência no filesystem
  services/                    operações de aplicação
  lib/                         utilitários, migrações e projeção
workspace/                     dados privados do usuário, ignorados pelo Git
```

A interface acessa os dados através de contratos de repositório. A implementação atual usa o filesystem local, enquanto IDs estáveis e versões de esquema permitem evoluir a persistência sem acoplar os componentes aos arquivos.

As decisões arquiteturais estão documentadas em [`docs/architecture`](docs/architecture).

## Estado do projeto

Canon Codex é atualmente uma ferramenta pessoal e local. Autenticação, colaboração remota e armazenamento em nuvem ainda não fazem parte desta versão.