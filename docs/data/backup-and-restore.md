# Backup, restauração, importação e descarte

## O que deve ser copiado

O backup manual confiável é uma cópia do workspace com o servidor parado ou sem nenhuma gravação
concorrente. Copie todo o diretório configurado em `WIKI_WORKSPACE_DIR`, incluindo:

- `worlds/`, com `world.json`, entidades, conteúdo, assets, quadros, cenas e `trash/` interno;
- `worlds/<world-dir>/date-migrations/`, com backups e estados da conversão de datas antigas;
- `worlds/<world-dir>/origin-backups/`, com backups e estados das trocas de Evento de origem;
- `trash/worlds/`, se quiser preservar mundos removidos da biblioteca;
- qualquer arquivo adicional que uma versão futura tenha criado.

Copiar somente `world.json` recupera o catálogo do mundo, mas não suas entidades, imagens, quadros ou
cenas. Copiar somente `entities/` também não recupera a seleção de mundos nem assets. Não há backup
incremental, checksum, snapshot automático integral do workspace ou serviço remoto.

## Backup seguro no Windows

Pare `pnpm dev`/`pnpm start` ou garanta que não haja salvamentos ativos. Em um PowerShell, copie para
um destino novo e privado, substituindo os exemplos por caminhos escolhidos por você:

```powershell
$codexWorkspace = 'C:\Dados\canon-codex-workspace'
$codexBackup = 'D:\Backups\canon-codex-2026-09-23'
New-Item -ItemType Directory -Force -Path $codexBackup | Out-Null
Copy-Item -LiteralPath $codexWorkspace -Destination $codexBackup -Recurse -Force
```

O backup automático de `/calendar/migration` guarda apenas os metadados de entidades que serão
convertidos. Ele permite retomar ou restaurar aquela conversão pela mesma tela, desde que os arquivos
não tenham recebido outras edições. Ele não substitui uma cópia do workspace inteiro.

Ao confirmar a troca de Evento de origem em `/calendar/origin`, o aplicativo grava em
`origin-backups/` uma cópia de `world.json`, dos metadados de entidades e dos arquivos de aparições
de Linhas do Tempo que serão deslocados. Se a
gravação falhar, tenta restaurar esses arquivos. Se o processo for interrompido, a próxima leitura
ou gravação de metadados daquele mundo restaura o backup antes de continuar. Backups concluídos são
mantidos no diretório, mas não há botão para restauração manual pela interface. Essas cópias cobrem
somente a operação de origem; não substituem o backup integral do workspace.

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
Os catálogos normais não exibem essa pasta; linhas do tempo consultam seus metadados. Não há tela para restaurar, retenção automática ou ação de
descarte permanente. Portanto:

- preserve um backup antes de excluir;
- não remova `trash/` se ainda precisar de uma recuperação manual;
- a presença em `trash/` não garante recuperação, porque não há verificador de integridade nem
  restauração de referências implementada;
- restauração manual de entidade/asset/board/scene pode exigir recolocar exatamente o diretório no
  mundo correto e não é um procedimento suportado pela interface.

Linhas do tempo consultam metadados de registros na lixeira para preservar seus cartões.
Remover definitivamente um registro também da lixeira faz a reconciliação eliminar suas aparições
na próxima consulta de linha ou origem, ou ao criar uma origem. Recolocar somente o registro depois dessa limpeza
não recria os cartões: restaure também os `timeline.json` e, para o vínculo de origem, `world.json`
de um backup coerente. A limpeza não produz backup automático; veja [ciclo de vida](storage.md#reconciliação-de-registros-em-linhas-do-tempo-tl-10).

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
