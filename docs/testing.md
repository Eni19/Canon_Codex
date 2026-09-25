# Testes e qualidade

## Executar

    pnpm typecheck
    pnpm lint
    pnpm test
    pnpm build

O script test executa Vitest em modo run com ambiente Node e inclui somente src/**/*.test.ts,
conforme vitest.config.mts. Para uma área específica:

    pnpm exec vitest run src/services/worlds/worldLibrary.test.ts

Os testes de filesystem usam mkdtemp e definem WIKI_WORKSPACE_DIR para diretórios temporários.
Eles removem esses diretórios em afterEach; não apontam para o workspace privado do projeto.

## Cobertura atual

- biblioteca de mundos: seed, criação, renomeação, importação, colisão de identidade e lixeira;
- repositório de mundo: CRUD de entidades, slugs, temas, conteúdo, relações, backlinks,
  concorrência e exclusão lógica;
- assets: MIME, cópia, dimensões, thumbnail, ausência de binding do sharp e lixeira;
- quadros/cenas: snapshots, listagem, duplicação e exclusão lógica;
- migrações e registry: encadeamento, versão ausente, mundos legados, conteúdo de páginas e
  blocos de conceito;
- escrita atômica e limpeza de temporários;
- projeção: remoção de tokens/POIs ocultos do estado público;
- schemas de referências específicas e blocos de conceito.

O calendário tem testes de domínio para ordinais antes/depois do ano zero, ano zero completo,
regras bissextas, 29 de fevereiro, dias da semana convencionais, formatação de dias/eras e rejeição
de entradas inválidas. Migrações sintéticas verificam a inclusão do calendário em mundos v15 e a
correção do padrão v16; testes de filesystem verificam round-trip e isolamento entre mundos. O teste
da action confere que um formulário antigo não grava no mundo ativo após uma troca. Não há teste E2E
de interação visual da tela `/calendar`.

O ticket 02 acrescenta testes para os três níveis de precisão, aproximação, intervalos, datas
inexistentes, lacunas e fins invertidos. Eles exercitam dois calendários sintéticos, ISO legado e o
round-trip de datas em Evento e Organização. Ainda não há teste E2E de navegador para criar e reabrir
um Evento nem teste visual de acessibilidade do editor; a cobertura é de domínio e filesystem.

## O que não é verificado automaticamente

Não há suíte E2E, teste de navegador, teste de acessibilidade visual, teste de deploy, backup físico,
autenticação, autorização ou contrato público de API. Os handlers sem envelope de erro próprio
dependem do comportamento do Next.js em falhas não capturadas.

Os testes de repositório verificam a implementação filesystem. Eles não provam que uma futura
implementação de banco ou storage preservaria o mesmo comportamento.

## Mudança de migração

Inclua pelo menos um objeto legado sintético e um objeto atual no teste da migração. Verifique:

- versão final;
- preservação de campos customizados que o código promete preservar;
- schema Zod após a transformação;
- falha explícita quando faltar uma etapa;
- não gravação inesperada durante leitura normal.

Use diretórios temporários e remova-os ao fim. Nunca copie nomes, imagens ou JSON de workspace real
para fixtures.
