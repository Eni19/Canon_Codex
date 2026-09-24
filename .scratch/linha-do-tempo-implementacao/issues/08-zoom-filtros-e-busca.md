# 08: Navegar por escala, categoria e busca

**What to build:** A pessoa aproxima a linha até o dia, afasta até o século e filtra categorias sem alterar a participação dos cartões.

**Blocked by:** 06: Editar cartões e criar Eventos na linha.

**Status:** ready-for-agent

- [ ] Zoom cobre século, década, ano, mês e dia; a data persistida e a ordem não mudam ao trocar a escala.
- [ ] Padrão de visibilidade por tipo é configurável por mundo, com substituição por aparição; agregados revelam a existência de itens ocultos por escala.
- [ ] Filtro múltiplo por tipo e busca textual ocultam temporariamente cartões em toda a vista, inclusive **Sem data**; contagens distinguem ocultos por filtro e por escala.
- [ ] Filtro, busca, zoom e vista são recuperados da URL e funcionam com voltar/avançar do navegador.
- [ ] Testes cobrem escala com anos negativos/zero, filtros combinados e ausência de mutações; guia de navegação é atualizado.
