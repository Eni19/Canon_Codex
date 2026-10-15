# 07: Incluir e remover aparições pela biblioteca

**What to build:** A pessoa pesquisa registros, arrasta para a linha, adiciona todos em lote ou remove um cartão por área explícita, com ações equivalentes sem arrastar.

**Blocked by:** 06: Editar cartões e criar Eventos na linha.

**Status:** implemented

- [x] Biblioteca lateral no desktop e gaveta no celular permitem pesquisar, filtrar e adicionar registros de qualquer tipo, incluindo os sem data.
- [x] Soltar em um período sugere uma data e abre confirmação; cancelar não grava nada e a data do registro não é alterada.
- [x] Arrastar uma aparição para **Remover da linha** remove apenas aquela aparição e oferece Desfazer; botões e teclado cobrem as mesmas ações.
- [x] **Adicionar todos** é idempotente para registros já representados, sem impedir inclusão individual repetida; novos registros futuros não entram automaticamente.
- [x] Testes de filesystem cobrem inclusão, remoção, Desfazer e isolamento entre mundos. Cancelamento, inclusão, remoção e Desfazer foram verificados manualmente na interface; guia de uso acompanha os atalhos.
