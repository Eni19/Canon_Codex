# Configuração e ambientes

## Variáveis suportadas

As variáveis documentadas em .env.example são lidas no servidor:

| Variável | Padrão | Valores/efeito |
| --- | --- | --- |
| WIKI_WORKSPACE_DIR | <raiz do projeto>/workspace | caminho absoluto recomendado para os dados locais; o código também aceita o valor informado pelo ambiente |
| PERSISTENCE_DRIVER | filesystem | somente filesystem; qualquer outro valor faz a factory lançar Unknown PERSISTENCE_DRIVER |

Exemplo seguro:

    WIKI_WORKSPACE_DIR=C:\Dados\canon-codex
    PERSISTENCE_DRIVER=filesystem

Use .env.local, que é ignorado pelo Git. Não coloque conteúdo de usuário, tokens ou chaves reais
em .env.example, README, testes ou commits.

## Variáveis referenciadas mas não declaradas

Os componentes tldraw leem NEXT_PUBLIC_TLDRAW_LICENSE_KEY, mas a variável não está em
.env.example e o código não documenta se ela é necessária para a versão instalada. O valor não é
reproduzido aqui; confirmar essa necessidade é o item DOC-GAP-003 em
[work-items.md](../work-items.md).

## Desenvolvimento e produção local

Em desenvolvimento, execute pnpm dev; o processo usa o workspace configurado e o servidor local
do Next.js. Para uma execução de produção, construa primeiro com pnpm build e depois execute
pnpm start. Não há configuração de staging, deploy, domínio, banco ou storage externo verificada.

O next.config.ts configura:

- limite de corpo de 2mb para Server Actions;
- imagens Next sem otimização (unoptimized: true) porque o optimizer não encaminha o cookie do
  mundo ativo aos assets locais;
- qualidades 75 e 90 para a configuração de imagens.

O limite de 2mb não deve ser atribuído automaticamente a POST /api/assets, que é um Route
Handler separado e não define limite próprio. Os formatos suportados de imagem estão em
src/domain/assets/mimeType.ts.

## Seleção de mundo

O cookie canon-codex-world é HttpOnly, SameSite lax, escopo / e duração de um ano. Ele seleciona
o mundo para páginas, Server Actions e Route Handlers. Não é uma sessão autenticada e não deve ser
tratado como autorização.
