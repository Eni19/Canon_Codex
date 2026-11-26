'use client'

import { useEffect, useRef, useState } from 'react'
import { Circle, Eraser, Hand, ImagePlus, MousePointer2, MoveUpRight, Pencil, Slash, Square, StickyNote, Type } from 'lucide-react'
import { BOARD_COLORS, BOARD_SIZES, type BoardColor, type BoardSize, type GeoType } from '@/domain/boards/boardCanvas'
import { BOARD_PALETTE } from '@/domain/boards/boardStyles'
import type { BoardStyleState, BoardTool } from './board-stage'
import styles from './investigation-board.module.css'

type Choice = { key: string; label: string; kbd: string; icon: typeof MousePointer2; tool: BoardTool; geo?: GeoType; styled: boolean }
const CHOICES: Choice[] = [
  { key: 'select', label: 'Selecionar', kbd: 'V', icon: MousePointer2, tool: 'select', styled: false },
  { key: 'hand', label: 'Mão', kbd: 'H', icon: Hand, tool: 'hand', styled: false },
  { key: 'draw', label: 'Desenho', kbd: 'D', icon: Pencil, tool: 'draw', styled: true },
  { key: 'eraser', label: 'Borracha', kbd: 'E', icon: Eraser, tool: 'eraser', styled: false },
  { key: 'arrow', label: 'Seta', kbd: 'A', icon: MoveUpRight, tool: 'arrow', styled: true },
  { key: 'text', label: 'Texto', kbd: 'T', icon: Type, tool: 'text', styled: true },
  { key: 'note', label: 'Nota', kbd: 'N', icon: StickyNote, tool: 'note', styled: true },
  { key: 'rectangle', label: 'Quadrado', kbd: 'R', icon: Square, tool: 'geo', geo: 'rectangle', styled: true },
  { key: 'ellipse', label: 'Círculo', kbd: 'O', icon: Circle, tool: 'geo', geo: 'ellipse', styled: true },
  { key: 'line', label: 'Linha', kbd: 'L', icon: Slash, tool: 'line', styled: true },
]

const COLOR_LABELS: Record<BoardColor, string> = {
  black: 'Preto', grey: 'Cinza', 'light-violet': 'Lilás', violet: 'Violeta', blue: 'Azul', 'light-blue': 'Azul-claro', yellow: 'Amarelo', orange: 'Laranja',
  green: 'Verde', 'light-green': 'Verde-claro', 'light-red': 'Vermelho-claro', red: 'Vermelho', white: 'Branco',
}
const SIZE_LABELS: Record<BoardSize, string> = { s: 'Fino', m: 'Médio', l: 'Grosso', xl: 'Muito grosso' }
const SIZE_DOTS: Record<BoardSize, number> = { s: 4, m: 7, l: 10, xl: 14 }

/** Cores e espessura da ferramenta: abre acima do botão e fecha depois da escolha. */
function StyleMenu({ state, onColor, onSize }: { state: BoardStyleState; onColor: (color: BoardColor) => void; onSize: (size: BoardSize) => void }) {
  return (
    <div className={styles.styleMenu} role="group" aria-label="Estilo">
      <div className={styles.styleColors}>
        {BOARD_COLORS.map((color) => (
          <button key={color} data-active={state.color === color} aria-pressed={state.color === color} onClick={() => onColor(color)} title={COLOR_LABELS[color]} aria-label={COLOR_LABELS[color]}>
            <i style={{ background: BOARD_PALETTE[color].solid }} />
          </button>
        ))}
      </div>
      <div className={styles.styleSizes}>
        {BOARD_SIZES.map((size) => (
          <button key={size} data-active={state.size === size} aria-pressed={state.size === size} onClick={() => onSize(size)} title={SIZE_LABELS[size]} aria-label={SIZE_LABELS[size]}>
            <i style={{ width: SIZE_DOTS[size], height: SIZE_DOTS[size] }} />
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Barra de ferramentas. Ao escolher uma ferramenta de desenho, nota, texto, seta, forma ou linha
 * (ou clicar nela de novo), o menu de cor e espessura abre acima do botão; ele vale para os itens
 * selecionados e para os próximos.
 */
export function BoardToolbar({ tool, geoType, styleState, onTool, onGeo, onImage, onColor, onSize }: {
  tool: BoardTool; geoType: GeoType; styleState: BoardStyleState
  onTool: (tool: BoardTool) => void; onGeo: (geo: GeoType) => void; onImage: () => void
  onColor: (color: BoardColor) => void; onSize: (size: BoardSize) => void
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuFor) return
    const close = (event: Event) => { if (!(event.target instanceof Node && rootRef.current?.contains(event.target))) setMenuFor(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuFor(null) }
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', escape) }
  }, [menuFor])
  const choose = (choice: Choice) => {
    if (choice.geo) onGeo(choice.geo)
    else onTool(choice.tool)
    setMenuFor((open) => choice.styled && open !== choice.key ? choice.key : null)
  }
  return (
    <div ref={rootRef} className={styles.toolbar} role="toolbar" aria-label="Ferramentas">
      {CHOICES.map((choice) => {
        const { key, label, kbd, icon: Icon } = choice
        const active = choice.geo ? tool === 'geo' && geoType === choice.geo : tool === choice.tool
        return (
          <span key={key} className={styles.toolSlot}>
            <button data-active={active} aria-pressed={active} aria-expanded={choice.styled ? menuFor === key : undefined} onClick={() => choose(choice)} title={`${label} (${kbd})`} aria-label={label}><Icon /></button>
            {menuFor === key && <StyleMenu state={styleState} onColor={(color) => { onColor(color); setMenuFor(null) }} onSize={(size) => { onSize(size); setMenuFor(null) }} />}
          </span>
        )
      })}
      <button onClick={() => { setMenuFor(null); onImage() }} title="Imagem (Ctrl U)" aria-label="Inserir imagem"><ImagePlus /></button>
    </div>
  )
}
