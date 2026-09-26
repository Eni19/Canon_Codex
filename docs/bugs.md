# Registro de bugs

Este é o local do repositório para registrar bugs encontrados durante desenvolvimento, testes ou
uso manual. Um bug é um comportamento implementado que contradiz o esperado; uma funcionalidade
que ainda não existe deve ser registrada em [ideas.md](ideas.md) ou
[work-items.md](work-items.md), conforme o caso.

Não copie dados reais de `workspace/`, chaves de API, imagens privadas ou conteúdo de usuário para
este arquivo. Use nomes sintéticos e anexos sanitizados.

## Onde registrar

- **Bug confirmado no código:** adicionar uma entrada na tabela abaixo e, quando necessário, criar
  uma seção detalhada com reprodução mínima.
- **Limitação conhecida ou lacuna de implementação:** usar
  [work-items.md](work-items.md).
- **Ideia ou melhoria ainda não especificada:** usar [ideas.md](ideas.md).
- **Issue externa:** não há issue tracker conectado verificado neste repositório. Quando houver
  um tracker oficial, registrar aqui o ID/link externo sem duplicar a descrição inteira.

## Estados

- `novo`: ainda não foi investigado;
- `reproduzido`: a falha foi confirmada com passos definidos;
- `em correção`: existe uma alteração em andamento;
- `verificado`: a correção foi testada;
- `não reproduzido`: não foi possível confirmar com as evidências disponíveis;
- `adiado`: existe, mas depende de decisão ou prioridade externa.

## Registro

| ID | Área | Resumo | Estado | Severidade | Evidência/próximo passo | Última verificação |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-2026-09-26-01 | layout raiz (`src/app/layout.tsx`) | `<body>` com `min-h-full` quebra a cadeia de `height:100%`; toolbar do tldraw nos Quadros renderiza fora da área visível | verificado | alta | Ver seção abaixo | 26/09/2026 |
| BUG-2026-09-26-02 | Scene Runner (`src/components/scenes/scene-runner.tsx`) | `editor.setCameraOptions({initialZoom:'fit-max', ...})` no `onMount` pode calcular câmera `NaN` se o container do tldraw mede tamanho zero no instante do mount, derrubando o editor (`ValidationError: At camera.x`) | reproduzido | média | Ver seção abaixo | 26/09/2026 |

## Modelo de entrada

Copie este modelo para cada bug confirmado:

```markdown
### BUG-AAAA-MM-DD-NN — Título curto

- **Estado:** novo
- **Severidade:** baixa | média | alta | crítica
- **Área:** rota, componente, domínio, persistência, migração ou operação
- **Ambiente:** commit/branch, sistema operacional, navegador e comando usado
- **Pré-condições:** dados sintéticos e configuração necessária
- **Passos para reproduzir:**
  1. ...
  2. ...
- **Resultado esperado:** ...
- **Resultado observado:** ...
- **Evidência:** teste, log sanitizado, screenshot ou caminho do código
- **Impacto:** ...
- **Próximo passo:** ...
- **Última verificação:** AAAA-MM-DD
```

Ao corrigir um bug, atualize o estado, registre o teste realizado e verifique se README, guias,
contratos ou instruções de operação precisam ser ajustados.

### BUG-2026-09-26-01 — `<body>` sem altura definida faz a toolbar do tldraw sumir nos Quadros

- **Estado:** verificado
- **Severidade:** alta
- **Área:** `src/app/layout.tsx` (layout raiz), afeta qualquer página filha que dependa de `height: 100%` para preencher a viewport, em especial `InvestigationBoard` (`src/components/boards/investigation-board.tsx`)
- **Ambiente:** commit `e994a66`, Windows, `pnpm dev` (Next.js 16.3.4 / Turbopack), Chromium via preview interno
- **Pré-condições:** mundo com barra lateral mais alta que a viewport (ex.: `paranormal`, com 13 tipos de entidade + itens de ferramentas listados)
- **Passos para reproduzir:**
  1. Abrir um mundo cuja lista de tipos de entidade na barra lateral seja mais alta que a altura da janela.
  2. Ir em Quadros → abrir qualquer quadro existente.
  3. Observar a barra de ferramentas do tldraw (Selecionar, Mão, Desenhar, Seta, Texto...) na parte inferior do canvas.
