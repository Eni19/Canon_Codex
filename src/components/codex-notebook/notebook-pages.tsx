'use client'

import Link from 'next/link'
import { cloneElement, type ReactElement, type ReactNode } from 'react'
import { formatRecordCount, pageNumbers, seededRandom, type NotebookRecord, type Spread } from './notebook-contents'
import {
  CutoutTitle, HandLink, Handwriting, Paperclip, Polaroid, Postmark, StarSticker, StickyFlags, Tape,
  Ticket, TornNote, TypeLabel, type TapeColor,
} from './scraps'
import styles from './notebook.module.css'

/** Everything the pages need to know about the world. */
export interface NotebookWorld {
  name: string
  description?: string
  recordCount: number
  createdYear: string
  recent: (NotebookRecord & { typeId: string; typeLabel: string; href: string })[]
}

export interface SpreadPages {
  left: ReactNode
  right: ReactNode
}

/** Types whose pictures are full figures: their polaroids show the whole picture instead of cropping it. */
const WHOLE_FIGURE_TYPES = new Set(['character', 'creature'])

const thumbnail = (record: NotebookRecord) => record.coverAssetId ? `/api/assets/${record.coverAssetId}/thumbnail` : undefined

/** A notebook sheet: paper, ruling, the gutter shadow and the page number. */
interface PageArrow {
  dir: 'prev' | 'next'
  label: string
  onClick: () => void
}

interface SheetProps {
  side: 'left' | 'right'
  paper?: 'grid' | 'lined' | 'plain'
  number?: number
  /** Hand-drawn arrow in the bottom corner that turns the page. */
  arrow?: PageArrow
  children: ReactNode
}

/** A notebook sheet: paper, ruling, the gutter shadow, the page number and the turning arrow. */
export function Sheet({ side, paper = 'grid', number, arrow, children }: SheetProps) {
  return <div className={styles.sheet} data-side={side} data-paper={paper}>
    {children}
    {number !== undefined && <span className={styles.pageNumber}>{number}</span>}
    {arrow && <button type="button" className={styles.pageArrow} data-dir={arrow.dir} onClick={arrow.onClick} aria-label={arrow.dir === 'next' ? 'Próxima página' : 'Página anterior'}>
      {arrow.dir === 'prev' && <ArrowMark/>}
      <span>{arrow.label}</span>
      {arrow.dir === 'next' && <ArrowMark/>}
    </button>}
  </div>
}

function ArrowMark() {
  return <svg aria-hidden viewBox="0 0 90 60">
    <path d="M4 40 C 26 46, 52 40, 74 22" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/>
    <path d="M60 22 L 75 20 L 74 36" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}

/**
 * The index card. Closed, it lies on the cover; as the notebook opens it is pulled out onto the desk
 * beside the book, where each line opens its spread.
 */
export function IndexCard({ spreads, current, onOpen }: { spreads: Spread[]; current: number; onOpen: (index: number) => void }) {
  return <div className={styles.indexCard}>
    <span aria-hidden className={styles.indexTape}/>
    <p className={styles.coverIndexTitle}>Índice</p>
    <ol>
      {spreads.map((spread, index) => <li key={spread.id}>
        <button type="button" onClick={() => onOpen(index)} aria-current={index === current ? 'page' : undefined} data-current={index === current || undefined}>
          <span>{spread.tab}</span>
          <i aria-hidden/>
          <small>{pageNumbers(index)[0]}</small>
        </button>
      </li>)}
    </ol>
  </div>
}

export function renderSpread(spread: Spread, index: number, world: NotebookWorld, spreads: Spread[], onTurnTo: (index: number) => void): SpreadPages {
  const [leftNumber, rightNumber] = pageNumbers(index)
  const pages = spread.kind === 'preface' ? prefacePages(world, spreads, leftNumber, rightNumber, onTurnTo)
    : spread.kind === 'tools' ? toolsPages(leftNumber, rightNumber)
    : typePages(spread, leftNumber, rightNumber, spreads.length)
  // Every spread gets its turning arrows: back on the left (closing the book from the first page),
  // forward on the right (except on the last spread).
  const back: PageArrow = { dir: 'prev', label: index === 0 ? 'fechar' : 'voltar', onClick: () => onTurnTo(index - 1) }
  const forward: PageArrow = { dir: 'next', label: 'continue', onClick: () => onTurnTo(index + 1) }
  return {
    left: cloneElement(pages.left as ReactElement<SheetProps>, { arrow: back }),
    right: index < spreads.length - 1 ? cloneElement(pages.right as ReactElement<SheetProps>, { arrow: forward }) : pages.right,
  }
}

