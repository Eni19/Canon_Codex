# ADR-003: Assets referenciados por ID opaco, nunca por path

> **Estado:** implementado · **Última verificação:** 25/11/2026, cookie `canon-codex-world` em `src/app/actions/worlds.ts` e rota `src/app/api/assets/[assetId]/[variant]/route.ts`.

## Estado atual em 24/11/2026

IDs opacos, importação de imagens, variantes e entrega por Route Handler estão implementados.
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
- Importar uma imagem (`AssetStore.importFromPath`/`importFromBuffer`) guarda uma cópia independente
  do original e tenta gerar uma miniatura WebP. No filesystem, o original fica em
  `workspace/worlds/<world>/assets/<assetId>/original.<ext>`. No SQLite, os metadados ficam em
  `assets` e cada variante fica em `asset_variants` como BLOB com MIME próprio.
- A UI usa `/api/assets/[assetId]/[variant]` para solicitar a imagem. O Route Handler chama
  `AssetStore.getVariant(worldId, assetId, variant)` e recebe os bytes e o MIME, ou `null` quando
  a variante está indisponível naquele mundo.
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

### Atualização: fundos do calendário (12/11/2026)

Temas personalizados guardam `backgroundAssetId` no mundo. O upload dedicado valida mundo, tipo,
8 MB e 40 milhões de pixels. Uma chamada a `AssetStore.importFromBuffer` com a finalidade
`calendar-background` prepara as variantes WebP de até 768 e 1600 px antes da gravação. No SQLite,
uma transação grava o original, as variantes e os metadados. A seleção responsiva usa a largura da
tela e conserva um fundo de cor se a imagem estiver indisponível. Ao excluir um asset, o repositório
consulta as referências dos temas dentro da mesma operação de escrita. A cópia é criada ao escolher
o arquivo. Remover a referência deixa o asset disponível para reutilização.

- Toda leitura de imagem passa por um Route Handler (custo pequeno de uma chamada HTTP a mais por
  imagem). O handler é um ponto futuro possível para controle de acesso/publicação seletiva, mas
  esse controle ainda não existe.
- Uma implementação futura com S3 ou R2 pode consultar as variantes no serviço remoto e manter
  as referências de domínio e a rota HTTP existentes.
- No filesystem, perder `asset.json` torna as variantes indisponíveis para a aplicação mesmo que
  os arquivos binários persistam. No SQLite, a exclusão lógica conserva os BLOBs e retira o asset
  e suas variantes das consultas ativas.
