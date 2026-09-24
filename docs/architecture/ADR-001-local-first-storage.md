# ADR-001: Armazenamento local-first via filesystem, atrás de interfaces de repositório

## Estado atual em 23/09/2026

A decisão local-first continua implementada. O código agora possui quatro contratos, não apenas
dois: `WorldRepository`, `AssetStore`, `BoardRepository` e `SceneRepository`. As implementações
disponíveis continuam usando filesystem e `PERSISTENCE_DRIVER` ainda só aceita `filesystem`. O
diretório `workspace/` é privado e está excluído pelo `.gitignore`; a possibilidade histórica de
versioná-lo em Git não descreve o estado presente.

## Contexto

O MVP não pode depender de banco de dados hospedado, autenticação ou storage externo (requisito do
produto: rodar 100% localmente, sem custo, sem conta). Ao mesmo tempo, o produto pretende evoluir
para Postgres, object storage (S3/R2), múltiplos usuários e colaboração — sem reescrever a camada
de domínio ou os componentes de UI quando isso acontecer.

## Decisão

- Toda persistência de mundos, entidades, relações e conteúdo passa por `WorldRepository`; imagens
  passam por `AssetStore`; quadros passam por `BoardRepository`; e cenas passam por
  `SceneRepository`. Os quatro contratos moram em `src/repositories/contracts/` e não têm
  dependência de Node.js ou do filesystem.
- As implementações atuais são `FileSystemWorldRepository`, `FileSystemAssetStore`,
  `FileSystemBoardRepository` e `FileSystemSceneRepository` (`src/repositories/filesystem/`), que
  gravam em `workspace/worlds/<world-slug>/` conforme a estrutura documentada em
  [`docs/data/storage.md`](../data/storage.md).
- As factories `getWorldRepository()`, `getAssetStore()`, `getBoardRepository()` e
  `getSceneRepository()` validam `PERSISTENCE_DRIVER` (hoje só `filesystem`). A UI e as Server
  Actions não instanciam diretamente esses repositórios.
- Componentes React e Server Actions não instanciam a implementação concreta para persistência.
  Route Handlers usam os contratos para resolver dados; o handler de assets também usa
  `node:fs/promises` somente para transmitir o arquivo já resolvido. A biblioteca de mundos e o
  registry de diretórios têm I/O auxiliar documentado em
  [`docs/architecture/overview.md`](overview.md).

## Alternativas consideradas

- **SQLite embarcado (`better-sqlite3` / `node:sqlite`)**: mais robusto para queries complexas e
  concorrência, mas um banco binário único é pior para backup manual, diffs em Git e inspeção
  direta pelo usuário — o requisito do produto é que o usuário possa abrir/copiar/versionar seus
  dados sem ferramentas extras. Pode voltar a ser considerado como uma implementação alternativa de
  `WorldRepository` no futuro, sem violar esta ADR.
- **IndexedDB/localStorage no navegador**: não sobrevive a troca de navegador/computador nem
  permite backup trivial via cópia de pasta; contraria o requisito de dados "sob controle do
  usuário" fora do navegador.
- **Banco hospedado desde o início (Postgres/Supabase)**: contraria o requisito explícito de MVP
  sem serviços pagos e sem dependência de rede.

## Consequências

- Toda escrita precisa ser atômica e validada (ver `ADR-002` e `src/lib/fs/atomicWrite.ts`), já que
  não há transações de banco protegendo contra escrita parcial.
- Buscas e relações são computadas por varredura em memória no MVP; aceitável na escala de uso
  pessoal, e isolado atrás de `WorldRepository` para poder ser otimizado ou substituído por índices
  reais (ou por uma implementação SQL) sem tocar na UI.
- Uma futura `PostgresWorldRepository`/`S3AssetStore` é um trabalho aditivo: implementar os
  mesmos métodos, trocar a factory. Nenhuma tela ou Server Action muda.

O mesmo princípio se aplica a futuros repositórios de quadros e cenas. Ainda não existe banco
relacional, object storage, backup automático ou autenticação que proteja os dados.
