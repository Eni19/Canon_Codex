# 09: Alternar para uma vista horizontal sem sobreposição

**What to build:** A pessoa alterna entre as mesmas aparições nas vistas vertical e horizontal, com navegação por eixo e trilhas automáticas.

**Blocked by:** 08: Navegar por escala, categoria e busca.

**Status:** implemented

- [x] O eixo horizontal mostra marcas coerentes com o calendário e com o zoom selecionado, incluindo anos negativos, zero e períodos longos.
- [x] Cartões próximos usam trilhas automáticas para evitar sobreposição; intervalos e aproximações permanecem reconhecíveis.
- [x] Filtro, busca, escala, cartão selecionado e acesso a **Sem data** se comportam como na vista vertical.
- [x] No celular a vista vertical é inicial e a horizontal é utilizável por toque; ambas têm navegação por teclado e estados vazios claros.
- [x] Testes de layout/semântica e documentação demonstram a alternância sem perda de estado.

**Evidência:** `buildTimelineHorizontalLayout` usa ordinais do calendário, limita o eixo a 160 slots adaptativos e distribui aparições em trilhas; `TimelineInteractiveView` alterna `view=vertical|horizontal`, preserva os demais parâmetros da URL e expõe rolagem por toque/teclado. `timelineNavigation.test.ts` cobre intervalos aproximados, trilhas, ano zero, limite mensal e preservação dos filtros na URL. A verificação visual manual permanece pendente.
