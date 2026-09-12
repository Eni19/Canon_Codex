# ADR-001: Armazenamento local-first via filesystem, atrás de interfaces de repositório

## Contexto

O MVP não pode depender de banco de dados hospedado, autenticação ou storage externo (requisito do
produto: rodar 100% localmente, sem custo, sem conta). Ao mesmo tempo, o produto pretende evoluir
para Postgres, object storage (S3/R2), múltiplos usuários e colaboração — sem reescrever a camada
de domínio ou os componentes de UI quando isso acontecer.

## Decisão

- Toda persistência de dados de domínio (mundos, entidades, relações, conteúdo) passa pela
  interface `WorldRepository`; toda persistência de binários (imagens) passa pela interface
  `AssetStore`. Ambas moram em `src/repositories/contracts/` e não têm nenhuma dependência de
  Node.js ou do filesystem.
- A única implementação hoje é `FileSystemWorldRepository`/`FileSystemAssetStore`
  (`src/repositories/filesystem/`), que grava em `workspace/worlds/<world-slug>/` conforme a
  estrutura descrita em `PROJECT.md`.
- Uma factory (`getWorldRepository()`/`getAssetStore()`) resolve qual implementação usar a partir
  de uma variável de ambiente (`PERSISTENCE_DRIVER`, hoje só `filesystem`). Nenhum código de UI ou
  Server Action instancia `FileSystemWorldRepository` diretamente.
- Todo componente React, Server Action ou Route Handler depende apenas dos contratos, nunca da
  implementação concreta.

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

- Toda escrita precisa ser atômica e validada (ver `ADR-002` e `lib/fs/atomicWriteJson.ts`), já que
  não há transações de banco protegendo contra escrita parcial.
- Buscas e relações são computadas por varredura em memória no MVP; aceitável na escala de uso
  pessoal, e isolado atrás de `WorldRepository` para poder ser otimizado ou substituído por índices
  reais (ou por uma implementação SQL) sem tocar na UI.
- Uma futura `PostgresWorldRepository`/`S3AssetStore` é um trabalho aditivo: implementar os
  mesmos métodos, trocar a factory. Nenhuma tela ou Server Action muda.
