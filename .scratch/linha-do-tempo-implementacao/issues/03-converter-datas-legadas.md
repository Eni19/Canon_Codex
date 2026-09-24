# 03: Converter datas existentes com prévia e recuperação

**What to build:** A pessoa vê e confirma a conversão das datas antigas do mundo inteiro, com backup e relatório de problemas, preservando as datas completas sem perda de ordem ou distância.

**Blocked by:** 02: Editar e ler datas do calendário do mundo.

**Status:** ready-for-agent

- [ ] A prévia contabiliza todos os campos declarados `date` nas definições do mundo, inclusive tipos personalizados, e mostra exemplos antes/depois e valores não conversíveis.
- [ ] O operador confirma a conversão; uma cópia recuperável é feita antes da escrita, e interrupção/falha permite retomar ou restaurar sem misturar estados silenciosamente.
- [ ] Datas ISO válidas preservam sua ordem e distância em dias; valores inválidos permanecem disponíveis para revisão.
- [ ] Uma segunda execução não duplica nem desloca datas já convertidas. Testes usam mundos sintéticos, nunca dados reais de `workspace/`.
- [ ] Guia de migração e backup explica prévia, confirmação, recuperação e limites.