function prefacePages(world: NotebookWorld, spreads: Spread[], leftNumber: number, rightNumber: number, onTurnTo: (index: number) => void): SpreadPages {
  const latest = world.recent[0]
  // The busiest parts of the archive, as a tally on a scrap of grid paper; each line opens its spread.
  const tally = spreads
    .map((spread, index) => ({ spread, index }))
    .filter((entry): entry is { spread: Extract<Spread, { kind: 'type' }>; index: number } => entry.spread.kind === 'type')
    .sort((a, b) => b.spread.type.count - a.spread.type.count)
    .slice(0, 4)
  return {
    left: <Sheet side="left" paper="lined" number={leftNumber}>
      <Ticket x={86} y={44} r={-4} w={250} serial={world.createdYear} title="Admissão" lines={[world.name, formatRecordCount(world.recordCount)]}/>
      <Tape x={118} y={36} r={-14} length={70} color="blue"/>
      <Postmark x={430} y={40} r={12} w={118} text="ARQUIVO · CANON · CODEX ·" center={world.createdYear}/>
      <Handwriting x={74} y={210} size={34}>Querido arquivo,</Handwriting>
      <Handwriting x={96} y={262} w={420} size={25}>
        {world.description || 'Aqui começa um mundo. Cada página guarda uma parte dele: quem vive nele, onde as coisas acontecem e o que ainda está por ser escrito.'}
      </Handwriting>
      <TornNote x={300} y={420} r={3} w={250} paper="grid">
        <p className={styles.tallyTitle}>Neste arquivo</p>
        <ul className={styles.tally}>{tally.map(({ spread, index }) => <li key={spread.id}>
          <button type="button" onClick={() => onTurnTo(index)}><span>{spread.type.pluralLabel}</span><b>{spread.type.count}</b></button>
        </li>)}</ul>
      </TornNote>
      <Tape x={380} y={410} r={-8} length={80} color="green"/>
      <Handwriting x={84} y={460} w={190} size={24} tone="soft" r={-2}>
        Vire as páginas ou use as abas para ir direto a uma parte do mundo.
      </Handwriting>
      <Handwriting x={300} y={680} size={28} r={-3}>— {world.name}</Handwriting>
      <StarSticker x={70} y={700} r={-10} tone="red"/>
    </Sheet>,
    right: <Sheet side="right" paper="grid" number={rightNumber}>
      {latest
        ? <>
          <Polaroid x={70} y={54} r={-3} w={260} src={thumbnail(latest)} caption={latest.title} date={latest.typeLabel} href={latest.href} whole={WHOLE_FIGURE_TYPES.has(latest.typeId)}/>
          <Tape x={150} y={40} r={4} length={100}/>
        </>
        : <TornNote x={70} y={70} r={-3} w={260} paper="yellow"><p className={styles.noteText}>O primeiro registro vai aparecer aqui.</p></TornNote>}
      <StickyFlags x={540} y={90}/>
      <TypeLabel x={360} y={80} r={5} dark>Últimos registros</TypeLabel>
      <TornNote x={330} y={130} r={2} w={230} paper="lined">
        {world.recent.length > 0
          ? <ol className={styles.noteList}>{world.recent.slice(0, 6).map((record) => <li key={record.id}><Link href={record.href}>{record.title}</Link></li>)}</ol>
          : <p className={styles.noteText}>Nada por aqui ainda.</p>}
      </TornNote>
      <Paperclip x={512} y={110} r={8}/>
    </Sheet>,
  }
}

const TYPE_HINTS: Record<string, string> = {
  character: 'Rostos, nomes e histórias de quem habita este mundo.',
  location: 'Regiões, cidades e cantos esquecidos do mapa.',
  organization: 'Ordens, casas, guildas e quem as comanda.',
  creature: 'Espécimes, feras e o que se esconde no escuro.',
  species: 'Povos e linhagens, seus costumes e origens.',
  artifact: 'Objetos raros, relíquias e o que eles fazem.',
  cosmology: 'Planos, astros e a ordem por trás de tudo.',
  naturalScience: 'Ervas, remédios e o estudo da natureza.',
  event: 'O que aconteceu, quando e com quem.',
  tale: 'Contos, lendas e narrativas soltas.',
}

const TAPES: TapeColor[] = ['cream', 'blue', 'rose', 'green']

