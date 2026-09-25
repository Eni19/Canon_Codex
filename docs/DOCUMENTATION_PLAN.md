# Plano de atualização da documentação

**Projeto:** Canon Codex  
**Base da análise:** código e documentação locais em 23/09/2026  
**Objetivo:** produzir documentação verificável que permita instalar, usar, desenvolver, operar e recuperar o aplicativo, e mantê-la coerente com cada mudança futura.

## Instruções para a IA executora

1. Use a skill `$project-documentation` e leia `README.md`, `PROJECT.md`, os ADRs e o código citado em cada tarefa antes de editar. Respeite a organização documental já existente e escreva em português.
2. Trate código, esquemas Zod, testes e configuração como evidência do comportamento atual. Separe explicitamente **implementado**, **planejado** e **não verificado**. Não transforme propostas antigas dos ADRs em afirmações sobre a versão presente.
3. Este plano autoriza mudanças em documentação e instruções de manutenção da documentação. Não altere comportamento da aplicação para fazer o código caber nos documentos. Se houver uma divergência que exija decisão de produto ou correção de código, registre-a em `docs/work-items.md` ou no rastreador existente, com evidência.
4. `workspace/` contém dados privados e está ignorado pelo Git. Não copie conteúdo, nomes de pessoas ou imagens dessa pasta para exemplos ou testes documentais. Use exemplos sintéticos. Faça qualquer ensaio de importação ou restauração apenas em uma cópia temporária, com `WIKI_WORKSPACE_DIR` apontando para ela.
5. Preserve alterações não relacionadas que já estejam na árvore de trabalho. Ao iniciar e ao terminar, confira `git status --short` e o diff. No levantamento inicial havia um `package-lock.json` não rastreado; não o modifique como parte deste plano.
6. Execute as tarefas na ordem indicada. Ao fim de cada tarefa, confira caminhos, links e afirmações alteradas. Informe lacunas que não puder verificar; não preencha tabelas com itens fictícios.

## Estado inicial comprovado

- Existem `README.md`, `PROJECT.md` e cinco ADRs em `docs/architecture/`; não há guias de usuário, referência de dados, referência de rotas, procedimento de restauração nem registro local de trabalho em andamento.
- `src/domain/worlds/defaultWorldSeed.ts` define 17 tipos iniciais; `docs/architecture/ADR-002-entity-model.md` ainda descreve aproximadamente 13 e afirma que páginas por tipo não usam componentes específicos. `src/components/entities/entity-page.tsx` seleciona várias páginas específicas.
- `src/domain/content/contentDocument.ts` representa conteúdo como `pages[]`; `docs/architecture/ADR-004-editor.md` descreve um único `body`.
- `src/repositories/index.ts` fornece quatro contratos de persistência: mundos, assets, quadros e cenas. `docs/architecture/ADR-001-local-first-storage.md` e `PROJECT.md` descrevem apenas dois.
- `PROJECT.md` cita `src/lib/fs/atomicWriteJson.ts`, mas a implementação está em `src/lib/fs/atomicWrite.ts`; afirma também que `workspace/` pode ser versionado em Git, enquanto `.gitignore` o exclui.
- A persistência atual é por arquivos JSON. Não há banco relacional nem migrações SQL. Os esquemas atuais são `World` v17, `Entity` v4, `ContentDocument` v2 e `Asset`, `Board` e `Scene` v1, conforme `src/domain/`.
- Há seis Route Handlers em `src/app/api/`. O cookie `canon-codex-world` seleciona o mundo ativo (`src/services/worlds/getCurrentWorld.ts`); o projeto não implementa autenticação de usuários.

## Tarefa DOC-01 — Inventário e matriz de evidências

**Dependências:** nenhuma.  
**Entrega:** `docs/documentation-audit.md`, com colunas **afirmação atual**, **fonte no código**, **classificação** e **ação/documento de destino**. Registre a data da auditoria.

