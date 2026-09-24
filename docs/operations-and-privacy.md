# Operação, segurança e privacidade

## Limite operacional atual

Canon Codex é uma aplicação local single-user. A execução verificada é pnpm dev ou
pnpm build + pnpm start no computador que contém o workspace. Não há implantação remota,
staging, domínio, monitoramento, alerta, job de retenção ou rollback automatizado no repositório.

O servidor padrão deve ser tratado como local. Não exponha o processo em uma rede pública: não há
login, sessão de usuário, autorização por mundo, CSRF policy documentada, rate limiting ou
auditoria de acesso. O cookie canon-codex-world é HttpOnly e SameSite lax, mas somente escolhe o
ID do mundo.

## Dados e exposição

O workspace contém texto, relações, imagens, quadros, cenas e a lixeira. Ele está em
WIKI_WORKSPACE_DIR ou em workspace/ e é ignorado pelo Git. O processo lê e grava esses dados
localmente; não há cliente de banco remoto, storage externo ou sincronização implementados.

Assets são servidos por Route Handler e o browser recebe cache immutable. O handler consulta o mundo
selecionado pelo cookie, mas isso não constitui autenticação. Qualquer pessoa com acesso ao
processo/host deve ser considerada capaz de acessar os dados disponíveis naquele contexto.

## Uploads

Os uploads aceitam os MIME definidos em src/domain/assets/mimeType.ts. O arquivo é copiado para o
workspace e nunca depende do path de origem depois da importação. sharp tenta descobrir dimensões e
gerar thumbnail de até 480 px; se falhar, a importação pode continuar sem thumbnail.

O limite de corpo de 2mb configurado em next.config.ts se aplica a Server Actions. O Route Handler
POST /api/assets não define limite próprio no código; monitore tamanho e espaço em disco no uso
local. Não há antivírus, política de retenção, criptografia em repouso ou remoção segura
implementada.

## Logs e incidentes

Não há logger de aplicação ou diretório de auditoria verificado. Mensagens do Next.js e exceções
aparecem na saída do processo; arquivos de log locais são ignorados por .gitignore quando criados
por ferramentas. Em caso de erro:

1. pare gravações e preserve uma cópia do workspace;
2. não apague trash/;
3. copie o workspace para um diretório novo;
4. defina WIKI_WORKSPACE_DIR para a cópia e valide com os testes/leituras apropriados;
5. registre o erro sem anexar dados privados.

Não há procedimento de recuperação automática; siga [backup e restauração](data/backup-and-restore.md).

## Privacidade

- mantenha .env.local e o workspace fora de commits e compartilhamentos;
- use dados sintéticos ao reproduzir bugs e escrever testes;
- revise caminhos absolutos, nomes, imagens e payloads antes de abrir uma issue ou enviar um log;
- não trate renomear, mover para trash ou remover uma referência como apagamento seguro;
- uma futura publicação ou hospedagem precisa primeiro implementar identidade, autorização,
  controle de assets, logs de acesso, backup e política de exclusão, além de revisar ADR-003.
