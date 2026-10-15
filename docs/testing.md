# Testes e qualidade

Cosmic Canvas (15/10/2026): cinco testes novos em timelineCanvas.test.ts cobrem 500 coordenadas
sem sobreposição, âncora de zoom nos limites, pinch com translação, enquadramento/culling e
preservação das posições ao filtrar. Suíte completa: **137 passaram e 1 falhou**, a mesma asserção
preexistente de Tal’Dorei (49 relações, expectativa >100). Os 36 testes relevantes de timeline
passaram. Ensaios de navegador usam somente dados sintéticos e o harness opt-in
scripts/timeline-canvas-profile.html; nove checks de gestos/filtros passaram em desktop, mobile e tablet.
Medições, regressões manuais e limites estão no [perfil atual](performance/timeline-cosmic-canvas.md).
Os parágrafos TL-10/TL-11/TL-12 abaixo registram verificações históricas da interface anterior.

TL-12 acrescenta cinco testes em `timeline-motion.test.ts` para movimento reduzido, navegação
instantânea, ausência da API de animação, cancelamento durante saída e limpeza de listeners.
Os 31 testes relevantes de linhas do tempo passaram. TypeScript, ESLint de `src/` e `scripts/`
e build de produção passaram. A suíte completa em 14/10/2026 teve 132 aprovações e a mesma
falha preexistente em `taldoreiPack.test.ts:49` (49 relações, expectativa maior que 100).
O [perfil TL-12](performance/timeline-motion-tl12.md) registra referências, dados sintéticos,
medidas de quadros em produção e verificação visual desktop/móvel, com limites explícitos.
O gerador visual é opt-in e usa um diretório temporário validado; não integra a suíte normal.
Os ensaios incluem retorno de foco, cancelamento sem gravação, remoção/Desfazer, filtros,
paginação, contexto entre vistas e retorno pelo histórico com cartão em trilha distante.
Arraste nativo, celular físico e emulação visual de movimento reduzido continuam sem confirmação.

TL-10: `entityLifecycle.test.ts` usa somente diretórios temporários sintéticos para verificar
preservação de cartões na lixeira, remoção de repetições em linhas ativas e na lixeira,
limpeza do vínculo de origem sem alterar o calendário, isolamento entre mundos, idempotência
e rejeição de metadados inválidos/ausentes e falhas de acesso antes de qualquer limpeza.
Também verifica retomada de gravação interrompida entre arquivos sem regravar linhas já limpas.
Em 14/10/2026, TypeScript e ESLint dos arquivos de código alterados passaram; suíte completa:
127 testes passaram e 1 falhou em `taldoreiPack.test.ts:49` (pacote contém 49 relações, expectativa
maior que 100). Essa asserção lê diretamente o pacote e não executa a reconciliação do TL-10.

As regressões da revisão do TL-10 também verificam nova origem após descarte, sem navegação
intermediária, e busca global/mundo acessíveis com uma linha corrompida. TL-11 acrescenta
`timelinePagination.test.ts`: percorre as 500 aparições, compara IDs/ordem nas duas vistas,
preserva intervalos e valida filtros, URLs, páginas inválidas e seleção vazia.
As correções da revisão TL-11 acrescentam localização por ID após mudança de data, inclusive
para **Sem data**, e distinção de cartões ocultos por busca/escala. Em navegador com 500 aparições,
foram repetidos os três cenários que falhavam: retorno à nova página do cartão, reinício do eixo
após End + Próxima página e seletores de data coerentes depois de salvar, inclusive sem alterações.
Também foram verificados o aviso de cartão oculto e o retorno horizontal em viewport 390×844.
Esses ensaios de DOM/foco são verificações de navegador, não testes automatizados da suíte Node.
O [perfil de 500 aparições](performance/timeline-500.md) contém comandos do gerador temporário,
ambiente, medidas antes/depois e verificações em navegador desktop/móvel. O gerador é opt-in,
fora da suíte normal. ESLint foi executado em `src/` e `scripts/`.

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

O teste `src/repositories/filesystem/dateMigration.test.ts` cria somente mundos sintéticos em uma
pasta temporária. Ele verifica campos de data de tipo personalizado, Evento, Linha do Tempo e entidade na lixeira,
distância ordinal em calendários convencional e personalizado, valores inválidos, prévia obsoleta,
execução repetida, confirmação simultânea, bloqueio de edição concorrente, manifesto inválido,
retomada e restauração. Não exercita
a tela em navegador.

`src/repositories/filesystem/originEvent.test.ts` usa mundos sintéticos temporários para verificar
criação única no ano zero, recusa de edição da data vinculada, prévia e troca com distância ordinal
preservada, registros na lixeira, isolamento entre mundos, fingerprint obsoleto e restauração de um
backup marcado como operação interrompida, proteção de edições posteriores, precisão de ano alinhada
e indicação de perda de precisão. Não há teste visual da página `/calendar/origin`.

`src/repositories/filesystem/timelineData.test.ts` verifica com mundos sintéticos o documento
versionado, aparições repetidas e sem data, ordenação, recusa de outro mundo e intervalo inválido,
concorrência, versão desconhecida, leitura v1, campos independentes de cartões, criação rápida,
falha sintética de escrita com desfazimento do novo Evento, inclusão em lote idempotente,
remoção e restauração de aparição ativa ou com alvo na lixeira, com isolamento entre mundos, e
bloqueio de mudança estrutural do calendário. O teste da origem
também cobre deslocamento e recuperação de um arquivo de aparições. Em 28/09/2026, o mundo
sintético de `demo-data/` foi aberto no navegador e confirmou a vista vertical, cancelamento sem
gravação, inclusão individual, remoção e Desfazer inclusive de cartão com alvo na lixeira. A gaveta móvel abriu e filtrou a biblioteca
por título. O arraste ainda não passou por verificação visual.

`src/domain/timelines/timelineNavigation.test.ts` verifica agrupamento em século com anos
negativos e zero, seleção por mês, busca, categorias, seção Sem data, cartões de registros na
lixeira, leitura da URL, geometria da vista horizontal com intervalos aproximados e trilhas sem
sobreposição, e ausência de mutação das aparições. Testes de migração e repositório
cobrem a criação dos padrões v19, a leitura de metadados na lixeira e a gravação isolada por
mundo. No navegador, zoom, busca, categoria e Voltar foram verificados no mundo sintético; a
vista horizontal tem testes de domínio, geometria e contrato da URL; a verificação visual manual
ainda está pendente.

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
round-trip de datas em Evento e Organização, preservação de ISO legado e bloqueio de mudanças
estruturais quando há datas em registros ativos ou na lixeira. Testes das actions verificam a criação
de Evento com data e a preservação de ISO em um salvamento comum. Ainda não há teste E2E de navegador para criar e reabrir
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
