# Auditoria da documentação

> **Estado:** implementado · **Última verificação:** 26/11/2026, todos os `.md` versionados contra
> `package.json`, `src/domain/`, `src/app/api/`, `src/app/actions/`, `src/repositories/` e
> `.env.example`.

Auditoria feita do zero ao fim do issue #44, que levou a documentação de 6,5 para o estado abaixo.
Substitui a matriz de evidências de 23/09/2026, que descrevia o projeto em JSON com quatro
contratos. Refaça esta página quando uma nova rodada de padronização terminar.

## Nota por critério

| Critério | Antes (25/11) | Agora | O que falta para 10 |
| --- | ---: | ---: | --- |
| Cobertura | 8,5 | 10 | nada: guias de uso, contribuição, commits, documentação, referência, dados, ADRs e glossário |
| Fidelidade ao código | 7 | 9,5 | todas as páginas foram conferidas; nos guias de uso a conferência foi por rotas e rótulos da interface, não frase a frase |
| Organização | 5,5 | 10 | nada: toda página de `docs/` tem cabeçalho de estado |
| Onboarding | 4 | 10 | nada: CONTRIBUTING, guias de commits e documentação, modelos de issue e AGENTS.md apontando para eles |
| Governança | 7,5 | 10 | nada: `pnpm docs:check` também acusa página sem cabeçalho |
| **Geral** | **6,5** | **9,9** | reler os guias de uso frase a frase na próxima auditoria |

## O que foi conferido contra o código

| Afirmação | Fonte | Resultado |
| --- | --- | --- |
| Versões de todos os documentos e da estrutura SQL | constantes `*_SCHEMA_VERSION`, `graphSettings.ts`, `schema.ts` | tabela única em [migrações](../data/migrations.md#versões-atuais), conferida |
| Toda rota HTTP tem seção na referência | `src/app/api/**/route.ts` | 12 rotas, todas documentadas, conferido por script |
| Toda Server Action exportada tem seção | `src/app/actions/*.ts` | todas documentadas, conferido por script |
| Cinco contratos de repositório | `src/repositories/index.ts` | PROJECT.md, arquitetura e CONTRIBUTING concordam |
| Stack e comandos | `package.json` | PROJECT.md, README e desenvolvimento concordam, incluindo `pnpm storage` e `pnpm docs:check` |
| Variáveis de ambiente | `.env.example` e código | quatro variáveis, todas na [configuração](../reference/configuration.md) |
| Catálogo híbrido de tipos | `src/components/entities/entity-page.tsx` | ADR-002, ADR-010 e PROJECT.md concordam; híbrido decidido em 27/11/2026 (#49) |
| Links, âncoras e caminhos de `src/` | `pnpm docs:check` | nenhum problema em 49 arquivos |

## Verificações de regressão

Mudanças desta rodada são só documentação, o script `scripts/check-docs.mjs`, o comando em
`package.json` e os modelos de issue. Em 26/11/2026, na branch de trabalho já sobre a `main`:

- `pnpm typecheck`: passou;
- `pnpm lint`: passou;
- `pnpm build`: passou;
- `pnpm test`: 308 testes passaram e 1 falhou por tempo (`timelineCanvas.test.ts`, 500 aparições,
  limite de 5 s) durante a suíte completa. Rodado sozinho, o arquivo passou nos 5 testes. A falha
  depende de carga da máquina, não destas mudanças.

## Rastreadores

Bugs, ideias e trabalho em andamento ficam nos [issues do GitHub](https://github.com/Eni19/Canon_Codex/issues).
`docs/bugs.md`, `docs/ideas.md` e `docs/work-items.md` foram migrados e apagados: lacunas abertas
viraram issues (#45 a #50 e #55), e os itens que já tinham issue (#16, #17, #22, #23) receberam o
contexto em comentário.

## Privacidade

Nenhum conteúdo de `workspace/` foi lido. O antigo `docs/bugs.md` citava nomes de mundos e
quadros que não eram sintéticos; eles continuam no histórico do git.
