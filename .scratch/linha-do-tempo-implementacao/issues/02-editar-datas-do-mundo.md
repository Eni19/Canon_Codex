# 02: Editar e ler datas do calendário do mundo

**What to build:** Campos de data de qualquer tipo de registro aceitam o calendário do mundo e mostram a precisão escolhida, enquanto valores ISO antigos continuam legíveis.

**Blocked by:** 01: Configurar calendário por mundo.

**Status:** ready-for-agent

- [ ] O editor de campo `date` aceita ano, ano e mês ou dia completo, incluindo ano zero e anos negativos, aproximação e intervalo quando aplicável.
- [ ] Leitura e edição dos registros mostram datas formatadas pelo calendário do mundo sem produzir `[object Object]` nem usar o controle nativo de data para anos fictícios.
- [ ] Uma data de Evento pode ser criada e reaberta no novo formato; um registro com data ISO antiga continua legível e editável durante a transição.
- [ ] Datas inválidas, fins anteriores ao início e lacunas de precisão são validados; testes cobrem tipos de registro diferentes e calendários diferentes.
- [ ] Guias de edição e contrato de dados refletem os dois formatos aceitos durante a transição.
