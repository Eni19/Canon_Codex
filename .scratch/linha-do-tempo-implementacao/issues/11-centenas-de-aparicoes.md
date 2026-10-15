# 11: Navegar com centenas de aparições em ambas as vistas

> Histórico: em 15/10/2026, o pedido de Cosmic Canvas substituiu o eixo/paginação desta entrega.
> Interface atual: [guia](../../../docs/user-guide/timelines.md) e
> [perfil](../../../docs/performance/timeline-cosmic-canvas.md).

**What to build:** Uma linha grande continua legível e responsiva, com filtros, edição e navegação móvel funcionais.

**Blocked by:** 07: Incluir e remover aparições pela biblioteca; 09: Alternar para uma vista horizontal sem sobreposição; 10: Preservar cartões na lixeira e limpar descarte definitivo.

**Status:** implemented

- [x] Um cenário sintético com pelo menos 500 aparições, intervalos e itens sem data abre em ambas as vistas sem congelamento perceptível; o perfil de desempenho e o ambiente de medição são registrados.
- [x] Agregação, renderização progressiva ou virtualização são aplicadas onde o perfil mostrar gargalo, preservando foco, teclado e retorno ao cartão selecionado.
- [x] Layouts móveis não apresentam cortes de controles essenciais; filtros e edição continuam operáveis sem arraste.
- [x] A suíte relevante, lint e verificação de tipos passam; documentação final distingue o entregue dos limites conhecidos.

**Evidência (14/10/2026):** [perfil de 500 aparições](../../../docs/performance/timeline-500.md).
O DOM inicial caiu de 41.332 para 1.616 elementos (aproximadamente 96%) com páginas de até 50
cartões e editor único montado sob demanda. Filtros/zoom antecedem a paginação; `page` fica na URL
e é preservado na troca de vista. Biblioteca também paginada, seleção/índices memoizados e
trilhas agrupadas em uma passagem. Verificados desktop 1440×900 e móvel 390×844: edição/gravação,
retorno de foco, navegação de páginas/eixo por teclado, acesso a Sem data e inclusão por botão.

**Validação:** testes de domínio percorrem as dez páginas com 500 IDs preservados; regressões
TL-10 corrigidas. TypeScript e lint de `src/` e `scripts/` passaram. Suíte completa: 125 testes
passaram e 1 falhou no pacote Tal’Dorei (49 relações, expectativa >100), fora do fluxo.
Os dados completos ainda são carregados; a paginação limita o DOM, não a persistência. Eixo
horizontal corresponde à página atual. Não foi medido FPS/INP nem simulado dispositivo lento;
animações e refinamento final permanecem no TL-12.

**Correções da revisão (14/10/2026):** retorno por ID à página do cartão após mudança de data;
aviso explícito quando filtros/zoom o ocultam; eixo horizontal reiniciado em nova página/seleção;
reset nativo do formulário impedido para preservar precisão/mês/escala depois de salvar.
As três reproduções passaram no navegador com 500 aparições, inclusive retorno horizontal no
celular 390×844. Testes de domínio acrescentam mudança de página, Sem data e ocultação por
busca/escala. Evidências e limites no [relatório](../../../docs/performance/timeline-500.md#correções-da-revisão-tl-11-14102026).

**Validação após correções:** 127 testes aprovados, 1 falha anterior no pacote Tal’Dorei;
TypeScript e lint passaram. O eixo mantém seu elemento ao reiniciar a rolagem; Voltar pelo
histórico foi verificado com foco preservado no eixo e rolagem zero.
