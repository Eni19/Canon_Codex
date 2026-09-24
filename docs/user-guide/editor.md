# Editor e conteúdo

## Páginas e salvamento

O conteúdo fica separado dos metadados em `content.json`, no formato `tiptap-json`, com uma lista
`pages[]`. Cada página tem nome de até 40 caracteres e um corpo JSON Tiptap. Sempre existe ao menos
uma página.

Na edição de uma entidade:

1. escreva na página ativa;
2. use **Novo página** ou **Novo capítulo** quando o tipo permitir;
3. renomeie a página na linha de nome;
4. exclua a página ativa somente quando existir outra;
5. salve o formulário da entidade.

O limite visual é de duas páginas para a maioria dos tipos, uma para conceitos e 50 para contos.
Esses limites são da tela; o schema de conteúdo aceita de 1 a 50 páginas.

## Blocos e formatação

O editor compartilha extensões com o modo de leitura. Há negrito, itálico, headings 1–3, listas
com marcadores e numeradas, citações, divisores e links. O botão **Novo bloco de texto** cria um
parágrafo; o menu de cada bloco permite mover para cima/baixo ou excluir.

Digite `/` para abrir o menu de comandos:

- títulos 1, 2 e 3, parágrafo, listas e citação;
- callout de informação, aviso ou perigo;
- divisor horizontal;
- link para entidade;
- dado `d4`, `d6`, `d8`, `d10`, `d12` ou `d20`.

Digite `@` para buscar uma entidade e inserir um link interno. O nó armazena `entityId` e um rótulo
de exibição; a identidade não depende de título ou slug.

## Imagens

Na edição de uma entidade, o seletor de capa ou símbolo cosmológico envia a imagem para
POST /api/assets por meio das Server Actions de assets. Quadros também enviam imagens inseridas no
canvas pelo mesmo handler. O original do usuário permanece no local de origem durante a importação;
o Canon Codex trabalha com a cópia interna.

O Tiptap inclui a extensão Image e existe um helper de upload, mas a auditoria não encontrou um
comando do menu / ou outro consumidor atual que o conecte ao ContentEditor. Portanto, upload de
imagem inline dentro do corpo não é anunciado como recurso disponível nesta versão. O Route Handler
não declara limite de tamanho próprio; as ações de formulário do Next.js têm limite de corpo de
2 MB em next.config.ts.

## Limitações conhecidas

- O conteúdo Tiptap é opaco para `domain/`; buscas full-text no corpo não são implementadas.
- O formulário salva o documento inteiro junto com a entidade; não há autosave independente do
  botão **Salvar** para páginas de entidade.
- A migração de conteúdo legado v1 transforma `body` único em uma página `Principal`; detalhes de
  compatibilidade estão em [migrações](../data/migrations.md).
