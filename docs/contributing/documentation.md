# Como documentar o Canon Codex

> **Estado:** implementado · **Última verificação:** 26/11/2026, estrutura de `docs/` e regra do
> `AGENTS.md`.

Este guia é a regra única para escrever e manter a documentação. Vale para pessoas e para
agentes de IA. Se algo aqui contradiz outra página, este guia vence e a outra página deve ser
corrigida.

## Princípios

1. **O código é a fonte da verdade.** A documentação descreve o que o código faz hoje. Antes de
   afirmar um comportamento, confira o schema, a action, a rota ou o teste.
2. **Cada fato mora em um lugar.** Versões de schema, variáveis de ambiente e rotas têm uma
   página de referência; as outras páginas linkam para ela em vez de repetir.
3. **Estado explícito.** Todo texto deixa claro se descreve algo implementado, planejado ou não
   verificado.
4. **Documentação anda junto com o código.** A mudança que altera um contrato atualiza a página
   no mesmo PR (veja [Quando atualizar](#quando-atualizar)).
5. **Só dados sintéticos.** Nada de `workspace/` em exemplos, testes, capturas ou textos.

## Tipos de documento e onde cada um mora

| Tipo | Para que serve | Onde fica |
| --- | --- | --- |
| Porta de entrada | O que é o projeto, como instalar e por onde seguir | `README.md` |
| Contribuição | Setup, fluxo de trabalho, commits e esta regra | `CONTRIBUTING.md`, `docs/contributing/` |
| Memória arquitetural | Regras fixas e convenções que orientam mudanças | `PROJECT.md` |
| Glossário | Termos do domínio e o que evitar | `CONTEXT.md` |
| Guia de uso | Como fazer uma tarefa no app, passo a passo | `docs/user-guide/` |
| Referência | Contratos exatos: rotas, actions, configuração | `docs/reference/` |
| Dados | Esquemas, armazenamento, migrações, backup | `docs/data/` |
| Arquitetura | Camadas, fluxos e ADRs | `docs/architecture/` |
| Plano | Proposta com etapas para uma entrega grande | `docs/plans/` |
| Pesquisa | Levantamento de opções, licenças e referências | `docs/research/` |
| Perfil de desempenho | Medições com protocolo e ambiente | `docs/performance/` |

Trabalho em andamento, bugs e ideias ficam nos **issues do GitHub**, não em arquivos. Relatório
de uma execução fica na descrição do PR.

Na dúvida entre dois tipos, pergunte "quem lê isto e para fazer o quê?". Quem quer usar o app
lê guia; quem vai mudar código lê referência ou arquitetura.

## Cabeçalho padrão

Toda página em `docs/` (exceto o índice) começa com o título e um bloco de estado:

```markdown
# Título da página

> **Estado:** implementado · **Última verificação:** 26/11/2026, schemas em `src/domain/worlds/`.
```

Valores de **Estado**:

- **implementado**: descreve comportamento presente no código e conferido;
- **planejado**: descreve algo que ainda não existe (planos, propostas);
- **parcial**: parte implementada e parte planejada; as seções dizem qual é qual;
- **histórico**: registro de uma decisão ou medição passada que não deve ser atualizado (ADRs
  substituídos, perfis antigos).

**Última verificação** traz a data e *o que* foi conferido. Atualize quando revisar a página
contra o código, mesmo que o texto não mude.

## Implementado, planejado e não verificado no texto

Dentro de uma página, marque o que foge do estado geral:

- "**Planejado:** ..." para algo que ainda não existe;
- "**Não verificado:** ..." para algo que o código sugere mas ninguém conferiu (ex.: leitor de
  tela, dispositivo físico);
- link para o issue que acompanha o item, quando houver.

Não escreva intenção como fato. "O grafo suporta toque" só se alguém testou; senão, "o grafo
trata Pointer Events; **não verificado** em toque físico (#N)".

## Quando atualizar

| Se você mudou | Revise |
| --- | --- |
| Schema Zod ou versão de documento (`src/domain/`) | `docs/data/migrations.md`, `docs/data/sqlite.md`, guia de uso afetado |
| Schema SQL (`src/repositories/sqlite/schema.ts`) | `docs/data/sqlite.md`, `docs/data/backup-and-restore.md` |
| Rota em `src/app/api/` ou Server Action | `docs/reference/http-and-actions.md` |
| Variável de ambiente | `docs/reference/configuration.md` e `.env.example` |
| Script em `package.json` | `README.md`, `docs/contributing/development.md` |
| Dependência relevante (canvas, editor, banco) | `PROJECT.md` (stack) e, se for decisão, um ADR |
| Fluxo visível ao usuário | guia em `docs/user-guide/` |
| Termo do domínio novo ou renomeado | `CONTEXT.md` |
| Decisão de arquitetura | novo ADR em `docs/architecture/` |

Se nenhuma página precisar mudar, diga o motivo na descrição do PR ("só refatoração interna,
sem contrato novo"). Não presuma que mudança de contrato é neutra.

## ADRs

- Um arquivo por decisão: `docs/architecture/ADR-NNN-nome-curto.md`, numeração sequencial.
- Seções: **Estado atual em DD/MM/AAAA**, **Contexto**, **Decisão**, **Alternativas**,
  **Consequências**.
- Não reescreva a decisão original quando ela mudar: atualize o estado atual e, se a decisão
  for substituída, crie um ADR novo e linke os dois.

## Estilo

- Português, frases curtas, voz ativa. Termos do glossário em vez de sinônimos.
- Caminhos, comandos, variáveis e nomes de código entre crases: `` `src/app/api/` ``.
- Links relativos entre páginas (`../data/sqlite.md`), nunca URLs do GitHub para arquivos do
  repositório.
- Não copie schemas ou funções inteiras; descreva o essencial e linke o arquivo.
- Datas no formato DD/MM/AAAA. Evite "recentemente", "em breve" e "novo".
- Exemplos com nomes sintéticos (`Arquivo de Teste`, `Personagem Exemplo`) e caminhos genéricos
  (`C:\Dados\meus-codex`), nunca o caminho de uma máquina real.
- Tabelas para comparar e listas para passos; parágrafos longos são sinal de que a página mistura
  assuntos.

## Checklist do PR

Cole na descrição do PR e marque:

```markdown
- [ ] Páginas afetadas atualizadas (ou motivo de nenhuma mudar)
- [ ] Cabeçalho de estado e data de verificação atualizados nas páginas revisadas
- [ ] Planejado e não verificado marcados como tal
- [ ] Links e caminhos conferidos
- [ ] Nenhum dado de `workspace/`
```
