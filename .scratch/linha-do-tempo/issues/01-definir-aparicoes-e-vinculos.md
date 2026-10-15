# Definir aparições e vínculos com registros

Type: grilling
Status: resolved
Blocked by: none

## Question

Uma mesma entidade pode aparecer várias vezes na mesma linha? Definir o que pertence ao registro original e o que pertence a cada aparição: título apresentado, descrição, data, imagem, posição e categoria. Definir se uma linha geral inclui novos registros automaticamente ou é uma seleção explícita como as linhas temáticas. Definir a inclusão e remoção sem perda do registro original.

## Answer

- Uma entidade pode ter várias aparições na mesma linha, cada uma ligada ao mesmo registro por ID estável.
- A aparição tem data e título de apresentação próprios. A data do Evento original preenche inicialmente uma nova aparição, mas alterações posteriores na aparição não modificam o Evento nem sincronizam automaticamente sua data.
- Linhas gerais e temáticas usam seleção explícita. Uma ação de inclusão em lote permite adicionar registros atuais; novos registros não entram automaticamente.
- Arrastar para uma área visível de remoção retira a aparição da linha, preservando o registro original; a interface oferece desfazer. Inclusão e remoção terão alternativas para toque e teclado.
- A apresentação completa de cartão, além de título e data próprios, será decidida no ticket de interação e apresentação.
