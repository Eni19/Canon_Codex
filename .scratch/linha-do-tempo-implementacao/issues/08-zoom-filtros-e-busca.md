# 08: Navegar por escala, categoria e busca

**What to build:** A pessoa aproxima a linha até o dia, afasta até o século e filtra categorias sem alterar a participação dos cartões.

**Blocked by:** 06: Editar cartões e criar Eventos na linha.

**Status:** implemented

- [x] Zoom cobre século, década, ano, mês e dia; a data persistida e a ordem não mudam ao trocar a escala.
- [x] Padrão de visibilidade por tipo é configurável por mundo, com substituição por aparição; agregados revelam a existência de itens ocultos por escala.
- [x] Filtro múltiplo por tipo e busca textual ocultam temporariamente cartões em toda a vista, inclusive **Sem data** e cartões cujo registro está na lixeira; título e categoria permanecem filtráveis, e as contagens distinguem ocultos por filtro e por escala.
- [x] Filtro, busca, zoom e o parâmetro de vista são recuperados da URL e preservados no histórico. A opção horizontal só será exibida no TL-09.
- [x] Testes cobrem escala com anos negativos/zero, filtros combinados, migração/configuração do mundo e ausência de mutações; guia de navegação atualizado.
