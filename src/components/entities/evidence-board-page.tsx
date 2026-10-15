import Image from 'next/image'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { EvidenceFindingsSchema } from '@/domain/entities/evidenceFinding'
import { formatDateFieldValue } from '@/domain/worlds/calendar-date'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { EntityPageProps } from './entity-page'
import styles from './evidence-board.module.css'

export function EvidenceBoardPage({ entity, entityType, worldName, content, entityTitleById, allEntities, calendar }: EntityPageProps) {
  const parsed = EvidenceFindingsSchema.safeParse(entity.properties.evidenceFindings)
  const findings = parsed.success ? parsed.data : []
  const characterIds = Array.isArray(entity.properties.relatedCharacters) ? entity.properties.relatedCharacters.filter((id): id is string => typeof id === 'string') : []
  const characters = characterIds.flatMap((id) => { const value = allEntities.find((candidate) => candidate.id === id && candidate.type === 'character'); return value ? [value] : [] })
  const format = typeof entity.properties.evidenceFormat === 'string' ? entity.properties.evidenceFormat : 'Evidência'
  const presentation = typeof entity.properties.presentation === 'string' ? entity.properties.presentation : ''
  const context = typeof entity.properties.contextualDescription === 'string' ? entity.properties.contextualDescription : ''
  const metadata = entityType.properties.filter((property) => ['evidenceFormat', 'evidenceType', 'relatedEvent', 'foundAt'].includes(property.key))
  return <div className={styles.board}><main className={styles.canvas}>
    <svg className={styles.strings} viewBox="0 0 1200 500" preserveAspectRatio="none" aria-hidden="true"><path d="M170 160 C350 40 510 220 690 125 S980 90 1080 245" fill="none" stroke="var(--primary)" strokeWidth="3"/><path d="M185 180 C410 350 770 260 1030 390" fill="none" stroke="var(--primary)" strokeWidth="2"/></svg>
    <header className={styles.header}><div><Breadcrumbs items={[{label:worldName,href:'/'},{label:entityType.pluralLabel,href:`/${entityType.id}`},{label:entity.title}]}/><h1 className={styles.titleTape}>{entity.title}</h1></div><Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4"/>Editar</Link></Button></header>
    <div className={styles.grid}>
      <div>
        <figure className={styles.polaroid}>{entity.coverAssetId ? <div className={styles.photo}><Image src={assetVariantUrl(entity.coverAssetId,'original')} alt="" fill sizes="360px" className="object-cover" priority/></div> : <div className={`${styles.photo} grid place-items-center text-sm text-white/50`}>Sem fotografia</div>}<figcaption className={styles.caption}>{format}</figcaption></figure>
        {characters.length > 0 && <div className={styles.characters}>{characters.map((character)=><Link key={character.id} href={`/entity/${character.id}`} className={`${styles.polaroid} ${styles.character}`}>{character.coverAssetId ? <div className={styles.photo}><Image src={assetVariantUrl(character.coverAssetId,'thumbnail')} alt="" fill sizes="150px" className={styles.characterPortrait}/></div>:<div className={`${styles.photo} grid place-items-center text-xs`}>Sem foto</div>}<span className={styles.caption}>{character.title}</span></Link>)}</div>}
      </div>
      <div className={styles.sheets}>{content.pages.map((page)=><article key={page.id} className={styles.sheet}><div className={styles.sheetBody}><h2>{page.title}</h2><ContentRenderer content={{...content,pages:[page]}}/></div></article>)}</div>
      <div>
        <section className={styles.note}><h2>Propriedades</h2>{metadata.map((property)=><div key={property.key} className={styles.finding}><strong>{property.label}</strong><p>{property.kind === 'date' ? formatDateFieldValue(calendar, entity.properties[property.key]) || '—' : typeof entity.properties[property.key] === 'string' ? entityTitleById[String(entity.properties[property.key])] ?? String(entity.properties[property.key]) : '—'}</p></div>)}</section>
        <section className={styles.note}><h2>Apresentação</h2><p className="whitespace-pre-wrap text-sm">{presentation || 'Nenhuma descrição inicial.'}</p></section>
        {findings.length > 0 && <section className={styles.note}><h2>Informações</h2>{findings.map((finding)=><div key={finding.id} className={styles.finding}><div className={styles.findingMeta}><span>{finding.approach || 'Livre'}</span>{finding.condition && <span>· {finding.condition}</span>}</div><p className="mt-1">{finding.information}</p></div>)}</section>}
        {context && <section className={styles.note}><h2>Notas contextuais</h2><p className="whitespace-pre-wrap text-sm">{context}</p></section>}
      </div>
    </div>
  </main></div>
}
