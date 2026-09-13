import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen, Info, Pencil } from 'lucide-react'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { RelationsPanel } from '@/components/entities/relations-panel'
import type { EntityPageProps } from '@/components/entities/entity-page'
import { ConceptBlocksSchema, type ConceptBlock, type ConceptBlockType } from '@/domain/entities/conceptBlock'
import type { ContentDocument } from '@/domain/content/contentDocument'
import styles from './concept-entity-page.module.css'

const BLOCK_LABELS: Record<ConceptBlockType, string> = {
  overview: 'Visão geral',
  operation: 'Funcionamento',
  structure: 'Estrutura / componentes',
  rules: 'Regras',
  examples: 'Exemplos',
  limitations: 'Limitações',
  terminology: 'Terminologia',
  diagram: 'Diagrama',
  notes: 'Observações',
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function lines(value: string) {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
}

function Paragraphs({ body }: { body: string }) {
  return <div className={styles.paragraphs}>{body.split(/\r?\n\s*\r?\n/u).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
}

function Diagram({ body }: { body: string }) {
  const rows = lines(body)
  if (rows.length === 0) return <p className={styles.empty}>Adicione as etapas do diagrama na edição.</p>
  return <div className={styles.diagram}>{rows.map((row, rowIndex) => {
    const nodes = row.split(/\s*(?:->|→)\s*/u).filter(Boolean)
    return <div key={`${row}-${rowIndex}`} className={styles.diagramRow}>{nodes.map((node, index) => <span key={`${node}-${index}`} className={styles.diagramNode}><b>{node}</b>{index < nodes.length - 1 && <ArrowRight aria-hidden="true" />}</span>)}</div>
  })}</div>
}

function Terminology({ body }: { body: string }) {
  return <dl className={styles.terminology}>{lines(body).map((line, index) => {
    const [term, ...description] = line.split(/\s*(?:::|—)\s*/u)
    return <div key={`${line}-${index}`}><dt>{term}</dt><dd>{description.join(' — ') || 'Definição não informada.'}</dd></div>
  })}</dl>
}

function BlockBody({ block }: { block: ConceptBlock }) {
  if (block.type === 'diagram') return <Diagram body={block.body} />
  if (block.type === 'terminology') return <Terminology body={block.body} />
  if (block.type === 'rules') return <ol className={styles.rules}>{lines(block.body).map((rule, index) => <li key={`${rule}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{rule.replace(/^\d+[.)]\s*/u, '')}</p></li>)}</ol>
  if (block.type === 'structure' || block.type === 'limitations') return <ul className={styles.itemList}>{lines(block.body).map((item, index) => <li key={`${item}-${index}`}>{item.replace(/^[-•]\s*/u, '')}</li>)}</ul>
  if (block.type === 'notes') return <div className={styles.note}><Info aria-hidden="true" /><Paragraphs body={block.body} /></div>
  return <Paragraphs body={block.body} />
}

function ConceptBlockView({ block, index }: { block: ConceptBlock; index: number }) {
  return <section id={`block-${block.id}`} className={styles.section} data-type={block.type}>
    <header><span>{String(index + 1).padStart(2, '0')}</span><div><small>{BLOCK_LABELS[block.type]}</small><h2>{block.title || BLOCK_LABELS[block.type]}</h2></div></header>
    <BlockBody block={block} />
  </section>
}

export function ConceptEntityPage(props: EntityPageProps) {
  const { entity, worldName, content, entityTitleById, backlinks, relationTargetOptions } = props
  const parsedBlocks = ConceptBlocksSchema.safeParse(entity.properties.conceptBlocks)
  const blocks = parsedBlocks.success ? parsedBlocks.data : []
  const summary = text(entity.properties.summary)
  const category = text(entity.properties.category)

  return <main className={styles.workspace}>
    <nav className={styles.topbar} aria-label="Navegação do conceito">
      <Link href="/concept"><ArrowLeft />Conceitos</Link>
      <span>{worldName}</span>
      <Link href={`/entity/${entity.id}/edit`}><Pencil />Editar</Link>
    </nav>

    <article className={styles.manual}>
      <header className={styles.hero}>
        <div className={styles.eyebrow}><BookOpen /><span>CONCEITO</span>{category && <><i /> <em>{category}</em></>}</div>
        <h1>{entity.title}</h1>
        {summary && <p>{summary}</p>}
        {(entity.status || entity.tags.length > 0) && <div className={styles.metadata}>{entity.status && <span>{entity.status}</span>}{entity.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      </header>

      <div className={styles.layout}>
        <aside className={styles.outline}>
          <p>NESTA PÁGINA</p>
          <nav>
            {content.pages.map((page, index) => <a key={page.id} href={`#content-${page.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{page.title}</a>)}
            {blocks.map((block, index) => <a key={block.id} href={`#block-${block.id}`}><span>{String(content.pages.length + index + 1).padStart(2, '0')}</span>{block.title || BLOCK_LABELS[block.type]}</a>)}
            <a href="#related"><span>{String(content.pages.length + blocks.length + 1).padStart(2, '0')}</span>Relacionado</a>
          </nav>
        </aside>

        <div className={styles.content}>
          {content.pages.map((page, index) => {
            const singlePage: ContentDocument = { ...content, pages: [page] }
            return <section id={`content-${page.id}`} key={page.id} className={styles.section}>
              <header><span>{String(index + 1).padStart(2, '0')}</span><div><small>CONTEÚDO</small><h2>{page.title}</h2></div></header>
              <div className={styles.richText}><ContentRenderer content={singlePage} /></div>
            </section>
          })}
          {blocks.map((block, index) => <ConceptBlockView key={block.id} block={block} index={content.pages.length + index} />)}

          <section id="related" className={styles.related}>
            <div><small>REFERÊNCIAS</small><h2>Relacionado</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions} /></div>
            <div><small>MENÇÕES</small><h2>Outras páginas</h2><BacklinksPanel backlinks={backlinks} /></div>
          </section>
        </div>
      </div>
    </article>
  </main>
}
