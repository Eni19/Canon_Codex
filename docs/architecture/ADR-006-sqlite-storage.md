# ADR-006 · Persistência local em SQLite

## Contexto

O adaptador filesystem protege cada JSON com uma substituição atômica. Operações que afetam
vários documentos, como criar um Evento na Linha do Tempo ou substituir o Evento de origem,
precisam compensar falhas entre arquivos. O projeto também prevê indexação semântica do
conteúdo da wiki por mundo.

## Decisão

Adotar um banco SQLite local por biblioteca, atrás dos contratos de repositório. A versão da
estrutura SQL é independente dos schemas Zod dos documentos. O banco conserva UUIDs,
campos flexíveis em JSON e as imagens, originais e variantes, em BLOBs separados dos
metadados. Relações e aparições têm linhas próprias, sempre com escopo de mundo e ordem
preservada. A exclusão lógica guarda a data de remoção; referências a registros na lixeira
continuam disponíveis para as operações que as exigem.

A conexão usa `node:sqlite` com chaves estrangeiras e transações. Operações de gravação
compostas compartilham uma transação curta. O processamento de imagens ocorre antes de
abrir a transação. Aproveitamos o journal padrão do SQLite nesta entrega. O backup usa
a API de snapshot do SQLite.

A importação do formato anterior usa uma origem somente de leitura e uma etapa explícita de
validação. A ativação do banco depende dos testes de paridade e recuperação. A cópia integral
do banco é a unidade inicial de backup; exportação de um mundo em formato legado está fora
do escopo desta etapa.

## Preparação para indexação semântica

O artigo de origem consiste em metadados de um registro e suas páginas Tiptap com os IDs
preservados. A revisão inteira ascendente deve avançar com as mudanças de metadados e conteúdo.
O repositório SQLite deve enumerar artigos ativos por mundo com paginação por ID, entregando
metadados e conteúdo da mesma revisão.

A futura indexação derivada pode guardar trechos por mundo, registro, página e revisão, com
metadados de modelo, dimensão e configuração de extração. Mudar o modelo ou a extração pode
reconstruir o índice a partir do conteúdo canônico. A etapa de migração deixa a escolha do
modelo e do formato vetorial para a implementação da recuperação semântica.

## Estado

SQLite é o driver padrão. As rotas usam os repositórios SQLite e os comandos de prévia,
importação e backup estão disponíveis em `pnpm storage`. Para o procedimento de ativação e
restauração, veja [Armazenamento em SQLite](../data/sqlite.md).
