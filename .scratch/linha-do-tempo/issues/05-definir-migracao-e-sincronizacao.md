# Definir migração e sincronização com dados existentes

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Definir como converter datas de eventos já persistidas, como atualizar mundos existentes, como tratar edição simultânea da data do evento e da aparição, e o que ocorre quando o registro de origem é movido para a lixeira. Definir backup, reversibilidade e mensagens para dados que não puderem ser convertidos.

## Comments

- O usuário aceitou conversão explícita das datas ISO existentes, preservando ordem e distância temporal, com prévia dos novos rótulos.
- Trocar o Evento de origem recalcula os rótulos de todas as datas para colocá-lo no ano zero, preservando a distância temporal entre acontecimentos, com prévia e confirmação.
- Se o registro original estiver na lixeira, a aparição permanece com seus dados de apresentação e estado "Registro indisponível". Após exclusão permanente, a aparição deve desaparecer; isso exige distinguir lixeira de ausência definitiva.
- Inclusão em lote adiciona registros com e sem data; os últimos ficam na área "Sem data".
- O aplicativo atualmente só expõe exclusão lógica em `trash/`, sem restauração nem descarte permanente. Falta decidir se a UI de exclusão permanente entra nesta entrega ou se a regra deve ser preparada para uma futura operação de descarte.

## Answer

- Converter datas ISO existentes de todos os campos declarados como `date` no `EntityTypeDefinition` do mundo, inclusive tipos personalizados, com prévia, relatório de valores inválidos, backup e confirmação. Preservar ordem e distância entre datas completas. Valores não convertíveis permanecem identificados para revisão, sem perda silenciosa.
- A data do Evento original apenas preenche uma nova aparição; edições posteriores são independentes. Adicionar em lote inclui registros sem data numa área separada e é idempotente para registros que já possuem ao menos uma aparição.
- Trocar o Evento de origem recalcula os rótulos temporais para posicioná-lo no ano zero, preservando distâncias, com prévia e confirmação.
- Enquanto um registro está em `trash/`, sua aparição permanece com dados próprios e aviso de indisponibilidade. Quando o registro deixa de existir também na lixeira após descarte permanente, a aparição é removida da linha. A interface de descarte permanente de entidades fica fora deste esforço; o ciclo de vida e a limpeza das aparições devem estar preparados e verificados.
- Se o Evento de origem entra na lixeira, o calendário preserva o marco e avisa sobre o vínculo. Se ele é descartado permanentemente, o vínculo é limpo, mas o ano zero e seu nome permanecem até uma substituição explícita.
