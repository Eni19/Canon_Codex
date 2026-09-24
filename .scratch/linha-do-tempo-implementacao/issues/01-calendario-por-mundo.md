# 01: Configurar calendário por mundo

**What to build:** A pessoa edita o calendário do mundo atual e confere datas antes e depois do ano zero numa prévia, sem afetar outros mundos.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Um mundo existente recebe um calendário inicial equivalente ao calendário convencional usado pelos campos atuais; um novo mundo também pode personalizá-lo.
- [ ] É possível editar nomes dos dias e meses, comprimento de cada mês, horas por dia, eras e nome da origem, além de regras repetíveis de dias intercalares.
- [ ] A prévia mostra datas válidas em anos negativos, zero e positivos; entradas inválidas e meses com comprimento não positivo são rejeitados com explicação.
- [ ] Calendários de dois mundos permanecem independentes; cálculo e persistência têm testes de round-trip e limites.
- [ ] Documentação de configuração, dados e migração descreve o que foi entregue.
