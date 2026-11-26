import Image from 'next/image'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { contentTextBlocks } from '@/components/editor/content-text'
import { ArtifactEntityPage } from '@/components/entities/artifact-entity-page'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { PageScrollLock } from '@/components/entities/page-scroll-lock'
import { RelationsPanel } from '@/components/entities/relations-panel'
import type { ObjectBenchData, ObjectPanelKey } from '@/components/object-bench/object-bench'
import { ObjectBenchLoader } from '@/components/object-bench/object-bench-loader'
import benchStyles from '@/components/object-bench/object-bench.module.css'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { ArtifactDetailsSchema } from '@/domain/entities/artifactDetail'
import { caliperReading } from '@/domain/objects/objectBench'
import { formatDateFieldValue } from '@/domain/worlds/calendar-date'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { EntityPageProps } from './entity-page'

/** Notas adesivas da bancada: grupos de campos do Objeto, cada um numa nota. */
const NOTE_GROUPS = [
  { id: 'identificacao', title: 'Identificação', keys: ['artifactType', 'origin', 'period', 'condition'] },
  { id: 'proveniencia', title: 'Proveniência', keys: ['acquisition', 'currentLocation', 'owner'] },
  { id: 'efeito', title: 'Efeito conhecido', keys: ['knownEffect'] },
]

/**
 * Página de Objeto: uma bancada de estudo em 3D. A foto técnica fica no centro; o paquímetro mede
 * as dimensões e a lupa revela os detalhes marcados quando levados até ela; notas, etiquetas e as
 * folhas do relatório completam o resto. Sem WebGL, mostra a ficha de catalogação em HTML.
 */
