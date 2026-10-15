# Definir interação e apresentação das duas vistas

Type: grilling
Status: resolved
Blocked by: 01, 03

## Question

Definir o trajeto completo de adicionar, remover e editar cartões, inclusive arrastar, confirmação ou desfazer, alternativas para teclado e toque, e as vistas vertical e horizontal. Validar um protótipo de baixa fidelidade com estados vazios, filtros, densidade, sobreposição de cartões e comportamento móvel.

## Comments

### Esboço para discussão

```text
Linha: A história de Tal'Dorei                 [Editar linha] [Calendário]
[Vertical | Horizontal] [Século - Década - Ano - Mês - Dia] [Categorias] [Buscar]
154 itens na linha · 38 visíveis · 116 ocultos por escala/filtro

[Biblioteca de registros]                  [Linha temporal]
Buscar / filtrar por tipo                  Ano 0 · A Calamidade
[+ Adicionar todos]                         ├─ cartão: Primeira aparição de ...
Evento: A Calamidade  [arrastar]           ├─ cartão: ...
Personagem: ...        [arrastar]           Ano 1
Local: ...             [arrastar]           └─ cartão: ...
                                          [Sem data: 12 itens]
                                          [Solte aqui para remover da linha]
```

- Biblioteca lateral fixável no desktop; gaveta no celular. O botão "Adicionar" oferece a mesma ação que arrastar.
- Soltar um registro na linha abre um editor compacto para confirmar data, título de apresentação e visibilidade mínima. A posição de soltura sugere um período; não altera o registro original.
- Clicar em um cartão abre painel lateral para editar sua apresentação ou acessar o registro original. Remover por área explícita ou menu mostra ação Desfazer.
- Vista vertical agrupa cartões por período em uma coluna. Vista horizontal usa eixo rolável com marcas de tempo e trilhas para evitar sobreposição. No celular, a vista vertical é inicial; a horizontal continua disponível por toque.
- Filtros e zoom são iguais nas duas vistas. Há indicadores separados para itens ocultos pelo filtro e pela escala. Itens sem data têm seção própria.
- Os cartões mostram tipo de registro, título de apresentação, data/intervalo e nota curta opcional; a capa do registro pode ser exibida ou ocultada. Imagens independentes por aparição não estão no esboço.

## Answer

- O usuário aprovou título, nota curta, data/intervalo, escala mínima e opção de exibir ou ocultar a capa do registro. Categoria e link são herdados do registro; não há imagem ou cor própria da aparição nesta entrega.
- Soltar em um período apenas sugere a data e abre confirmação; a ação não altera o registro original silenciosamente.
- A vista horizontal usa trilhas automáticas contra sobreposição. A vertical agrupa por período; ambas compartilham zoom, filtros, biblioteca e edição de cartões.
- Arrastar para a área explícita remove uma aparição com Desfazer. Ações equivalentes por botão e teclado cobrem celular e acessibilidade.
