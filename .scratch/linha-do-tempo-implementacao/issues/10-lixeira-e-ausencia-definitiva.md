# 10: Preservar cartões na lixeira e limpar descarte definitivo

**What to build:** A linha informa quando um registro foi enviado à lixeira e elimina suas aparições somente quando ele não existe mais nem na lixeira.

**Blocked by:** 05: Criar uma linha com aparições na vista vertical.

**Status:** implemented

- [x] A consulta distingue registro ativo, em lixeira e ausente definitivamente por meio do repositório; erro de I/O não conta como ausência definitiva.
- [x] Na lixeira, o cartão retém título, nota e data próprios, exibe **Registro indisponível** e não oferece link quebrado como se o registro estivesse ativo.
- [x] Após descarte definitivo, todas as aparições do ID são removidas; o vínculo de Evento de origem é limpo sem apagar ano zero nem nome do marco.
- [x] A UI de descarte permanente não é introduzida por este ticket; testes simulam o ciclo completo em workspace sintético e verificam limpeza idempotente.
- [x] Documentação de dados e exclusão descreve estados implementados e limitações da UI atual.

**Evidência (14/10/2026):** `entityLifecycle.ts` valida inventários e documentos sob lock antes de
limpar referências em linhas ativas e na lixeira. `entityLifecycle.test.ts` cobre ciclo completo,
repetições, isolamento, origem preservada, metadados inválidos/incompletos, EACCES e retomada de
gravação interrompida. A UI existente já preserva apresentação e oculta links de registros na
lixeira; verificação visual manual não realizada neste ticket. A limpeza é atômica por arquivo,
idempotente, sem backup automático ou transação multi-arquivo. README, PROJECT, ADR-001 e guias
de dados, backup, arquitetura, contratos, entidades, linhas e testes foram atualizados.

**Validação:** TypeScript e ESLint dos arquivos alterados passaram. Suíte completa: 120 testes
passaram, 1 falhou em `taldoreiPack.test.ts:49` (49 relações no pacote, expectativa >100).
Essa asserção lê diretamente o pacote e não executa a reconciliação do TL-10. Os quatro testes
novos passaram. Os runners foram executados diretamente por Node, pois o wrapper pnpm tentou
reinstalar dependências e abortou por ausência de TTY.

**Correções da revisão (14/10/2026):** `getWorld` volta a consultar somente metadados, para que
linhas corrompidas não derrubem a busca global. `createOriginEvent` reconcilia sob lock antes
de verificar a unicidade, permitindo substituir uma origem definitivamente ausente sem visitar
outra tela. Dois testes de regressão reproduziram os erros e passaram após as correções.
Os pontos atuais de limpeza são leitura de linha/origem e criação de origem.
