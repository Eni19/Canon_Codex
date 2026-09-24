# 05: Criar uma linha com aparições na vista vertical

**What to build:** A pessoa cria uma Linha do Tempo, inclui um registro de qualquer tipo, define sua data e lê cartões ordenados numa vista vertical.

**Blocked by:** 03: Converter datas existentes com prévia e recuperação.

**Status:** ready-for-agent

- [ ] A linha existente como entidade ganha uma página específica; seu título e conteúdo continuam utilizáveis.
- [ ] Uma aparição guarda ID próprio, ID do registro e data, dentro do mundo atual; o mesmo registro pode aparecer mais de uma vez sem duplicar a entidade.
- [ ] Datas e itens sem data sobrevivem a recarregamento; a vista vertical ordena os datados e apresenta seção separada para os sem data.
- [ ] Inclusão de registro de outro mundo e intervalo inválido falha sem escrita. Persistência versionada, round-trip e concorrência são verificados.
- [ ] Guia de linhas do tempo distingue funcionalidade implementada de entregas posteriores.
