# Relatório da implementação do plano documental

Execução concluída em 23/09/2026, na ordem DOC-01 a DOC-10.

O escopo ficou restrito a documentação e instruções de manutenção. O package-lock.json não foi
modificado e nenhum arquivo ou conteúdo do workspace real foi lido, copiado ou publicado.

## Resultado por tarefa

| Tarefa | Resultado | Arquivos principais |
| --- | --- | --- |
| DOC-01 | inventário de rotas, actions, handlers, contratos, schemas e testes; matriz de evidências; ausência de tracker acessível | docs/documentation-audit.md |
| DOC-02 | README reduzido a entrada; PROJECT.md corrigido; ADRs 001–005 qualificados com estado atual | README.md, PROJECT.md, docs/architecture/ADR-001 até ADR-005 |
| DOC-03 | camadas, seleção de mundo, leitura/escrita, assets, quadros, cenas e projeção documentados | docs/architecture/overview.md |
| DOC-04 | quatro fluxos de uso com passos, tipos, limites e exclusões | docs/user-guide/index.md, worlds.md, entities.md, editor.md, boards-scenes-and-projection.md |
| DOC-05 | árvore de arquivos, identidade, invariantes, inválidos e migrações atuais documentados | docs/data/storage.md, docs/data/migrations.md |
| DOC-06 | backup, importação, colisões, lixeira e limites de recuperação; ensaio sintético manual aprovado | docs/data/backup-and-restore.md |
| DOC-07 | seis handlers, payloads, respostas, erros observáveis e actions agrupadas; configuração documentada | docs/reference/http-and-actions.md, docs/reference/configuration.md |
| DOC-08 | desenvolvimento, comandos, teste, operação local, privacidade e limites de rede | docs/development.md, docs/testing.md, docs/operations-and-privacy.md |
| DOC-09 | lacunas verificáveis separadas de backlog inventado | docs/work-items.md |
| DOC-10 | índice, links cruzados, regra de manutenção e verificação final registrados | README.md, AGENTS.md, este relatório |

## Verificações realizadas

### Ensaio de recuperação sintética

Foi executado um comando PowerShell usando somente diretórios temporários. Ele criou
source-workspace/worlds/synthetic/world.json, copiou o diretório worlds para backup-workspace,
restaurou em restore-workspace, definiu WIKI_WORKSPACE_DIR para o destino e validou o World.id.

Resultado: **PASS** — a cópia e restauração preservaram world.json e World.id; o diretório
temporário foi removido. O ensaio não prova recuperação de trash, falha de disco ou referências
corrompidas.

### Links

Foi usado um verificador PowerShell determinístico para resolver links Markdown relativos de README
e docs. A primeira execução encontrou somente os dois relatórios que ainda estavam sendo criados;
após a criação destes arquivos, a verificação final passou:

    OK: todos os links relativos Markdown resolvem

### Dependências e comandos do projeto

- Node.js verificado: v24.21.0; o Next.js instalado declara >=20.9.0.
- pnpm declarado pelo package.json: 12.3.4.
- pnpm install --frozen-lockfile: concluído com cache global, sem alteração de lockfile.
- pnpm typecheck: não concluído. O runner pnpm tentou recriar node_modules e abortou em modo sem TTY;
  com CI=true, entrou novamente no ciclo de reinstalação. A tentativa offline forçada terminou com
  ERR_PNPM_NO_OFFLINE_META.
- pnpm lint, pnpm test e pnpm build: não executados depois do bloqueio de dependências, pois os
  binários não permaneceram utilizáveis no layout gerenciado do runner.

Esses comandos são regressão de código para uma mudança documental; o bloqueio não foi tratado como
falha do texto. A limitação permanece explícita em vez de declarar uma aprovação inexistente.

## Lacunas remanescentes

As lacunas reais estão em [work-items.md](work-items.md): decisão sobre o modelo híbrido de tipos,
restauração/purge, necessidade da chave tldraw e operação fora de localhost. Não há tracker externo
acessível nesta execução. A atualização futura dessas decisões deve incluir o código e a
documentação na mesma mudança.
