import Image from 'next/image'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { contentTextBlocks } from '@/components/editor/content-text'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { PageScrollLock } from '@/components/entities/page-scroll-lock'
import { RelationsPanel } from '@/components/entities/relations-panel'
import type { EvidencePanelKey, EvidenceWallData } from '@/components/evidence-wall/evidence-wall'
import { EvidenceWallLoader } from '@/components/evidence-wall/evidence-wall-loader'
import wallStyles from '@/components/evidence-wall/evidence-wall.module.css'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { EvidenceFindingsSchema } from '@/domain/entities/evidenceFinding'
import { formatDateFieldValue } from '@/domain/worlds/calendar-date'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { ReactNode } from 'react'
import type { EntityPageProps } from './entity-page'
import styles from './evidence-board.module.css'

/**
 * Página de Evidência: uma parede 3D com as peças da evidência (polaroide, personagens, folhas do
 * relatório e notas) ligadas por linha vermelha. Sem WebGL, mostra o quadro em HTML.
 */
export function EvidenceBoardPage(props: EntityPageProps) {
  // Interface prática (configurações do Codex): o quadro em página única, sem a parede 3D.
  if (props.plainInterface) return <ClassicEvidenceBoard {...props}/>
  const { entity, entityType, worldName, content, entityTitleById, allEntities, calendar, backlinks, relationTargetOptions } = props
  const parsed = EvidenceFindingsSchema.safeParse(entity.properties.evidenceFindings)
  const findings = parsed.success ? parsed.data : []
  const characterIds = Array.isArray(entity.properties.relatedCharacters) ? entity.properties.relatedCharacters.filter((id): id is string => typeof id === 'string') : []
  const characters = characterIds.flatMap((id) => { const value = allEntities.find((candidate) => candidate.id === id && candidate.type === 'character'); return value ? [value] : [] })
  const format = typeof entity.properties.evidenceFormat === 'string' && entity.properties.evidenceFormat ? entity.properties.evidenceFormat : 'Evidência'
  const presentation = typeof entity.properties.presentation === 'string' ? entity.properties.presentation : ''
  const context = typeof entity.properties.contextualDescription === 'string' ? entity.properties.contextualDescription : ''
  const metadata = entityType.properties.filter((property) => ['evidenceFormat', 'evidenceType', 'relatedEvent', 'foundAt'].includes(property.key))
  const metadataValue = (key: string, kind: string) => kind === 'date'
    ? formatDateFieldValue(calendar, entity.properties[key]) || '—'
    : typeof entity.properties[key] === 'string' && entity.properties[key] ? entityTitleById[String(entity.properties[key])] ?? String(entity.properties[key]) : '—'
  const relationTitles = entity.relations.map((relation) => `${relation.label || relation.type}: ${entityTitleById[relation.targetId] ?? 'registro removido'}`)

  const data: EvidenceWallData = {
    entityId: entity.id,
    title: entity.title,
    format,
    coverAssetId: entity.coverAssetId,
    characters: characters.map((character) => ({ id: character.id, title: character.title, assetId: character.coverAssetId })),
    pages: content.pages.map((page) => ({ id: page.id, title: page.title, blocks: contentTextBlocks(page.body) })),
    notes: [
      { id: 'propriedades', title: 'Propriedades', lines: metadata.map((property) => ({ label: property.label, text: metadataValue(property.key, property.kind) })) },
      ...(presentation ? [{ id: 'apresentacao', title: 'Apresentação', lines: [{ text: presentation }] }] : []),
      ...findings.map((finding) => ({ id: `achado-${finding.id}`, title: finding.approach || 'Informação', lines: [...(finding.condition ? [{ label: finding.condition, text: '' }] : []), { text: finding.information }] })),
      ...(context ? [{ id: 'contexto', title: 'Notas contextuais', lines: [{ text: context }] }] : []),
      ...(entity.relations.length ? [{ id: 'relacoes', title: 'Relações', lines: relationTitles.map((text) => ({ text })) }] : []),
      ...(backlinks.length ? [{ id: 'referencias', title: 'Citada em', lines: backlinks.map((backlink) => ({ text: backlink.entity.title })) }] : []),
    ],
  }

  const panels: Partial<Record<EvidencePanelKey, ReactNode>> = {
    cover: <>
      {entity.coverAssetId && <div className={wallStyles.panelPhoto}><Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt="" fill sizes="480px" className="object-cover"/></div>}
      <h2>{entity.title}</h2>
      <p>{format}</p>
      {presentation && <><h3>Apresentação</h3><p className="whitespace-pre-wrap">{presentation}</p></>}
      <h3>Propriedades</h3>
      {metadata.map((property) => <p key={property.key}><strong>{property.label}:</strong> {metadataValue(property.key, property.kind)}</p>)}
    </>,
    'note:propriedades': <><h2>Propriedades</h2>{metadata.map((property) => <div key={property.key}><h3>{property.label}</h3><p>{metadataValue(property.key, property.kind)}</p></div>)}</>,
    'note:apresentacao': <><h2>Apresentação</h2><p className="whitespace-pre-wrap">{presentation}</p></>,
    'note:contexto': <><h2>Notas contextuais</h2><p className="whitespace-pre-wrap">{context}</p></>,
    'note:relacoes': <><h2>Relações</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions}/></>,
    'note:referencias': <><h2>Citada em</h2><BacklinksPanel backlinks={backlinks}/></>,
  }
  for (const finding of findings) {
    panels[`note:achado-${finding.id}`] = <><h2>{finding.approach || 'Informação'}</h2>{finding.condition && <h3>{finding.condition}</h3>}<p className="whitespace-pre-wrap">{finding.information}</p></>
  }
  for (const page of content.pages) {
    panels[`page:${page.id}`] = <><h2>{page.title}</h2><ContentRenderer content={{ ...content, pages: [page] }}/></>
  }
  for (const character of characters) {
    panels[`character:${character.id}`] = <>
      {character.coverAssetId && <div className={`${wallStyles.panelPhoto} ${wallStyles.panelPortrait}`}><Image src={assetVariantUrl(character.coverAssetId, 'original')} alt="" fill sizes="480px" className="object-cover object-top"/></div>}
      <h2>{character.title}</h2>
      <p><Link href={`/entity/${character.id}`}>Abrir a ficha do personagem</Link></p>
    </>
  }

  const header = <>
    <div>
      <Breadcrumbs items={[{ label: worldName, href: '/' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]}/>
      <h1 className={wallStyles.titleTape}>{entity.title}</h1>
    </div>
    <Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4"/>Editar</Link></Button>
  </>

  return <>
    <PageScrollLock/>
    <EvidenceWallLoader data={data} panels={panels} header={header} fallback={<ClassicEvidenceBoard {...props}/>}/>
  </>
}

