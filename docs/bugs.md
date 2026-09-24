# Registro de bugs

Este é o local do repositório para registrar bugs encontrados durante desenvolvimento, testes ou
uso manual. Um bug é um comportamento implementado que contradiz o esperado; uma funcionalidade
que ainda não existe deve ser registrada em [ideas.md](ideas.md) ou
[work-items.md](work-items.md), conforme o caso.

Não copie dados reais de `workspace/`, chaves de API, imagens privadas ou conteúdo de usuário para
este arquivo. Use nomes sintéticos e anexos sanitizados.

## Onde registrar

- **Bug confirmado no código:** adicionar uma entrada na tabela abaixo e, quando necessário, criar
  uma seção detalhada com reprodução mínima.
- **Limitação conhecida ou lacuna de implementação:** usar
  [work-items.md](work-items.md).
- **Ideia ou melhoria ainda não especificada:** usar [ideas.md](ideas.md).
- **Issue externa:** não há issue tracker conectado verificado neste repositório. Quando houver
  um tracker oficial, registrar aqui o ID/link externo sem duplicar a descrição inteira.

## Estados

- `novo`: ainda não foi investigado;
- `reproduzido`: a falha foi confirmada com passos definidos;
- `em correção`: existe uma alteração em andamento;
- `verificado`: a correção foi testada;
- `não reproduzido`: não foi possível confirmar com as evidências disponíveis;
- `adiado`: existe, mas depende de decisão ou prioridade externa.

## Registro

| ID | Área | Resumo | Estado | Severidade | Evidência/próximo passo | Última verificação |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | Nenhum bug confirmado registrado ainda. | — | — | Adicionar uma entrada quando houver reprodução ou evidência verificável. | 23/09/2026 |

## Modelo de entrada

Copie este modelo para cada bug confirmado:

```markdown
### BUG-AAAA-MM-DD-NN — Título curto

- **Estado:** novo
- **Severidade:** baixa | média | alta | crítica
- **Área:** rota, componente, domínio, persistência, migração ou operação
- **Ambiente:** commit/branch, sistema operacional, navegador e comando usado
- **Pré-condições:** dados sintéticos e configuração necessária
- **Passos para reproduzir:**
  1. ...
  2. ...
- **Resultado esperado:** ...
- **Resultado observado:** ...
- **Evidência:** teste, log sanitizado, screenshot ou caminho do código
- **Impacto:** ...
- **Próximo passo:** ...
- **Última verificação:** AAAA-MM-DD
```

Ao corrigir um bug, atualize o estado, registre o teste realizado e verifique se README, guias,
contratos ou instruções de operação precisam ser ajustados.
