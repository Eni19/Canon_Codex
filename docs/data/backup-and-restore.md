# Backup, restauração, importação e descarte

## O que deve ser copiado

O backup manual confiável é uma cópia do workspace com o servidor parado ou sem nenhuma gravação
concorrente. Copie todo o diretório configurado em `WIKI_WORKSPACE_DIR`, incluindo:

- `worlds/`, com `world.json`, entidades, conteúdo, assets, quadros, cenas e `trash/` interno;
- `trash/worlds/`, se quiser preservar mundos removidos da biblioteca;
- qualquer arquivo adicional que uma versão futura tenha criado.

Copiar somente `world.json` recupera o catálogo do mundo, mas não suas entidades, imagens, quadros ou
cenas. Copiar somente `entities/` também não recupera a seleção de mundos nem assets. Não há backup
incremental, checksum, snapshot automático ou serviço remoto.

## Backup seguro no Windows

Pare `pnpm dev`/`pnpm start` ou garanta que não haja salvamentos ativos. Em um PowerShell, copie para
um destino novo e privado, substituindo os exemplos por caminhos escolhidos por você:

```powershell
$codexWorkspace = 'C:\Dados\canon-codex-workspace'
$codexBackup = 'D:\Backups\canon-codex-2026-09-23'
New-Item -ItemType Directory -Force -Path $codexBackup | Out-Null
Copy-Item -LiteralPath $codexWorkspace -Destination $codexBackup -Recurse -Force
```

O aplicativo não valida a integridade de uma cópia durante o backup. Depois de copiar, confira
manualmente se o destino contém `worlds` e pelo menos um `world.json`; valide o conteúdo abrindo uma
cópia, nunca apontando a aplicação de produção para o único backup.

## Restaurar em um workspace novo

Para uma recuperação, use um diretório novo e defina `WIKI_WORKSPACE_DIR` antes de iniciar o servidor:

```powershell
$codexRestore = 'C:\Dados\canon-codex-restaurado'
New-Item -ItemType Directory -Force -Path $codexRestore | Out-Null
$env:WIKI_WORKSPACE_DIR = $codexRestore
pnpm dev
```

Se você copiou o workspace inteiro, a aplicação encontra `worlds/<world-dir>/world.json` e lista os
mundos. Se copiou apenas uma pasta de mundo, coloque-a em
`<codexRestore>\worlds\<world-dir>` antes de iniciar. A seleção anterior está em um cookie do
navegador; abra `/` e clique no mundo desejado. Se o cookie não encontrar o ID, o código usa o
primeiro mundo disponível.

Outra opção é usar a interface **Carregar pasta** em `/`: informe a pasta que contém
`world.json` ou a raiz de outro Canon Codex. A aplicação copia o mundo para a biblioteca, ajusta o
slug de diretório em caso de colisão e preserva o `World.id`.

## Colisões e cópias

O importador rejeita uma cópia cujo `World.id` já exista na biblioteca, mesmo que o nome ou slug
sejam diferentes. Também rejeita duas cópias com o mesmo ID na mesma importação. Isso evita dois
diretórios representarem a mesma identidade e mantém relações/links previsíveis. A interface não
oferece clonagem com novo ID; não altere UUIDs manualmente sem entender e recriar todas as
referências.

Se a cópia de destino falhar no meio do processo, o importador remove os diretórios que criou nessa
tentativa e retorna erro. A pasta de origem permanece intocada.

## `trash/` e descarte

Excluir um mundo, entidade, asset, quadro ou cena move o diretório para `trash/` com ID e timestamp.
O inventário normal não lê essa pasta. Não há tela para restaurar, retenção automática ou ação de
descarte permanente. Portanto:

- preserve um backup antes de excluir;
- não remova `trash/` se ainda precisar de uma recuperação manual;
- a presença em `trash/` não garante recuperação, porque não há verificador de integridade nem
  restauração de referências implementada;
- restauração manual de entidade/asset/board/scene pode exigir recolocar exatamente o diretório no
  mundo correto e não é um procedimento suportado pela interface.

## Ensaio sintético verificado

Em 23/09/2026, um ensaio PowerShell criou source-workspace/worlds/synthetic/world.json, copiou
worlds/ para backup-workspace, restaurou em restore-workspace, definiu WIKI_WORKSPACE_DIR para o
destino e validou o World.id. Resultado: **PASS**; o diretório temporário foi removido. O ensaio
confirma o procedimento de cópia/restauração de um mundo sintético, mas não confirma backup físico
de dados reais, restauração de trash/ ou recuperação de falha de disco.

O ensaio automatizado de importação abaixo pertence à suíte do projeto e não foi executado nesta
sessão porque o runner não conseguiu manter as dependências instaladas:

```powershell
pnpm exec vitest run src/services/worlds/worldLibrary.test.ts src/repositories/filesystem/fileSystemWorldRepository.test.ts
```

Quando executado em um ambiente com as dependências disponíveis, ele verifica criação/descoberta do
seed, importação de uma raiz externa, rejeição de ID duplicado, exclusão para trash/ e leitura de
entidade/conteúdo.

Ao terminar uma sessão de teste que alterou a variável no PowerShell, limpe o processo atual:

```powershell
Remove-Item Env:WIKI_WORKSPACE_DIR -ErrorAction SilentlyContinue
```
