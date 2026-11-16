import { z } from 'zod'

export const GraphStyleSchema = z.object({
  type: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  stroke: z.enum(['solid', 'dashed', 'dotted']),
  tip: z.enum(['triangle', 'diamond', 'circle']),
  symbol: z.enum(['none', 'circle', 'square', 'diamond']),
  meaning: z.string().max(300),
  hidden: z.boolean(),
}).strict()
export type GraphStyle = z.infer<typeof GraphStyleSchema>
export const styleSignature = (style: GraphStyle) => `${style.stroke}/${style.tip}/${style.symbol}`
export const GraphStylesSchema = z.array(GraphStyleSchema).superRefine((styles, context) => {
  const types = new Set<string>(); const signatures = new Set<string>()
  styles.forEach((style, index) => {
    if (types.has(style.type)) context.addIssue({ code: 'custom', path: [index, 'type'], message: 'Tipo repetido.' })
    types.add(style.type)
    const signature = styleSignature(style)
    if (signatures.has(signature)) context.addIssue({ code: 'custom', path: [index], message: 'Altere o traço, a ponta ou o símbolo para diferenciar os tipos.' })
    signatures.add(signature)
  })
})

const colors = ['#a64b39', '#315f9a', '#547942', '#925f9d', '#a06b22', '#187b78']
const strokes: GraphStyle['stroke'][] = ['solid', 'dashed', 'dotted']
const tips: GraphStyle['tip'][] = ['triangle', 'diamond', 'circle']
const symbols: GraphStyle['symbol'][] = ['none', 'circle', 'square', 'diamond']

/** Preserve saved choices; assign remaining distinct shapes in stable type order. */
export function buildGraphCatalog(types: string[], saved: GraphStyle[]): GraphStyle[] {
  const result = [...saved]
  const used = new Set(saved.map(styleSignature))
  for (const type of [...new Set(types)].sort()) {
    if (result.some((item) => item.type === type)) continue
    const options = strokes.flatMap((stroke) => tips.flatMap((tip) => symbols.map((symbol) => ({ stroke, tip, symbol }))))
    const option = options.find((item) => !used.has(`${item.stroke}/${item.tip}/${item.symbol}`)) ?? options[result.length % options.length]
    const style = { type, ...option, color: colors[result.length % colors.length], meaning: '', hidden: false }
    result.push(style); used.add(styleSignature(style))
  }
  return result
}

export const strokeDash = (stroke: GraphStyle['stroke']) => stroke === 'dashed' ? [10, 6] : stroke === 'dotted' ? [2, 5] : []
