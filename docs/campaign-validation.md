# Roteiro: validar o Canon Codex com uma campanha real

Objetivo: usar o app durante a preparação e a condução de uma campanha de verdade para
encontrar atritos no fluxo do mestre. Os dados da campanha são privados e ficam fora do
repositório. Este roteiro diz o que exercitar e onde registrar o que aparecer.

## Antes de começar

1. Faça uma cópia da pasta da biblioteca antes de qualquer migração.
2. Se a biblioteca ainda estiver em arquivos, siga [SQLite local](data/sqlite.md):
   `pnpm storage preview <pasta>` e `pnpm storage import <pasta> <destino>/canon-codex.sqlite`.
   Anote no registro abaixo qualquer aviso da prévia (alvos ausentes, IDs duplicados).
3. Abra o app com `pnpm dev` e confira se todos os mundos e registros aparecem.

## Fluxos a exercitar

Para cada passo, anote o tempo aproximado, onde travou e o que esperava acontecer.

| Momento | O que fazer no app | O que observar |
| --- | --- | --- |
| Preparar o mundo | Ajustar o calendário (meses, eras, luas, estações) e definir o **Hoje da campanha** | Clareza dos formulários; se a data de hoje aparece onde se espera |
| Cadastrar o elenco | Criar personagens, organizações, locais e eventos que já existem na campanha | Campos que faltam; tipos de registro que não servem |
| Ligar o mundo | Criar vínculos em **Relacionamentos** (membro de, vive em, rival de) e organizar em pastas | Se as sugestões de tipo ajudam; vínculos duplicados; leitura do grafo com o mundo real |
| Antes da sessão | Revisar a agenda do mês e a linha do tempo; montar um quadro ou cena | Encontrar rápido o que importa para a sessão |
| Durante a sessão | Criar uma nota de sessão pela agenda, consultar fichas, projetar uma cena | Quantos cliques para achar uma ficha; o que fica lento ou escondido |
| Depois da sessão | Avançar o **Hoje da campanha**, registrar eventos novos e mudanças de vínculos | Se a cronologia continua coerente; se algo se perdeu |

## Onde registrar

- **Algo quebrado** (contradiz o comportamento documentado): [issue com label `bug`](https://github.com/Eni19/Canon_Codex/issues?q=is%3Aissue+is%3Aopen+label%3Abug), com passos
  mínimos e dados sintéticos que reproduzam o problema. Não copie nomes ou textos da campanha.
- **Algo que falta ou atrapalha** (funciona, mas não serve ao mestre): [issue com label `backlog`](https://github.com/Eni19/Canon_Codex/issues?q=is%3Aissue+is%3Aopen+label%3Abacklog).
- **Algo que já está planejado**: comente no item correspondente de [work-items.md](work-items.md).

Ao final de cada sessão de uso, revise as anotações e transforme as recorrentes em entradas
nesses arquivos. Uma linha por atrito basta; a priorização vem depois.

## Registro de sessões de validação

| Data | Fluxo | Resultado | Entradas criadas |
| --- | --- | --- | --- |
| | | | |