1. Liste as rotas de interface em `src/app/`, as Server Actions em `src/app/actions/`, os Route Handlers em `src/app/api/`, os contratos em `src/repositories/contracts/`, os esquemas em `src/domain/` e os testes em `src/**/*.test.ts`.
2. Mapeie cada afirmação existente em `README.md`, `PROJECT.md` e ADRs para uma fonte atual. Classifique-a como correta, desatualizada, decisão histórica ou não verificável.
3. Verifique se há um rastreador de issues acessível. Se houver, use-o como fonte de status; se não houver, não deduza backlog a partir do código.

**Aceite:** nenhuma afirmação contraditória conhecida fica sem uma ação definida nas tarefas seguintes; a IA consegue apontar a fonte de cada fato novo. Ao terminar DOC-10, marque na auditoria quais ações foram resolvidas e quais dependem de decisão externa.

## Tarefa DOC-02 — Corrigir a documentação existente

**Dependência:** DOC-01.  
**Entregas:** `README.md`, `PROJECT.md`, ADRs pertinentes.

1. Reduza o README a uma entrada confiável: propósito, requisitos verificados, instalação, primeiro uso, localização privada dos dados, comandos e índice dos guias novos.
2. Atualize `PROJECT.md` para refletir os quatro contratos, os caminhos reais, as regras de dependência realmente praticadas e o fato de `workspace/` estar fora do Git. Diferencie regra arquitetural desejada de implementação atual.
3. Revise os ADRs 001, 002 e 004 à luz das divergências do estado inicial. Preserve a decisão original e acrescente estado/nota de evolução ou um novo ADR quando houver uma decisão arquitetural posterior comprovada. Revise referências e links dos ADRs 003 e 005 sem inventar mudanças de decisão.
4. Remova ou qualifique afirmações absolutas não sustentadas, como “nenhum layout por tipo”, “somente `repositories/filesystem` usa `node:fs`” e proteção de assets por um mecanismo de autenticação inexistente.

**Aceite:** README, PROJECT.md e ADRs não se contradizem sobre tipos, persistência, conteúdo, caminhos e limites de segurança; decisões históricas continuam identificáveis.

## Tarefa DOC-03 — Arquitetura e modelo de execução

**Dependência:** DOC-02.  
**Entrega:** `docs/architecture/overview.md`.

Documente: mapa de diretórios; limites entre App Router, componentes, serviços, domínio e repositórios; fluxo de leitura e gravação de entidade; fluxo de asset; seleção do mundo ativo; quadros, cenas e projeção; onde validação, migrações e escrita atômica ocorrem. Use um diagrama pequeno apenas se ele tornar esses fluxos mais claros. Linke ADRs em vez de repetir suas justificativas.

**Fontes principais:** `src/repositories/index.ts`, `src/repositories/contracts/`, `src/services/worlds/`, `src/app/actions/`, `src/app/api/`, `src/lib/fs/`, `src/lib/migrations/`.

**Aceite:** cada componente do desenho aponta para código existente e o texto explica por que uma mudança de UI, domínio ou persistência deve ocorrer na camada indicada.

## Tarefa DOC-04 — Guia de uso e catálogo de funcionalidades

**Dependência:** DOC-01.  
**Entregas:** `docs/user-guide/index.md`, `docs/user-guide/worlds.md`, `docs/user-guide/entities.md`, `docs/user-guide/editor.md` e `docs/user-guide/boards-scenes-and-projection.md`. Una páginas apenas se houver duplicação substancial, mantendo os quatro fluxos fáceis de localizar no índice.

Cubra, com passos verificáveis: criar, importar, alternar, renomear e remover um Codex; criar e editar entidades; tipos disponíveis e diferenças de apresentação; referências, relações e backlinks; editor e suas páginas/blocos; imagens; busca; quadros de investigação; cenas e projeção. Registre limitações e diferenças entre ação reversível e exclusão permanente. Não apresente recursos futuros como disponíveis.

**Fontes principais:** `src/components/wiki/`, `src/components/entities/`, `src/components/editor/`, `src/components/boards/`, `src/components/scenes/`, `src/app/(wiki)/`, `src/app/actions/`.

**Aceite:** cada funcionalidade anunciada no README tem um caminho de uso ou uma referência clara; os passos podem ser reproduzidos em dados de exemplo sem tocar no `workspace/` real.