/** O quadro em HTML, usado quando o navegador não tem WebGL. */
function ClassicEvidenceBoard({ entity, entityType, worldName, content, entityTitleById, allEntities, calendar, backlinks, relationTargetOptions }: EntityPageProps) {
  const parsed = EvidenceFindingsSchema.safeParse(entity.properties.evidenceFindings)
  const findings = parsed.success ? parsed.data : []
  const characterIds = Array.isArray(entity.properties.relatedCharacters) ? entity.properties.relatedCharacters.filter((id): id is string => typeof id === 'string') : []
  const characters = characterIds.flatMap((id) => { const value = allEntities.find((candidate) => candidate.id === id && candidate.type === 'character'); return value ? [value] : [] })
  const format = typeof entity.properties.evidenceFormat === 'string' ? entity.properties.evidenceFormat : 'Evidência'
  const presentation = typeof entity.properties.presentation === 'string' ? entity.properties.presentation : ''
  const context = typeof entity.properties.contextualDescription === 'string' ? entity.properties.contextualDescription : ''
  const metadata = entityType.properties.filter((property) => ['evidenceFormat', 'evidenceType', 'relatedEvent', 'foundAt'].includes(property.key))
  return <div className={styles.board} style={{ height: '100dvh', overflowY: 'auto' }}><main className={styles.canvas}>
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
        {entity.relations.length > 0 && <section className={styles.note}><h2>Relações</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions} /></section>}
        {backlinks.length > 0 && <section className={styles.note}><h2>Referências de outros registros</h2><BacklinksPanel backlinks={backlinks} /></section>}
      </div>
    </div>
  </main></div>
}
