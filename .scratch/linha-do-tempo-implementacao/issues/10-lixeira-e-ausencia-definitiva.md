# 10: Preservar cartões na lixeira e limpar descarte definitivo

**What to build:** A linha informa quando um registro foi enviado à lixeira e elimina suas aparições somente quando ele não existe mais nem na lixeira.

**Blocked by:** 05: Criar uma linha com aparições na vista vertical.

**Status:** ready-for-agent

- [ ] A consulta distingue registro ativo, em lixeira e ausente definitivamente por meio do repositório; erro de I/O não conta como ausência definitiva.
- [ ] Na lixeira, o cartão retém título, nota e data próprios, exibe **Registro indisponível** e não oferece link quebrado como se o registro estivesse ativo.
- [ ] Após descarte definitivo, todas as aparições do ID são removidas; o vínculo de Evento de origem é limpo sem apagar ano zero nem nome do marco.
- [ ] A UI de descarte permanente não é introduzida por este ticket; testes simulam o ciclo completo em workspace sintético e verificam limpeza idempotente.
- [ ] Documentação de dados e exclusão descreve estados implementados e limitações da UI atual.
