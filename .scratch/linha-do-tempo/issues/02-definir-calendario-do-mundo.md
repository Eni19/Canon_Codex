# Definir calendário do mundo e data de origem

Type: grilling
Status: resolved
Blocked by: none

## Question

Confirmar se "projeto" significa o mundo selecionado no Canon Codex. Definir unidades e nomes configuráveis, variação de dias por mês, regras de ano extra ou intercalação, duração do dia, representação do instante de origem e períodos anteriores/posteriores. Definir quais alterações do calendário são permitidas após existirem datas, e se preservam a posição temporal ou apenas reinterpretam os rótulos.

## Answer

- Há um calendário por mundo. Ele permite nomear dias, meses e as eras anterior/posterior, definir o comprimento individual de cada mês e o número de horas por dia. A sequência de dias da semana não precisa dividir igualmente cada mês. Um ciclo repetível opcional pode acrescentar dias intercalares.
- O ano zero é um ano completo, contendo o acontecimento de origem em um mês e dia opcionais. A sequência de anos inclui `-1`, `0` e `1`; os rótulos das eras são configuráveis.
- No máximo um registro do tipo Evento por mundo pode ser associado à origem. A criação de Evento oferece a opção de torná-lo o Evento de origem. Essa escolha define a data dele no ano zero; uma troca futura exige ação explícita e confirmação. O calendário mantém o nome e a estrutura temporal se o Evento associado deixar de estar disponível.
- Mudanças estruturais no calendário preservam a posição temporal relativa das datas já registradas, exibem uma prévia do efeito sobre seus rótulos e exigem confirmação. Renomear unidades ou eras pode ocorrer sem migração temporal.
- A configuração de horas por dia existe desde a primeira entrega do calendário. As aparições da primeira versão usam no máximo precisão de dia; posicionamento por hora fica para uma entrega posterior.
