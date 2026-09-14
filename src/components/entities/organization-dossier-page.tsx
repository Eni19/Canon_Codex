import Image from 'next/image'
import Link from 'next/link'
import { Building2, MapPin, Pencil, ShieldCheck } from 'lucide-react'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { OrganizationMemberFiles } from './organization-member-files'
import { RelationsPanel } from './relations-panel'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { OrganizationGroupsSchema } from '@/domain/entities/organizationGroup'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { EntityPageProps } from './entity-page'
import styles from './organization-dossier.module.css'

function textProperty(value: unknown) { return typeof value === 'string' ? value : '' }
function idList(value: unknown) { return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [] }

export function OrganizationDossierPage(props: EntityPageProps) {
  const { entity, entityType, worldName, content, entityTitleById, allEntities, relationTargetOptions } = props
  const memberIds = idList(entity.properties.members)
  const leaderIds = idList(entity.properties.leaders)
  const personnelIds = [...new Set([...leaderIds, ...memberIds])]
  const members = personnelIds.flatMap((id) => { const found = allEntities.find((candidate) => candidate.id === id && candidate.type === 'character'); return found ? [found] : [] })
  const parsedGroups = OrganizationGroupsSchema.safeParse(entity.properties.organizationGroups)
  const groups = parsedGroups.success ? parsedGroups.data : []
  const organizationIds = new Set(allEntities.filter((candidate) => candidate.type === 'organization').map((candidate) => candidate.id))
  const relations = entity.relations.filter((relation) => organizationIds.has(relation.targetId))
  const organizationOptions = relationTargetOptions.filter((option) => organizationIds.has(option.id))
  const headquarters = textProperty(entity.properties.headquarters)

  return <div className={styles.archive}>
    <main className={styles.desk}>
      <header className={styles.header}>
        <div><Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]} />
          <div className={styles.caseHeading}><Building2 className="size-6" /><div><span className={styles.classification}>ARQUIVO INSTITUCIONAL</span><h1>{entity.title}</h1></div></div>
        </div>
        <div className={styles.headerActions}><span className={styles.confidential}>CONFIDENCIAL</span><Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4" />Editar</Link></Button></div>
      </header>

      <section className={styles.coverSheet}>
        <div className={styles.registry}>
          <span><b>TIPO</b>{textProperty(entity.properties.organizationType) || 'Não classificado'}</span>
          <span><b>FUNDAÇÃO</b>{textProperty(entity.properties.founded) || 'Data reservada'}</span>
          <span><b>STATUS</b>{entity.status || 'Sem registro'}</span>
          {headquarters && <span><b>SEDE</b><Link href={`/entity/${headquarters}`}><MapPin className="size-3.5" />{entityTitleById[headquarters] ?? 'Local registrado'}</Link></span>}
        </div>
        <div className={styles.insignia}>{entity.coverAssetId ? <Image src={assetVariantUrl(entity.coverAssetId, 'thumbnail')} alt="" fill sizes="260px" className="object-cover" priority /> : <ShieldCheck className="size-20 opacity-20" />}<span>INSÍGNIA / ARQUIVO</span></div>
      </section>

      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          <section className={styles.section}><div className={styles.sectionHeading}><span>01</span><h2>Quadro de pessoal</h2></div><OrganizationMemberFiles members={members} leaderIds={leaderIds} /></section>
          <section className={styles.section}><div className={styles.sectionHeading}><span>02</span><h2>Relatório</h2></div><div className={styles.report}><ContentRenderer content={content} /></div></section>
        </div>
        <aside className={styles.sideColumn}>
          <section className={`${styles.memo} ${styles.objectives}`}><span className={styles.memoCode}>DIRETRIZ A</span><h2>Objetivos</h2><p>{textProperty(entity.properties.objectives) || 'Nenhum objetivo formalizado.'}</p></section>
          <section className={`${styles.memo} ${styles.ideals}`}><span className={styles.memoCode}>DOUTRINA</span><h2>Ideais</h2><p>{textProperty(entity.properties.ideals) || 'Nenhum ideal registrado.'}</p></section>
          <section className={styles.section}><div className={styles.sectionHeading}><span>03</span><h2>Subgrupos</h2></div><div className={styles.groupStack}>{groups.length ? groups.map((group) => <article key={group.id} className={styles.groupFolder}><span className={styles.groupTab}>EQUIPE</span><h3>{group.name}</h3>{group.description && <p>{group.description}</p>}<div>{group.memberIds.map((id) => <Link key={id} href={`/entity/${id}`}>{entityTitleById[id] ?? allEntities.find((candidate) => candidate.id === id)?.title ?? 'Membro'}</Link>)}</div></article>) : <p className={styles.emptyRecord}>Nenhuma equipe interna registrada.</p>}</div></section>
          <section className={styles.section}><div className={styles.sectionHeading}><span>04</span><h2>Relações institucionais</h2></div><div className={styles.relations}><RelationsPanel entityId={entity.id} relations={relations} entityTitleById={entityTitleById} targetOptions={organizationOptions} /></div></section>
        </aside>
      </div>
    </main>
  </div>
}

