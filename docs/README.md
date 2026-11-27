# Documentação do Canon Codex

> **Estado:** implementado · **Última verificação:** 26/11/2026, todos os arquivos `.md` de `docs/`.

Índice de todas as páginas, por pasta. Onde cada tipo de documento mora e como escrever um novo
está em [Como documentar](contributing/documentation.md). Trabalho em andamento, bugs e ideias
ficam nos [issues do GitHub](https://github.com/Eni19/Canon_Codex/issues).

## Usar o app: `user-guide/`

- [Guia de uso](user-guide/index.md): fluxo recomendado e atalhos de navegação.
- [Mundos e biblioteca](user-guide/worlds.md): criar, importar, arquivar e configurar o calendário.
- [Registros, tipos e vínculos](user-guide/entities.md): fichas, referências e canvas de relacionamentos.
- [Editor e conteúdo](user-guide/editor.md): páginas, blocos, imagens e links internos.
- [Linhas do Tempo](user-guide/timelines.md): aparições, filtros e mapa espacial.
- [Quadros, cenas e projeção](user-guide/boards-scenes-and-projection.md).
- [Trilha sonora](user-guide/soundtrack.md): playlists do YouTube na projeção.
- [Validar com uma campanha real](user-guide/campaign-validation.md): roteiro do fluxo do mestre.

## Contribuir: `contributing/`

- [Como documentar](contributing/documentation.md): tipos de documento, cabeçalho e quando atualizar.
- [Commits e branches](contributing/commits.md): formato, tamanho e rebase.
- [Desenvolvimento](contributing/development.md): comandos e organização do trabalho por camada.
- [Testes e qualidade](contributing/testing.md): o que a suíte cobre e as verificações registradas.
- [Auditoria documental](contributing/documentation-audit.md): nota por critério e o que foi conferido.

O ponto de partida para quem chega é o [CONTRIBUTING](../CONTRIBUTING.md) na raiz.

## Contratos: `reference/`

- [Rotas HTTP e Server Actions](reference/http-and-actions.md).
- [Configuração e ambientes](reference/configuration.md): variáveis e `next.config.ts`.
- [Operação, segurança e privacidade](reference/operations-and-privacy.md).

## Dados: `data/`

- [SQLite](data/sqlite.md): configuração, importação e backup do banco padrão.
- [Migrações e compatibilidade](data/migrations.md): versões atuais e passos de migração.
- [Armazenamento e modelo de dados](data/storage.md): árvore do driver legado e invariantes.
- [Backup, restauração, importação e descarte](data/backup-and-restore.md).

## Arquitetura: `architecture/`

- [Visão de arquitetura](architecture/overview.md): camadas, fluxos e limites.
- [ADR-001](architecture/ADR-001-local-first-storage.md): armazenamento local atrás de repositórios.
- [ADR-002](architecture/ADR-002-entity-model.md): entidade genérica e tipos configuráveis.
- [ADR-003](architecture/ADR-003-asset-identifiers.md): assets por ID opaco.
- [ADR-004](architecture/ADR-004-editor.md): Tiptap atrás de um `ContentDocument` versionado.
- [ADR-005](architecture/ADR-005-design-system.md): tokens semânticos e tema editorial.
- [ADR-006](architecture/ADR-006-sqlite-storage.md): persistência em SQLite.
- [ADR-007](architecture/ADR-007-konva-canvas.md): canvas próprio em Konva no lugar do tldraw.
- [ADR-008](architecture/ADR-008-codex-notebook-home.md): o início do mundo como caderno do Codex.
- [ADR-009](architecture/ADR-009-trash-retention.md): lixeira com prazo de 7 dias até a exclusão definitiva.
- [ADR-010](architecture/ADR-010-hybrid-entity-pages.md): páginas próprias por tipo sobre o compositor genérico.
- [ADR-011](architecture/ADR-011-entity-type-visuals.md): forma e textura próprias por tipo de registro no grafo e nos Quadros.

## Planos: `plans/`

- [Calendário visual](plans/calendar-visual-plan.md).
- [Grafo de relacionamentos e novos canvas](plans/relationship-graph-plan.md).

## Pesquisas: `research/`

- [Calendários visuais de campanha](research/calendar-visual.md).
- [Canvas de relacionamentos: interface e desempenho](research/relationship-canvas-ux-performance.md).
- [Linha do Tempo: navegação espacial](research/timeline-cosmic-canvas.md).
- [Linha do Tempo: apresentação e movimento](research/timeline-visual-motion.md).
- [Licença do tldraw](research/tldraw-license.md).

## Desempenho: `performance/`

Cada perfil traz protocolo, ambiente e dados sintéticos; os arquivos `.json` e as imagens são as
evidências brutas citadas por eles.

- [Grafo de relacionamentos](performance/relationship-graph.md).
- [Quadro de investigação](performance/board.md).
- [Busca geral](performance/search-latency.md): tempo de resposta da paleta (Ctrl+K).
- [Calendário em produção](performance/calendar-production.md) e
  [referência inicial de metadados](performance/calendar-metadata-baseline.md).
- [Linha do Tempo: mapa espacial](performance/timeline-cosmic-canvas.md).
- Históricos da interface anterior da Linha do Tempo: [500 aparições (TL-11)](performance/timeline-500.md)
  e [movimento (TL-12)](performance/timeline-motion-tl12.md).