- **Resultado esperado:** a barra de ferramentas aparece ancorada à base da área visível do canvas.
- **Resultado observado:** a barra de ferramentas não aparece; medindo via DOM, `.boardShell` tinha `height: 853px` numa viewport de `720px` — a toolbar existia no DOM mas ficava ~130px abaixo da área visível.
- **Causa raiz:** `<body>` usava `className="min-h-full ..."` (só `min-height: 100%`), não `height: 100%`. Como o pai não tem altura própria definida, o filho `<div className="flex h-full flex-1 ...">` do `WikiShell` não conseguia resolver `height: 100%` contra ele e colapsava para a altura do próprio conteúdo — nesse caso, a altura da barra lateral. Isso se propagava até `<main>` (`flex-1`) e daí até `.boardShell { height: 100% }`.
- **Por que não aparecia nas Cenas:** `SceneRunner` desativa a toolbar nativa do tldraw (`components={{ Toolbar: null, ... }}`) e usa controles próprios, então o mesmo bug de layout não tinha um elemento nativo ancorado à base para "sumir" e evidenciar o problema.
- **Evidência:** medição via `getBoundingClientRect()`/`getComputedStyle()` no DevTools: `html` (720px, correto) → `body` (853px, com `min-height:100%` mas sem `height`) → `main` (853px) → `.boardShell` (853px).
- **Correção:** trocado `min-h-full` por `h-full` em `<body>` (`src/app/layout.tsx`), alinhando com o padrão já usado em `<html className="h-full ...">` e no wrapper `<div className="flex h-full flex-1 ...">` do `WikiShell`.
- **Teste realizado:** reaberto o quadro "Idolo de pedra" (mundo "Ordem da Verdade") após a correção; `.boardShell` passou a medir `720px` (igual à viewport) e a barra de ferramentas ficou visível e funcional.
- **Impacto:** qualquer usuário com barra lateral mais alta que a tela (mundos com muitos tipos de entidade, ou janelas menores) ficava sem acesso às ferramentas de desenho/forma dos Quadros.
- **Próximo passo:** nenhum; considerar um teste de regressão de layout (ex.: Playwright) que verifique `boardShell.getBoundingClientRect().height <= window.innerHeight`.
- **Última verificação:** 2026-09-26

### BUG-2026-09-26-02 — Scene Runner pode travar com câmera `NaN` (`fit-max` antes do container ter tamanho)

- **Estado:** reproduzido
- **Severidade:** média
- **Área:** `src/components/scenes/scene-runner.tsx` (`onMount`, linha com `editor.setCameraOptions`)
- **Ambiente:** commit `e994a66`, Windows, `pnpm dev`, Chromium via preview interno, navegação client-side rápida entre rotas
- **Pré-condições:** nenhuma condição especial de dado; parece depender de timing de layout no momento do mount do tldraw
- **Passos para reproduzir:**
  1. Navegar rapidamente (via `navigate` programático) até `/scenes/[sceneId]` logo após carregar outra rota.
  2. Observar a tela de erro do tldraw ("Something went wrong... camera.x: Expected a number, got NaN").
- **Resultado esperado:** a cena carrega normalmente, com a câmera ajustada ao fundo via `zoomToBounds`.
- **Resultado observado:** `ValidationError: At camera.x: Expected a number, got NaN`, capturado pelo `ErrorBoundary` do tldraw, com o editor inutilizável até recarregar.
- **Causa provável:** `editor.setCameraOptions({..., initialZoom:'fit-max', baseZoom:'fit-max', ...})` é chamado dentro de `onMount`; se o container do tldraw ainda mede `0x0` no instante síncrono do mount (possível em transições client-side antes do layout estabilizar), o cálculo de "fit-max" divide por zero e produz uma câmera `NaN`, que falha na validação do schema do tldraw.
- **Evidência:** stack trace do console do navegador (`ValidationError` → `RecordType.validate` → `Store.put` → `HistoryManager.batch`), reproduzido de forma consistente ao navegar programaticamente para a cena logo após outra navegação.
- **Impacto:** se reproduzível em uso manual normal (não confirmado — pode ser mais raro fora de navegação automatizada), impede o Mestre de abrir a cena até recarregar a página.
- **Próximo passo:** confirmar se ocorre em navegação manual normal (clique real, sem automação); se sim, avaliar aguardar o primeiro `ResizeObserver` do container (ou usar `requestAnimationFrame`) antes de chamar `setCameraOptions`/`zoomToBounds`, ou envolver a chamada em guarda que verifique dimensões não-nulas do container.
- **Última verificação:** 2026-09-26