## Tarefa DOC-05 — Modelo de dados, armazenamento e migrações

**Dependências:** DOC-01 e DOC-03.  
**Entregas:** `docs/data/storage.md` e `docs/data/migrations.md`.

1. Desenhe a árvore de arquivos real: `world.json`, entidades (`metadata.json` e `content.json`), assets, quadros, cenas e `trash/`. Explique identidade por UUID versus slug/diretório e referências entre registros.
2. Descreva campos e invariantes relevantes dos esquemas Zod, incluindo versões atuais e limites importantes. Linke os arquivos de esquema como fonte canônica; não copie integralmente todas as definições TypeScript.
3. Explique quais dados são derivados, o que é validado na leitura/escrita e o que ocorre com registros inválidos.
4. Documente as migrações reais em `src/repositories/filesystem/migrations.ts` e `src/lib/migrations/registry.ts`: versões suportadas, aplicação na leitura, se e quando o arquivo é regravado, falhas e compatibilidade. Separe migrações de mundo, entidade, conteúdo e asset; descreva o tratamento atual de quadros e cenas.
5. Declare explicitamente que esta versão não usa banco relacional. Quando um banco for introduzido, atualizar esta referência com esquema, índices, restrições, acesso, migrações, backup e rollback passa a ser requisito da mesma mudança.

**Aceite:** um desenvolvedor consegue localizar e interpretar qualquer tipo de arquivo persistido e sabe quais versões o código lê, sem consultar dados privados de usuário.

## Tarefa DOC-06 — Backup, restauração, importação e descarte

**Dependência:** DOC-05.  
**Entrega:** `docs/data/backup-and-restore.md`.

Descreva o escopo do backup, a necessidade de copiar arquivos com a aplicação parada ou sem gravações simultâneas, restauração para um `WIKI_WORKSPACE_DIR` novo, importação pela interface, colisões de IDs, seleção de mundo, `trash/` e limites de recuperação. Não prometa recuperação automática que o código não oferece. Faça um ensaio somente com dados sintéticos em diretório temporário e registre os comandos e o resultado. Não exclua nem mova o `workspace/` do usuário.

**Fontes principais:** `src/services/worlds/worldLibrary.ts`, `src/lib/fs/paths.ts`, `src/repositories/filesystem/` e testes correspondentes.

**Aceite:** o procedimento documentado permite recuperar um mundo de teste e identifica claramente o que não recupera.

## Tarefa DOC-07 — Referência de interfaces e configuração

**Dependências:** DOC-01 e DOC-03.  
**Entregas:** `docs/reference/http-and-actions.md` e `docs/reference/configuration.md`.

1. Para cada Route Handler abaixo, informe método, finalidade, parâmetros, corpo, resposta, erros observáveis e consumidor interno. Indique que são interfaces da aplicação; não prometa estabilidade de API pública:
   - `POST /api/assets`
   - `GET /api/assets/[assetId]/[variant]`
   - `GET /api/entities/search`
   - `GET /api/entities/[entityId]/summary`
   - `PUT /api/boards/[boardId]`
   - `PUT /api/scenes/[sceneId]`
2. Explique as Server Actions por fluxo de negócio, sem duplicar cada assinatura quando isso não ajuda o leitor.
3. Documente `WIKI_WORKSPACE_DIR` e `PERSISTENCE_DRIVER` a partir de `.env.example` e do código, incluindo valor padrão, única implementação disponível e exemplos seguros. Identifique limites relevantes de upload e do ambiente local a partir de configuração verificada.

**Aceite:** exemplos de requisição e resposta são compatíveis com os handlers; nenhum segredo ou caminho pessoal aparece nos exemplos.

## Tarefa DOC-08 — Desenvolvimento, qualidade, operação e privacidade

**Dependências:** DOC-02, DOC-05 e DOC-07.  
**Entregas:** `docs/development.md`, `docs/testing.md` e `docs/operations-and-privacy.md` (divida apenas se o conteúdo ficar difícil de consultar).

