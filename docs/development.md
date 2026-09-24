# Desenvolvimento

## Preparar o ambiente

Execute:

    pnpm install
    pnpm dev

O servidor de desenvolvimento fica em http://localhost:3000 por padrão. Use .env.local para
WIKI_WORKSPACE_DIR e PERSISTENCE_DRIVER; não use o workspace privado de outra pessoa em ensaios.

Comandos do package.json:

| Comando | Finalidade |
| --- | --- |
| pnpm dev | Next.js em desenvolvimento |
| pnpm build | build de produção |
| pnpm start | servidor local de produção após build |
| pnpm typecheck | tsc --noEmit |
| pnpm lint | ESLint |
| pnpm test | vitest run |
| pnpm test:watch | Vitest interativo |

## Organização do trabalho

Comece identificando a camada afetada:

- contrato e schema em src/domain/ e src/repositories/contracts/;
- regra de uso em src/services/ ou src/app/actions/;
- página e interação em src/app/ e src/components/;
- arquivo, migração ou escrita em src/repositories/filesystem/ e src/lib/;
- upload e leitura HTTP em src/app/api/.

Componentes React não devem importar node:fs diretamente nem montar caminhos de workspace.
Mudanças devem usar a factory/contrato adequado. A regra atual é arquitetural, embora alguns
serviços de biblioteca e handlers tenham I/O auxiliar necessário: consulte
[visão de arquitetura](architecture/overview.md) antes de ampliar essa exceção.

## Mudança de domínio

Para adicionar ou mudar um campo persistido:

1. atualize o schema Zod e a constante de versão se a forma persistida mudar;
2. escreva uma migração sequencial em src/repositories/filesystem/migrations.ts quando houver
   dados legados suportados;
3. atualize criação, leitura, patch e qualquer formulário;
4. adicione teste de registro atual, registro legado e falha de validação;
5. atualize [storage](data/storage.md), [migrações](data/migrations.md), guias e referência HTTP
   quando o contrato externo mudar.

Para um novo tipo de entidade, uma definição genérica em world.json pode ser suficiente. Um
renderizador, editor ou regra específica exige código em components/entities, testes e atualização
do catálogo em docs/user-guide/entities.md.

## Mudança de persistência

Preserve os contratos e atualize as quatro áreas relevantes. O driver atual rejeita qualquer valor
que não seja filesystem; não documente Postgres, S3 ou outro backend antes de existir uma
implementação verificável. Mudanças de arquivo precisam manter validação Zod e escrita atômica.

## Mudança de interface ou API

Ao alterar uma rota, ação, payload ou erro:

1. atualize o consumidor interno;
2. atualize docs/reference/http-and-actions.md;
3. confirme se o comportamento de seleção do mundo e os limites de erro continuam verdadeiros;
4. execute typecheck, lint e testes proporcionais.

## Regra documental

Toda mudança de código, dados, API, migração ou configuração deve avaliar o impacto em README,
PROJECT.md, ADRs e docs. Atualize as páginas afetadas na mesma tarefa. Se nenhuma página mudar,
registre explicitamente a justificativa no resumo da mudança.
