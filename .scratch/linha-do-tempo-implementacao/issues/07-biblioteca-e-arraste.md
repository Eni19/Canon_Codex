# 07: Incluir e remover aparições pela biblioteca

**What to build:** A pessoa pesquisa registros, arrasta para a linha, adiciona todos em lote ou remove um cartão por área explícita, com ações equivalentes sem arrastar.

**Blocked by:** 06: Editar cartões e criar Eventos na linha.

**Status:** ready-for-agent

- [ ] Biblioteca lateral no desktop e gaveta no celular permitem pesquisar, filtrar e adicionar registros de qualquer tipo, incluindo os sem data.
- [ ] Soltar em um período sugere uma data e abre confirmação; cancelar não grava nada e a data do registro não é alterada.
- [ ] Arrastar uma aparição para **Remover da linha** remove apenas aquela aparição e oferece Desfazer; botões e teclado cobrem as mesmas ações.
- [ ] **Adicionar todos** é idempotente para registros já representados, sem impedir inclusão individual repetida; novos registros futuros não entram automaticamente.
- [ ] Testes cobrem inclusão, cancelamento, remoção, Desfazer e isolamento entre mundos; guia de uso acompanha os atalhos.
