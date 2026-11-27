# ADR-009: Lixeira com prazo de 7 dias

> **Estado:** implementado · **Última verificação:** 27/11/2026, `src/domain/trash/trash.ts`,
> `src/repositories/sqlite/sqliteTrash.ts` e `getTrashRepository` em `src/repositories/index.ts`.

## Estado atual em 27/11/2026

Implementado no driver SQLite (#50). O driver filesystem continua só com a exclusão lógica antiga.

## Contexto

Excluir um registro, quadro, cena, playlist ou Codex sempre foi exclusão lógica: o SQLite grava
`deleted_at` e o filesystem move a pasta para `trash/`. Nada saía da lixeira: não havia tela para
restaurar nem para apagar de vez, e o banco crescia com tudo o que um dia foi excluído. O
`PROJECT.md` exige um ADR para tornar permanente uma exclusão lógica.

## Decisão

- Um item excluído fica **7 dias** na lixeira (`TRASH_RETENTION_DAYS`). Nesse prazo pode ser
  restaurado ou apagado na hora. Ao vencer, é apagado de forma definitiva e não pode mais ser
  restaurado, mesmo que a limpeza ainda não tenha rodado.
- O prazo conta a partir de `deleted_at`. Não há coluna nova nem migração do schema SQL.
- A limpeza (`TrashRepository.purgeExpired`) roda **ao abrir o banco**, isto é, na primeira
  requisição depois que o servidor sobe, e depois **no máximo uma vez por hora** enquanto o app
  estiver aberto, a partir da factory de repositórios. Uma falha na limpeza vai para o log e nunca
  impede o app de abrir. Listar a lixeira de um mundo ou de Codex também limpa antes, para a tela
  nunca mostrar um item vencido.
- Apagar de vez um registro é uma **ausência definitiva**: o repositório remove suas relações (as
  dele e as que apontam para ele), a linha do tempo dele, sua posição e pasta no grafo, e reconcilia
  as aparições em outras linhas e o vínculo de origem, tudo numa transação.
- Imagens que saíram de uso ficam na lixeira e só são apagadas depois do prazo **e** quando nenhum
  documento do mundo, ativo ou na lixeira, cita o ID. Restaurar um registro devolve as imagens
  que ele cita.
- Itens de um Codex que está na lixeira esperam o destino do Codex. Apagar o Codex apaga tudo o
  que pertence a ele. Restaurar um Codex cujo slug foi ocupado dá a ele um slug com sufixo.
- A lixeira com prazo existe só no SQLite. `getTrashRepository()` devolve `null` no driver
  filesystem, e a tela da lixeira explica que é preciso converter a biblioteca.

## Alternativas

- **Sem prazo, só restaurar e descartar à mão:** mais simples, mas o banco cresceria para sempre.
- **Job agendado ou timer no servidor:** o app é local e roda só quando aberto; um timer não traz
  garantia a mais do que a limpeza na abertura e a checagem ao restaurar.
- **Limpar a cada requisição:** a consulta é barata, mas gravaria no banco em quase toda leitura.
- **Implementar também no filesystem:** o driver só existe para bibliotecas que ainda vão ser
  convertidas; o custo de mover pastas com reconciliação não compensa.

## Consequências

- Recuperar algo excluído há mais de 7 dias só é possível por um backup do banco
  ([SQLite](../data/sqlite.md#backup-e-restauração)).
- Uma referência em propriedade (`reference`, `referenceList`) a um registro apagado de vez continua
  gravada e aparece como indisponível, como já acontecia com registros ausentes.
- Mudar o prazo é trocar `TRASH_RETENTION_DAYS`; os itens já excluídos passam a seguir o prazo novo.
