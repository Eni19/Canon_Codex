# Grafo de relacionamentos: primeira verificação densa

Verificação em **16/11/2026**, com build de produção local e um mundo exclusivamente sintético:
500 registros, 1.500 relações, três tipos de relação e dois tipos de item. A distribuição e as
conexões são definidas por `scripts/relationship-stress-fixture.ts`; não há dados reais no teste.

Na primeira inspeção, a organização automática em quatro colunas excedeu a altura do canvas mesmo
após enquadrar. A lista HTML apresentava todos os 500 itens e 1.500 vínculos simultaneamente. Após
o ajuste, uma grade adaptativa mostrou o conjunto dentro da área do canvas e as listas passaram a
exibir até 50 entradas por página. No navegador, foram conferidos a página inicial com as contagens,
o enquadramento visual, a seleção de vizinhança e o avanço para a segunda página de itens. A
visualização integral ainda é densa: busca e vizinhança continuam úteis para examinar detalhes.

Três requisições HTTP locais sequenciais para `/relationships`, medidas com `Stopwatch` e
`Invoke-WebRequest`, responderam com status 200 em **798, 397 e 399 ms**, com resposta de 482.313
bytes em cada tentativa. São tempos observados de resposta e transferência neste computador; não
medem hidratação, desenho, quadros por segundo, latência de pan, zoom ou seleção. Não há comparação
numérica anterior equivalente nem meta de desempenho estabelecida.

O teste `src/domain/relations/relationshipStress.test.ts` confere as contagens, índices, expansão
completa e coordenadas finitas. Para reproduzir a inspeção, crie uma pasta temporária ainda
inexistente (o comando não sobrescreve uma pasta existente):

```powershell
$env:RELATIONSHIP_STRESS_ROOT = Join-Path $env:TEMP ("canon-graph-stress-" + [guid]::NewGuid())
pnpm exec vitest run --config scripts/vitest.relationship-stress.config.mts
$env:WIKI_WORKSPACE_DIR = $env:RELATIONSHIP_STRESS_ROOT
pnpm build
pnpm start --port 3211
```

Abra `http://localhost:3211/relationships`. A geração recusa caminhos fora do diretório temporário.
Não execute esses comandos com o diretório privado `workspace/` como destino.

Permanecem sem medição a fluidez de abertura e de interação no canvas, a memória, dispositivos
móveis, toque físico, leitor de tela e testes em outros navegadores. Ainda não houve avaliação de
desenho por área visível ou de nível de detalhe; a migração dos editores depende dessa validação.
