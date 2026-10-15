# Definir precisão, escala e filtros

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Separar a precisão armazenada da data, o nível de zoom da vista e a regra de visibilidade por categoria ou importância. Definir padrões configuráveis, intervalos, datas aproximadas, itens sem data, ordenação estável, busca e filtros temporários que não alteram a participação na linha.

## Answer

- Cada aparição tem uma data estruturada do calendário do mundo com ano inteiro (inclusive zero), mês opcional e dia opcional. Ano, mês e dia são precisões de armazenamento; a interface exibe exatamente a precisão preenchida, sem inventar mês ou dia.
- Um início pode ter fim opcional para formar um intervalo; fim ausente significa duração aberta. Início e fim podem ser marcados como aproximados. Uma aparição sem início fica na área "Sem data". A validação exige datas existentes no calendário configurado e fim não anterior ao início.
- O zoom das vistas usa século, década, ano, mês e dia. Década e século são grupos de dez e cem anos do calendário do mundo, inclusive em anos negativos. O zoom não altera a data salva.
- Cada categoria (tipo de entidade) tem uma escala mínima padrão de visibilidade, configurável por mundo. Padrão inicial: Evento aparece a partir de ano; Personagem, Local e Organização a partir de mês; demais tipos a partir de dia. Cada aparição pode substituir esse padrão, inclusive para aparecer em século ou década.
- Uma escala mais ampla agrega contagens de aparições ocultas por detalhe, com acesso para ampliar o zoom. Assim a linha não parece vazia quando há registros em escalas menores.
- O filtro por categoria usa os tipos existentes do mundo e permite múltipla seleção. Filtrar esconde aparições temporariamente em ambas as vistas, inclusive na área "Sem data"; não modifica a seleção persistida. Busca textual consulta o título de apresentação e o título do registro. Estado de filtros e zoom fica na URL, para navegação, atualização e compartilhamento local.
- A ordem cronológica é calculada pela posição do início no calendário; datas de precisão ampla usam o início de seu período apenas como chave interna, sem exibir uma data inventada. Empates usam uma chave estável de aparição. Arrastar não muda data nem ordem cronológica.
