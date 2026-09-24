# Ideias e evolução do produto

Este documento registra ideias propostas para evolução do Canon Codex. Uma ideia aqui não é uma
funcionalidade implementada nem um compromisso de prazo. Antes de entrar em desenvolvimento, ela
precisa de escopo, decisão de produto, critérios de aceitação e atualização das páginas afetadas.

## IDEA-001 — Linha do tempo

### Objetivo

Implementar uma linha do tempo navegável para organizar eventos do mundo por período, com leitura
cronológica e edição dos eventos relacionados.

### Estado atual

O seed já possui o tipo de entidade `timeline`, mas ele usa a apresentação genérica. Isso não
constitui uma linha do tempo funcional: ainda faltam a visualização temporal, regras de ordenação,
edição de períodos e uma decisão sobre como eventos e entidades serão relacionados.

### Decisões necessárias

O planejamento foi concluído no [mapa Wayfinder](../.scratch/linha-do-tempo/map.md) e na [especificação de implementação](../.scratch/linha-do-tempo-implementacao/spec.md). Foram decididas várias linhas temáticas ou gerais, seleção de registros de qualquer tipo, inclusão e remoção por arrastar, cartões com apresentação própria, filtros de categoria temporários e vistas vertical e horizontal, além de um calendário configurável por mundo com ano zero. Essas decisões ainda não representam funcionalidade implementada.

Os [tickets de implementação](../.scratch/linha-do-tempo-implementacao/issues/) tratam modelo de aparições, regras de calendário, precisão e escala, interação acessível, conversão dos dados existentes e ciclo de vida de registros na lixeira.

## IDEA-002 — Grafo de relações com edição visual

### Objetivo

Criar uma visualização em grafo das entidades e relações do mundo, permitindo criar, editar e
remover ligações visualmente, inclusive relações direcionais representadas por setas.

### Escopo desejado

- nós representando entidades;
- arestas representando relações, com tipo e rótulo;
- setas para relações direcionais;
- criação de uma relação ao conectar dois nós;
- edição do tipo, rótulo e direcionalidade da ligação;
- atualização das relações existentes e dos backlinks;
- filtros por tipo de entidade, tipo de relação e seleção de um subconjunto do mundo.

### Decisões e riscos

O modelo atual já armazena relações direcionais ou não direcionais, portanto a visualização pode
reutilizar esse contrato. Ainda é preciso decidir o motor visual, o comportamento para grafos
grandes, o salvamento de posição dos nós e como evitar alterações acidentais durante o arraste.

## IDEA-003 — IA embutida por mundo

### Objetivo

Permitir que a pessoa configure uma API de IA e use um assistente contextualizado no mundo atual.
O pedido inclui acesso amplo ao conteúdo do mundo e a capacidade de criar um documento quando a IA
encontrar lugares que possam registrar bugs, inconsistências ou problemas encontrados.

### Escopo desejado

- configuração do provedor, modelo e chave de API;
- leitura de entidades, páginas, relações, quadros e cenas conforme o escopo autorizado;
- identificação de inconsistências e geração de um documento de achados quando ainda não existir;
- referências aos registros analisados, para que cada achado possa ser conferido;
- histórico das análises e indicação de quando o conteúdo foi gerado;
- confirmação antes de qualquer alteração ou criação persistida.

### Decisões e bloqueios obrigatórios

“Acesso total” precisa ser definido tecnicamente: leitura de quais registros e assets, permissão de
escrita, exclusão ou apenas criação de documentos. A chave não pode ser gravada em `world.json`,
nem publicada no browser ou em logs. Também é necessário decidir quais dados podem sair do
computador, qual provedor será suportado, como tratar custos/limites e se a IA começa em modo
somente leitura.

Essa ideia exige revisão de privacidade e segurança antes da implementação, porque o aplicativo
atual é local e não possui autenticação, autorização ou integração remota.

## Relação com o trabalho atual

As lacunas já comprovadas na implementação continuam em
[work-items.md](work-items.md). Bugs confirmados devem ser registrados em
[bugs.md](bugs.md), separados de ideias e limitações de produto.
