# Mapa: Linha do tempo do Canon Codex

Label: wayfinder:map
Status: resolved

## Destination

Especificação decidida e plano de entregas verticais, com dependências e critérios de aceite, para outra IA implementar linhas do tempo editáveis e um calendário configurável por mundo.

## Notes

- Consultar os skills `grilling`, `domain-modeling` e `wayfinder` ao resolver decisões.
- Planejamento apenas: este mapa não executa a implementação.
- Decisões iniciais já confirmadas: linhas temáticas ou gerais, registros de qualquer tipo, filtros temporários de categoria, criação rápida seguida do editor completo, vistas vertical e horizontal, centenas de itens, uso móvel e design editorial com tokens existentes. As regras de aparição estão no ticket resolvido abaixo.
- A precisão das datas e as regras de exibição por escala devem ser configuráveis. O calendário por mundo, inclusive seu ano zero e Evento de origem único, está no ticket resolvido abaixo.
- Estado atual: `timeline` é entidade genérica com `scope`, `startDate` e `endDate`; `event` tem uma data convencional simples; mundos existentes carregam definições persistidas em `world.json`.
- Não há issue tracker configurado em `docs/agents/issue-tracker.md`; usar a convenção local de `.agents/skills/setup-matt-pocock-skills/issue-tracker-local.md`.

## Decisions so far

- [Definir aparições e vínculos com registros](issues/01-definir-aparicoes-e-vinculos.md): uma entidade admite várias aparições independentes; linha geral também é seleção explícita; inclusão e remoção preservam o registro.
- [Definir calendário do mundo e data de origem](issues/02-definir-calendario-do-mundo.md): calendário configurável por mundo, ano zero completo e um Evento de origem; alterações estruturais preservam posições temporais com prévia e confirmação.
- [Definir precisão, escala e filtros](issues/03-definir-precisao-escala-e-filtros.md): precisão ano/mês/dia, intervalos e aproximação; zoom até século; filtros temporários por tipo e visibilidade padrão configurável com ajuste por aparição.
- [Definir interação e apresentação das duas vistas](issues/04-definir-interacao-e-apresentacao.md): biblioteca e formulário de inclusão, edição de cartões, remoção com Desfazer e trilhas automáticas na vista horizontal.
- [Definir migração e sincronização com dados existentes](issues/05-definir-migracao-e-sincronizacao.md): migração explícita de todos os campos de data, prévia de mudança de origem, distinção entre lixeira e descarte permanente.
- [Fechar especificação e entregas para implementação](issues/06-fechar-especificacao-e-entregas.md): especificação consolidada e onze tickets verticais prontos para execução.

## Not yet specified

Nenhuma decisão de produto bloqueadora conhecida. Prosseguir pela [especificação de implementação](../linha-do-tempo-implementacao/spec.md) e seus tickets.

## Out of scope

- Implementar código ou migrar dados durante o trabalho de definição deste mapa. A execução segue a especificação e os tickets de implementação publicados separadamente.
