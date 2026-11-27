import Image from 'next/image'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { contentTextBlocks } from '@/components/editor/content-text'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { OrganizationDossierPage } from '@/components/entities/organization-dossier-page'
import { PageScrollLock } from '@/components/entities/page-scroll-lock'
import { RelationsPanel } from '@/components/entities/relations-panel'
import type { ArchivePanelKey, OrgArchiveData } from '@/components/org-archive/org-archive'
import { OrgArchiveLoader } from '@/components/org-archive/org-archive-loader'
import styles from '@/components/org-archive/org-archive.module.css'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { OrganizationGroupsSchema } from '@/domain/entities/organizationGroup'
import { formatDateFieldValue } from '@/domain/worlds/calendar-date'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { EntityPageProps } from './entity-page'

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function ids(value: unknown) { return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [] }

/**
 * Página de Organização: uma caixa-arquivo em 3D. A caixa começa fechada; dentro dela estão o
 * dossiê, o relatório (o conteúdo), o livro de registro com todos os membros, a pasta sanfonada com
 * os subgrupos, o estatuto (objetivos e ideais) e o maço de correspondência (relações e citações).
 * Cada um é um objeto só, para caber organizações de qualquer tamanho. Sem WebGL, mostra o dossiê em HTML.
 */
export function OrganizationArchivePage(props: EntityPageProps) {
  const { entity, entityType, worldName, content, entityTitleById, allEntities, relationTargetOptions, calendar, backlinks } = props
  const byId = new Map(allEntities.map((item) => [item.id, item]))
  const titleOf = (id: string) => entityTitleById[id] ?? byId.get(id)?.title ?? 'Registro removido'
  const parsedGroups = OrganizationGroupsSchema.safeParse(entity.properties.organizationGroups)
  const groups = parsedGroups.success ? parsedGroups.data : []
  const leaderIds = ids(entity.properties.leaders)
  const personnel = [...new Set([...leaderIds, ...ids(entity.properties.members)])]
    .flatMap((id) => { const found = byId.get(id); return found && found.type === 'character' ? [found] : [] })
  const groupsOf = (id: string) => groups.filter((group) => group.memberIds.includes(id)).map((group) => group.name)
  const kind = text(entity.properties.organizationType)
  const founded = formatDateFieldValue(calendar, entity.properties.founded)
  const headquarters = text(entity.properties.headquarters)
  const objectives = text(entity.properties.objectives)
  const ideals = text(entity.properties.ideals)
  const organizationIds = new Set(allEntities.filter((item) => item.type === 'organization').map((item) => item.id))
  const organizationOptions = relationTargetOptions.filter((option) => organizationIds.has(option.id))
  const articles = [
    ...(objectives ? [{ heading: 'Dos objetivos', text: objectives }] : []),
    ...(ideals ? [{ heading: 'Dos ideais', text: ideals }] : []),
  ]
  const addressees = [...new Set([
    ...entity.relations.map((relation) => titleOf(relation.targetId)),
    ...backlinks.map((backlink) => backlink.entity.title),
  ])]

  const data: OrgArchiveData = {
    entityId: entity.id,
    title: entity.title,
    kind,
    coverAssetId: entity.coverAssetId,
    lidFields: [
      { label: 'CLASSE', value: kind },
      { label: 'PERÍODO', value: founded ? `desde ${founded}` : '' },
      { label: 'SEDE', value: headquarters ? titleOf(headquarters) : '' },
    ].filter((field) => field.value),
    dossierFields: [
      { label: 'Fundação', value: founded },
      { label: 'Situação', value: text(entity.status) },
      { label: 'Sede', value: headquarters ? titleOf(headquarters) : '' },
      { label: 'Também chamada', value: entity.aliases.join(', ') },
    ].filter((field) => field.value),
    groups: groups.map((group) => group.name),
    members: personnel.map((member) => ({ id: member.id, name: member.title, leader: leaderIds.includes(member.id), groups: groupsOf(member.id) })),
    charter: { founded, articles },
    addressees,
    pages: content.pages.map((page) => ({ id: page.id, title: page.title, blocks: contentTextBlocks(page.body) })),
  }

  const link = (id: string) => <Link key={id} href={`/entity/${id}`}>{titleOf(id)}</Link>
  const panels: Partial<Record<ArchivePanelKey, ReactNode>> = {
    dossier: <>
      {entity.coverAssetId && <div className={styles.panelPhoto}><Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt="" fill sizes="480px" className="object-contain"/></div>}
      <h2>{entity.title}</h2>
      {entity.aliases.length > 0 && <p>{entity.aliases.join(' · ')}</p>}
      <h3>Classificação</h3><p>{kind || 'Não classificada'}</p>
      <h3>Fundação</h3><p>{founded || '—'}</p>
      <h3>Situação</h3><p>{text(entity.status) || '—'}</p>
      <h3>Sede</h3><p>{headquarters ? link(headquarters) : '—'}</p>
      {leaderIds.length > 0 && <><h3>Liderança</h3><div className={styles.panelList}>{leaderIds.map(link)}</div></>}
      {entity.tags.length > 0 && <><h3>Marcadores</h3><div className={styles.chips}>{entity.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></>}
    </>,
    accordion: <>
      <h2>Subgrupos</h2>
      <p>{groups.length} divisória{groups.length === 1 ? '' : 's'}. Abra uma para ver a descrição e os integrantes.</p>
      <div className={styles.dividers}>
        {groups.map((group) => <details key={group.id}>
          <summary><span>{group.name}</span><small>{group.memberIds.length} integrante{group.memberIds.length === 1 ? '' : 's'}</small></summary>
          {group.description && <p className="whitespace-pre-wrap">{group.description}</p>}
          {group.memberIds.length ? <div className={styles.panelList}>{group.memberIds.map(link)}</div> : <p>Nenhum integrante neste subgrupo.</p>}
        </details>)}
      </div>
    </>,
    charter: <>
      <h2>Estatuto</h2>
      <p>{entity.title}{founded ? `, fundada em ${founded}` : ''}.</p>
      {articles.map((article, i) => <div key={article.heading}><h3>Art. {i + 1}º — {article.heading}</h3><p className="whitespace-pre-wrap">{article.text}</p></div>)}
    </>,
    letters: <>
      <h2>Correspondência</h2>
      <h3>Relações institucionais</h3>
      <RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={organizationOptions}/>
      <h3>Citada em</h3>
      <BacklinksPanel backlinks={backlinks}/>
    </>,
  }
  for (const page of content.pages) panels[`page:${page.id}`] = <><h2>{page.title}</h2><ContentRenderer content={{ ...content, pages: [page] }}/></>

  const header = <>
    <div>
      <Breadcrumbs items={[{ label: worldName, href: '/' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]}/>
      <div className={styles.titleLabel}><small>{kind || entityType.label}</small><h1>{entity.title}</h1></div>
    </div>
    <Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4"/>Editar</Link></Button>
  </>

  return <>
    <PageScrollLock/>
    <OrgArchiveLoader data={data} panels={panels} header={header} fallback={<OrganizationDossierPage {...props}/>}/>
  </>
}
