# 12: Refinar o visual e o movimento da Linha do Tempo

> Histórico: em 15/10/2026, o pedido de Cosmic Canvas substituiu o eixo/paginação desta entrega.
> Interface atual: [guia](../../../docs/user-guide/timelines.md) e
> [perfil](../../../docs/performance/timeline-cosmic-canvas.md).

**What to build:** As vistas vertical e horizontal ganham apresentação editorial consistente e transições fluidas que ajudam a acompanhar cartões, períodos e mudanças de estado.

**Blocked by:** 11: Navegar com centenas de aparições em ambas as vistas. Este é o último ticket da sequência de Linhas do Tempo.

**Status:** implementado e verificado em 14/10/2026. Evidências e limites no [perfil TL-12](../../../docs/performance/timeline-motion-tl12.md); [referências primárias](../../../docs/research/timeline-visual-motion.md).

- [x] Refinar hierarquia visual, espaçamento, tipografia, eixo, marcas de período, cartões, capas e estados vazios nas duas vistas, usando os tokens e padrões visuais existentes do Canon Codex. Desktop e celular devem continuar legíveis, sem cortes nem sobreposição.
- [x] Animar de forma breve e coerente a entrada/saída de cartões, expansão ou seleção, troca de escala, filtros e alternância entre vistas. O movimento deve ajudar a pessoa a perceber o que mudou, sem ocultar informações ou dificultar ações rápidas.
- [x] Preservar foco, posição de navegação e contexto do cartão selecionado durante transições; ações por teclado, toque, arraste e botões devem continuar equivalentes. Respeitar `prefers-reduced-motion` com transições discretas ou instantâneas.
- [x] Evitar saltos de layout, rolagem inesperada e animação de centenas de cartões ao mesmo tempo. Medir a fluidez no cenário sintético de pelo menos 500 aparições do ticket 11 e registrar ambiente, resultado e ajustes feitos.
- [x] Verificar visualmente as vistas e estados principais em desktop e celular, inclusive linha vazia, **Sem data**, registro indisponível, filtros sem resultados e cartões próximos. A suíte relevante, lint e verificação de tipos passam; atualizar o guia com o comportamento entregue e limites conhecidos.

O refinamento é de apresentação e interação: não muda datas, ordem persistida, identidade das aparições nem regras de inclusão e remoção.
