# ADR-003: Assets referenciados por ID opaco, nunca por path

## Estado atual em 23/09/2026

IDs opacos, cópia para o workspace, variantes e resolução por Route Handler estão implementados.
O handler escolhe o mundo pelo cookie `canon-codex-world`; isso é seleção de contexto, não
autenticação ou autorização de usuário. Não há login nem publicação seletiva: não trate a URL como
uma camada de segurança para exposição em rede pública.

## Contexto

Imagens vêm do computador do usuário (`C:\Users\...\Amadeus.png`). Se a aplicação guardasse esse
path diretamente em uma entidade, renomear o arquivo, mover a pasta original, trocar de computador
ou migrar para object storage quebraria a referência. O produto exige que assets sobrevivam a tudo
isso e que a futura migração para S3/R2/Supabase Storage não exija reescrever entidades.

## Decisão

- Toda imagem tem um `assetId` (UUID) atribuído no momento da importação. A partir daí, nada no
  domínio ou na UI referencia um path de arquivo — só o `assetId`.
- Importar uma imagem (`AssetStore.importFromPath`/`importFromBuffer`) **copia** o arquivo para
  `workspace/worlds/<world>/assets/<assetId>/original.<ext>` e gera
  `.../assetId/thumbnail.webp`. O arquivo original do usuário nunca é referenciado depois da cópia.
- A UI nunca monta uma URL de imagem manualmente a partir de um path; ela sempre usa
  `/api/assets/[assetId]/[variant]`, um Route Handler que resolve o `assetId` para o binário atual
  via `AssetStore.getVariantPath`. Trocar o backend de storage é mudar essa única resolução.
- Entidades guardam `coverAssetId`/`galleryAssetIds: string[]` — nunca um path, nunca uma URL
  absoluta de disco.

## Alternativas consideradas

- **Guardar o path relativo ao workspace na entidade** (ex.: `assets/abc/original.png`): acopla o
  formato de armazenamento (filesystem) ao formato do dado de domínio; migrar para S3 exigiria
  reescrever todas as entidades. Rejeitado por violar a independência de storage.
- **Servir assets como arquivos estáticos em `public/`**: `public/` é compilado com o build do
  Next.js e não é local-first (o usuário importaria e o Next precisaria rebuildar); também exporia
  os arquivos por path direto, não por ID.

## Consequências

- Toda leitura de imagem passa por um Route Handler (custo pequeno de uma chamada HTTP a mais por
  imagem). O handler é um ponto futuro possível para controle de acesso/publicação seletiva, mas
  esse controle ainda não existe.
- `S3AssetStore`/`R2AssetStore` implementam o mesmo contrato de `AssetStore` trocando apenas a
  resolução interna de `assetId -> localização`; a assinatura pública (`assetId`, `variant`)
  não muda.
- Perder o arquivo `asset.json` de metadados não é catastrófico para o binário em si, mas a
  aplicação trata isso como perda de dado (não deriva o `assetId` do nome do arquivo).