Inclua instalação e comandos realmente presentes em `package.json`; organização do trabalho por camada; como criar e testar uma mudança de domínio ou migração; escopo atual dos testes; execução local de produção; localização dos dados, logs e limites de exposição na rede; ausência de autenticação e de armazenamento remoto; tratamento de uploads, backups e dados privados. Não proponha hospedagem pública como procedimento suportado sem implementação de controle de acesso.

**Aceite:** um novo colaborador consegue executar `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build`, entende as falhas documentadas e sabe como evitar publicar dados locais.

## Tarefa DOC-09 — Rastreio de trabalho em andamento

**Dependência:** DOC-01.  
**Entrega:** link para o rastreador existente ou `docs/work-items.md`.

Use issues existentes se forem acessíveis e realmente mantidas. Caso contrário, crie um registro local com campos **ID**, **resultado esperado**, **estado**, **evidência**, **próximo passo ou bloqueio** e **última verificação**. Inclua somente itens cujo estado esteja comprovado por issue, código/testes ou informação fornecida pelo usuário. Uma seção “estado ainda não confirmado” é melhor que um backlog inventado. Relacione decisões pendentes encontradas em DOC-01 a DOC-08.

**Aceite:** cada item tem fonte rastreável; “concluído” significa comportamento implementado e verificado, não apenas intenção registrada em ADR.

## Tarefa DOC-10 — Navegação, manutenção e verificação final

**Dependências:** DOC-02 a DOC-09.  
**Entregas:** índice no `README.md`, links entre guias, regra curta no `AGENTS.md` fora do bloco gerado pelo Next.js, e relatório final da execução.

1. A regra em `AGENTS.md` deve exigir avaliação do impacto documental em mudanças de código, dados, APIs e configuração; atualização das páginas afetadas na mesma tarefa; e registro explícito quando nenhuma página precisar mudar. Não edite o bloco gerado automaticamente pelo Next.js.
2. Verifique links Markdown relativos, caminhos citados, nomes de comandos, versões de esquema e exemplos. Use um verificador já disponível no projeto ou um script pequeno e determinístico somente se a conferência manual não for suficiente; não adicione dependência apenas para isso.
3. Execute `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build` se disponíveis. Para alterações exclusivamente documentais, esses comandos são uma verificação de regressão, não prova de correção dos textos. Registre resultados e limitações.
4. Faça uma leitura cruzada final: README ↔ PROJECT.md ↔ ADRs ↔ guias ↔ código. Revise o diff para remover conteúdo privado, duplicações, afirmações sem fonte e arquivos temporários.

**Aceite final:**

- Uma pessoa nova consegue instalar, usar os fluxos principais, localizar a implementação e recuperar dados de teste seguindo apenas a documentação.
- Arquitetura, recursos, rotas, configuração e versões dos dados concordam com o código atual.
- Decisões históricas, comportamento implementado e trabalho futuro estão identificados separadamente.
- Todos os links e caminhos locais citados resolvem; verificações executadas e lacunas remanescentes aparecem no relatório final.
- O diff contém apenas documentação e a instrução de manutenção aprovada por este plano; nenhuma amostra real de `workspace/` foi publicada.

## Condições que exigem informação adicional

- **Rastreador externo de trabalho:** se não estiver acessível, conclua as outras tarefas e registre essa limitação; não invente status, prioridade, responsável ou prazo.
- **Decisão arquitetural contraditória:** se o código divergir de uma regra marcada como fixa em `PROJECT.md`, documente o estado atual e a divergência. Só declare a regra revogada quando houver evidência de decisão aceita ou confirmação do usuário.
- **Ambiente de produção:** se não houver implantação verificável, documente a execução local e marque hospedagem e operação remota como não confirmadas.

## Comando de transferência para outra IA

> Implemente integralmente `docs/DOCUMENTATION_PLAN.md`, em ordem de DOC-01 a DOC-10. Use a skill `$project-documentation`, baseie cada afirmação no código atual, preserve os dados privados em `workspace/` e as alterações preexistentes, execute as verificações descritas e entregue um resumo por tarefa com arquivos alterados, evidências, resultados e pendências reais. Não encerre após produzir somente um novo plano.
