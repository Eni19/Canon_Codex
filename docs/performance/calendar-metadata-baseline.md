# Referência inicial: leitura de metadados do calendário

Medição local em **11/11/2026**, com o caminho efetivamente usado pela agenda: `FileSystemWorldRepository.listEntities(worldId, { type: 'event' })`. O repositório lê e valida os metadados de todos os registros e só depois filtra os Eventos. Os dados eram sintéticos, em diretório temporário; nenhuma pasta pessoal foi usada.

| Registros | Eventos | Primeira consulta após gerar os arquivos | Consultas seguintes |
| ---: | ---: | ---: | ---: |
| 500 | 50 | 423,9 ms | 462,9 ms; 537,9 ms |
| 5.000 | 500 | 5.941,9 ms | 4.810,8 ms; 2.845,4 ms |

Ambiente: Windows 10.0.26200, AMD Ryzen 7 5700U, Node 24.21.0; filesystem e carga concorrente não foram caracterizados. Os arquivos foram escritos imediatamente antes da medição: a primeira consulta **não é uma leitura fria controlada**. São três amostras por volume, sem percentis, exclusão de cache, build de produção ou medição de interface. O tempo inclui resolução do mundo, leitura, migração/validação e filtro; não mede a projeção da agenda nem latência de navegador.

O resultado justifica investigar uma projeção de Eventos reconstruível ou outra estratégia de leitura, conforme o plano. Não comprova o desempenho final nem a eficácia de qualquer otimização.

A [medição em produção de 13/11/2026](calendar-production.md) inclui os resultados da projeção.
O benchmark agora executa também o caminho da agenda e registra seus tempos em `agendaMilliseconds`.

## Repetir

Em PowerShell, a partir da raiz do projeto, configure um diretório temporário isolado e execute o teste opt-in:

```powershell
$benchTemp = Join-Path (Get-Location) '.calendar-bench-temp'
New-Item -ItemType Directory -Force -Path $benchTemp | Out-Null
$env:TEMP = $benchTemp
$env:TMP = $benchTemp
$env:CALENDAR_BENCH = '1'
$env:CALENDAR_BENCH_OUTPUT = Join-Path $benchTemp 'results.json'
pnpm exec vitest run src/repositories/filesystem/calendar-metadata.bench.test.ts --no-file-parallelism
Get-Content $env:CALENDAR_BENCH_OUTPUT
```

O teste cria seu próprio mundo temporário, define `WIKI_WORKSPACE_DIR` somente no processo de teste e remove esse mundo ao terminar. O arquivo de resultados e o cache temporário ficam no diretório escolhido acima. O teste é ignorado na suíte normal.
