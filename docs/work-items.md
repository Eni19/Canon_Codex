# Trabalho em andamento e lacunas verificáveis

Última verificação: **23/09/2026**. Não há issue tracker acessível neste repositório; os itens
abaixo são somente lacunas que podem ser comprovadas por código/configuração, não um backlog
inventado.

| ID | Resultado esperado | Estado | Evidência | Próximo passo ou bloqueio | Última verificação |
| --- | --- | --- | --- | --- | --- |
| DOC-GAP-001 | Definir se o catálogo de tipos continuará híbrido ou voltará a ser totalmente genérico | aguardando decisão externa | `src/components/entities/entity-page.tsx` contém renderizadores específicos; `EntityTypeDefinition` continua dirigindo layouts genéricos | decisão de produto/arquitetura; registrar novo ADR se a regra mudar | 23/09/2026 |
| DOC-GAP-002 | Definir política de restauração e descarte permanente | não implementado | repositórios movem registros para `trash/`, mas não há ação/UI de restauração ou purge | especificar e implementar antes de prometer recuperação pela interface | 23/09/2026 |
| DOC-GAP-003 | Confirmar uso/licenciamento de `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` | não verificado | `src/components/boards/investigation-board.tsx` e `src/components/scenes/scene-runner.tsx` leem a variável; `.env.example` não a declara | confirmar necessidade e documentar valor seguro, sem publicar segredo | 23/09/2026 |
| DOC-GAP-004 | Definir política de operação fora de localhost | não suportado/verificado | não há autenticação, autorização, deploy ou monitoramento remoto no código/configuração | não expor a rede pública sem controle de acesso e procedimento operacional | 23/09/2026 |

Um item só deve ser marcado como concluído quando o comportamento estiver implementado e
verificado por código/teste ou quando a decisão externa estiver registrada em fonte acessível.

Ideias propostas de produto, que ainda não são lacunas confirmadas nem compromisso de
implementação, ficam em [ideas.md](ideas.md). Bugs reproduzidos ficam em [bugs.md](bugs.md).
