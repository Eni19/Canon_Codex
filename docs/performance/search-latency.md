# Tempo de resposta da busca geral

> **Estado:** parcial (medição até a entrega ao componente feita; falta a medição visual no
> navegador) · **Última verificação:** 26/11/2026, `src/components/wiki/palette-search.ts` e
> `scripts/search-perf.test.ts`.

A meta inicial é exibir a lista em até 300 ms em 95% das consultas. O ensaio usa SQLite com 1.000 personagens sintéticos, quatro consultas alternadas (Auorra, Mirante, Coruja e #lunar), uma rodada de aquecimento e dez rodadas medidas. O p95 é a 38ª menor das 40 durações.

## Reproduzir

1. No PowerShell do projeto, execute `corepack.cmd pnpm exec vitest run --config scripts/vitest.search-perf.config.mts --disableConsoleIntercept --silent=false`. O teste gera uma biblioteca temporária nova e imprime seu diretório e o p95 até a entrega ao componente.
2. Em outro PowerShell, defina as variáveis abaixo, usando o diretório impresso, e execute o servidor com os argumentos indicados. Pare antes qualquer servidor de desenvolvimento aberto neste projeto.

   ```powershell
   $env:WIKI_WORKSPACE_DIR = 'COLE_O_DIRETORIO_IMPRESSO'
   $env:SQLITE_DATABASE_PATH = Join-Path $env:WIKI_WORKSPACE_DIR 'search.sqlite'
   $env:PERSISTENCE_DRIVER = 'sqlite'
   corepack.cmd pnpm exec next dev --webpack -p 3426
   ```

3. Abra http://localhost:3426/character e confirme que está no mundo **Benchmark CANCOD-26**. Pressione Ctrl+K. Com a lista inicial aberta e a aba visível, execute o conteúdo de `scripts/search-perf-browser.js` no Console do navegador. O roteiro dispara o evento de entrada no campo real, espera o primeiro resultado esperado aparecer no diálogo e aguarda o próximo quadro de animação para dar ao navegador oportunidade de pintar.
4. Registre navegador, tamanho da janela, dispositivo, p95 e percentual em até 300 ms. Para comparar com a versão anterior nas mesmas condições, execute o roteiro com a espera de 150 ms em `schedulePaletteSearch`, depois repita com os 100 ms da implementação atual. Use a mesma base, janela, servidor e navegador nas duas execuções. Feche o terminal do servidor ao terminar para descartar as variáveis temporárias.

## Medições locais

Windows, AMD Ryzen 5 5600, Node 24.19.0. O ensaio automatizado usa o agendamento real da busca, leitura SQLite, Fuse.js e serialização JSON. Substitui o transporte HTTP por uma chamada local e termina quando o componente recebe os itens. A medição visual usa o roteiro do navegador e inclui HTTP e renderização.

| Etapa | Espera após a digitação | p95 até a entrega ao componente |
|---|---:|---:|
| Antes | 150 ms | 187,2 ms |
| Depois | 100 ms | 133,5 ms |

O navegador de teste encerrou antes de abrir a página neste ambiente. A meta de 300 ms até a lista visível aguarda a medição do passo 3.