function typePages(spread: Extract<Spread, { kind: 'type' }>, leftNumber: number, rightNumber: number, total: number): SpreadPages {
  const { type } = spread
  const next = seededRandom(type.id)
  const tilt = (range: number) => (next() - 0.5) * range
  const href = `/${type.id}`
  const slots = [
    { x: 54, y: 60 }, { x: 318, y: 92 }, { x: 70, y: 400 }, { x: 330, y: 432 },
  ]
  return {
    left: <Sheet side="left" paper={leftNumber % 4 === 1 ? 'lined' : 'grid'} number={leftNumber}>
      <TypeLabel x={70} y={50} r={-2}>{String(Math.ceil(leftNumber / 2)).padStart(2, '0')} / {String(total).padStart(2, '0')}</TypeLabel>
      <CutoutTitle x={64} y={104} r={tilt(4)} w={480} text={type.pluralLabel} seed={type.id} size={type.pluralLabel.length > 12 ? 38 : 48}/>
      <Handwriting x={84} y={300} w={400} size={27}>{TYPE_HINTS[type.id] ?? `Tudo o que este mundo guarda em ${type.pluralLabel.toLowerCase()}.`}</Handwriting>
      <Postmark x={400} y={430} r={tilt(30)} w={120} text={`${type.label.toUpperCase()} · ARQUIVO ·`} center={String(type.count)}/>
      <TornNote x={88} y={470} r={tilt(6)} w={250} paper="yellow">
        <p className={styles.noteText}>{formatRecordCount(type.count)} neste arquivo.</p>
      </TornNote>
      <Tape x={150} y={458} r={tilt(16)} length={80} color={TAPES[Math.floor(next() * TAPES.length)]}/>
      <HandLink x={96} y={630} r={-2} href={href} size={30} revealTitle={type.pluralLabel}>ver todos →</HandLink>
      <HandLink x={300} y={690} r={2} href={`${href}/new`} size={26}>+ novo registro</HandLink>
      <StarSticker x={500} y={640} r={tilt(40)} tone={next() > 0.5 ? 'brass' : 'red'}/>
    </Sheet>,
    right: <Sheet side="right" paper={rightNumber % 4 === 0 ? 'grid' : 'plain'} number={rightNumber}>
      {type.recent.length > 0
        ? type.recent.slice(0, 4).map((record, index) => {
          const slot = slots[index]
          const angle = tilt(10)
          return <div key={record.id}>
            <Polaroid x={slot.x} y={slot.y} r={angle} w={215} src={thumbnail(record)} caption={record.title} href={`/entity/${record.id}`} icon={type.icon} whole={WHOLE_FIGURE_TYPES.has(type.id)}/>
            <Tape x={slot.x + 60 + tilt(30)} y={slot.y - 12} r={angle + tilt(20)} length={86} color={TAPES[(index + Math.floor(next() * 4)) % 4]}/>
          </div>
        })
        : <>
          <TornNote x={90} y={180} r={-3} w={380} paper="grid">
            <p className={styles.noteText}>Ainda não há {type.pluralLabel.toLowerCase()} neste mundo.</p>
          </TornNote>
          <HandLink x={140} y={420} r={-3} href={`${href}/new`} size={32}>começar o primeiro →</HandLink>
        </>}
      {type.recent.length > 4 && <Handwriting x={380} y={740} size={24} tone="soft">e mais {type.count - 4}…</Handwriting>}
    </Sheet>,
  }
}

const TOOLS = [
  { href: '/calendar', title: 'Calendário', line: 'datas, luas e estações' },
  { href: '/relationships', title: 'Relacionamentos', line: 'quem se liga a quem' },
  { href: '/boards', title: 'Quadros', line: 'investigações e pistas' },
  { href: '/scenes', title: 'Cenas', line: 'preparar e conduzir sessões' },
  { href: '/soundtrack', title: 'Trilha sonora', line: 'músicas e ambiências' },
  { href: '/all', title: 'Todos os conteúdos', line: 'o índice completo' },
]

function toolsPages(leftNumber: number, rightNumber: number): SpreadPages {
  return {
    left: <Sheet side="left" paper="lined" number={leftNumber}>
      <CutoutTitle x={70} y={70} r={-2} w={460} text="Ferramentas" seed="tools" size={46}/>
      <Handwriting x={84} y={190} w={420} size={27}>O que fica sempre à mão, em qualquer sessão.</Handwriting>
      {TOOLS.slice(0, 3).map((tool, index) => <Ticket
        key={tool.href}
        x={84 + (index % 2) * 40}
        y={290 + index * 150}
        r={(index % 2 ? 1 : -1) * 3}
        w={330}
        serial={String(index + 1).padStart(3, '0')}
        title={tool.title}
        lines={[tool.line]}
        href={tool.href}
      />)}
    </Sheet>,
    right: <Sheet side="right" paper="grid" number={rightNumber}>
      {TOOLS.slice(3).map((tool, index) => <Ticket
        key={tool.href}
        x={110 + (index % 2) * 50}
        y={110 + index * 170}
        r={(index % 2 ? -1 : 1) * 4}
        w={330}
        serial={String(index + 4).padStart(3, '0')}
        title={tool.title}
        lines={[tool.line]}
        href={tool.href}
      />)}
      <Paperclip x={420} y={88} r={-6}/>
      <StarSticker x={470} y={650} r={14} tone="brass"/>
      <Handwriting x={90} y={690} size={26} tone="soft" r={-2}>fim do caderno — por enquanto.</Handwriting>
    </Sheet>,
  }
}