export function ObjectBenchPage(props: EntityPageProps) {
  const { entity, entityType, worldName, content, entityTitleById, calendar, backlinks, relationTargetOptions } = props
  const parsedDetails = ArtifactDetailsSchema.safeParse(entity.properties.artifactDetails)
  const details = parsedDetails.success ? parsedDetails.data : []
  const text = (key: string) => {
    const value = entity.properties[key]
    const kind = entityType.properties.find((property) => property.key === key)?.kind
    if (kind === 'date') return formatDateFieldValue(calendar, value) || ''
    if (typeof value === 'string') return entityTitleById[value] ?? value.trim()
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map((item) => entityTitleById[item] ?? item).join(', ')
    return ''
  }
  const label = (key: string) => entityType.properties.find((property) => property.key === key)?.label ?? key
  const kind = text('artifactType')
  const dimensions = text('dimensions')
  const reading = caliperReading(dimensions)

  const groups = NOTE_GROUPS.map((group) => ({ ...group, fields: group.keys.filter((key) => entityType.properties.some((property) => property.key === key)).map((key) => ({ key, label: label(key), value: text(key) })) }))
    .filter((group) => group.fields.some((field) => field.value))
  const relationTitles = entity.relations.map((relation) => `${relation.label || relation.type}: ${entityTitleById[relation.targetId] ?? 'registro removido'}`)

  const data: ObjectBenchData = {
    entityId: entity.id,
    title: entity.title,
    figure: kind || entityType.label,
    coverAssetId: entity.coverAssetId,
    dimensions,
    details: details.map(({ id, label: name, x, y }) => ({ id, label: name, x, y })),
    notes: [
      ...groups.map((group) => ({ id: group.id, title: group.title, lines: group.fields.filter((field) => field.value).map((field) => group.fields.length > 1 ? { label: field.label, text: field.value } : { text: field.value }) })),
      ...(entity.aliases.length ? [{ id: 'nomes', title: 'Também chamado', lines: entity.aliases.map((alias) => ({ text: alias })) }] : []),
      ...(entity.relations.length ? [{ id: 'relacoes', title: 'Relações', lines: relationTitles.map((title) => ({ text: title })) }] : []),
      ...(backlinks.length ? [{ id: 'referencias', title: 'Citado em', lines: backlinks.map((backlink) => ({ text: backlink.entity.title })) }] : []),
    ],
    labels: [
      ...(kind ? [{ id: 'tipo', title: label('artifactType'), lines: [kind] }] : []),
      ...(entity.tags.length ? [{ id: 'marcadores', title: 'Marcadores', lines: [entity.tags.join(' · ')] }] : []),
    ],
    pages: content.pages.map((page) => ({ id: page.id, title: page.title, blocks: contentTextBlocks(page.body) })),
  }

  const fieldList = (keys: string[]) => keys.filter((key) => entityType.properties.some((property) => property.key === key)).map((key) => <div key={key}><h3>{label(key)}</h3><p className="whitespace-pre-wrap">{text(key) || '—'}</p></div>)
  const panels: Partial<Record<ObjectPanelKey, ReactNode>> = {
    specimen: <>
      {entity.coverAssetId && <div className={benchStyles.panelPhoto}><Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt="" fill sizes="480px" className="object-contain p-4"/></div>}
      <h2>{entity.title}</h2>
      {entity.aliases.length > 0 && <p>{entity.aliases.join(' · ')}</p>}
      {fieldList(['artifactType', 'origin', 'period', 'condition', 'currentLocation', 'owner'])}
      {details.length > 0 && <p><em>Leve a lupa até a foto para encontrar {details.length === 1 ? 'o detalhe marcado' : `os ${details.length} detalhes marcados`}.</em></p>}
    </>,
    caliper: <>
      <h2>Dimensões</h2>
      <div className={benchStyles.reading}>{reading ? <>{reading.value}<small>{reading.unit}</small></> : '- - -'}</div>
      <p className="whitespace-pre-wrap">{dimensions || 'Nenhuma dimensão registrada. Acrescente em "Dimensões", na edição do objeto.'}</p>
    </>,
    loupe: <>
      <h2>Detalhes</h2>
      {details.length
        ? <><p>Passe a lupa sobre a foto: cada detalhe aparece dentro da lente.</p>{details.map((detail, i) => <div key={detail.id}><h3>{i + 1}. {detail.label}</h3><p className="whitespace-pre-wrap">{detail.description || 'Sem anotação adicional.'}</p></div>)}</>
        : <p>Nenhum detalhe marcado. Marque pontos da foto na edição do objeto.</p>}
    </>,
    'label:tipo': <><h2>{label('artifactType')}</h2><p>{kind}</p></>,
    'label:marcadores': <><h2>Marcadores</h2><div className={benchStyles.chips}>{entity.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></>,
    'note:nomes': <><h2>Também chamado</h2>{entity.aliases.map((alias) => <p key={alias}>{alias}</p>)}</>,
    'note:relacoes': <><h2>Relações</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions}/></>,
    'note:referencias': <><h2>Citado em</h2><BacklinksPanel backlinks={backlinks}/></>,
  }
  for (const group of groups) panels[`note:${group.id}`] = <><h2>{group.title}</h2>{fieldList(group.keys)}</>
  for (const page of content.pages) panels[`page:${page.id}`] = <><h2>{page.title}</h2><ContentRenderer content={{ ...content, pages: [page] }}/></>
  details.forEach((detail, i) => {
    panels[`detail:${detail.id}`] = <><h2>Detalhe {i + 1}</h2><h3>{detail.label}</h3><p className="whitespace-pre-wrap">{detail.description || 'Sem anotação adicional.'}</p></>
  })

  const header = <>
    <div>
      <Breadcrumbs items={[{ label: worldName, href: '/' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]}/>
      <div className={benchStyles.titleLabel}><small>{kind || entityType.label}</small><h1>{entity.title}</h1></div>
    </div>
    <Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4"/>Editar</Link></Button>
  </>

  return <>
    <PageScrollLock/>
    <ObjectBenchLoader data={data} panels={panels} header={header} fallback={<ArtifactEntityPage {...props}/>}/>
  </>
}
