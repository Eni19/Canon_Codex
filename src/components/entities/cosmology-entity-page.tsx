'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BookOpenText, ChevronRight, Pencil, Shield, Sparkles } from 'lucide-react'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { RelationsPanel } from '@/components/entities/relations-panel'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { EntityPageProps } from './entity-page'
import styles from './cosmology-codex.module.css'

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function CosmologyEntityPage({ entity, entityType, worldName, content, entityTitleById, allEntities, backlinks, relationTargetOptions }: EntityPageProps) {
  const parentId = typeof entity.properties.higherEntity === 'string' ? entity.properties.higherEntity : undefined
  const parent = parentId ? allEntities.find((candidate) => candidate.id === parentId) : undefined
  const children = allEntities.filter((candidate) => candidate.type === 'cosmology' && candidate.properties.higherEntity === entity.id)
  const organizations = stringList(entity.properties.worshipers).flatMap((id) => allEntities.find((candidate) => candidate.id === id) ?? [])
  const artifacts = stringList(entity.properties.associatedArtifacts).flatMap((id) => allEntities.find((candidate) => candidate.id === id) ?? [])
  const domains = stringList(entity.properties.domains)
  const nature = typeof entity.properties.cosmologyType === 'string' ? entity.properties.cosmologyType : 'Natureza desconhecida'
  const pantheon = typeof entity.properties.pantheon === 'string' ? entity.properties.pantheon : ''
  const objectives = typeof entity.properties.objectives === 'string' ? entity.properties.objectives : ''
  const ideals = typeof entity.properties.ideals === 'string' ? entity.properties.ideals : ''
  const symbolAssetId = typeof entity.properties.symbolAssetId === 'string' ? entity.properties.symbolAssetId : undefined
  const symbol = (className?: string) => <span className={className} aria-hidden="true">{symbolAssetId ? <Image src={assetVariantUrl(symbolAssetId, 'original')} alt="" fill sizes="160px" className={styles.symbolImage}/> : <Sparkles/>}</span>

  return <div data-character-theme={entity.theme ?? 'amber'} className={styles.codex}>
    {symbol(styles.watermark)}
    <main className={styles.page}>
      <header className={styles.header}>
        <Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: '/' + entityType.id }, { label: entity.title }]}/>
        <Button asChild variant="outline" size="sm"><Link replace href={'/entity/' + entity.id + '/edit'}><Pencil className="size-4"/>Editar</Link></Button>
      </header>

      <section className={styles.masthead}>
        {symbol(styles.seal)}
        <p className={styles.classification}>{nature}{pantheon ? ' · ' + pantheon : ''}</p>
        <h1>{entity.title}</h1>
        {entity.aliases.length > 0 && <p className={styles.aliases}>{entity.aliases.join(' · ')}</p>}
        <div className={styles.divider}>{symbol()}<i/></div>
      </section>

      <section className={styles.introduction}>
        <aside className={styles.doctrine}>
          <p className={styles.folio}>I · Doutrina e classificação</p>
          <dl>
            <div><dt>Natureza</dt><dd>{nature}</dd></div>
            {pantheon && <div><dt>Tradição</dt><dd>{pantheon}</dd></div>}
            {parent && <div><dt>Ordem superior</dt><dd><Link href={'/entity/' + parent.id}>{parent.title}</Link></dd></div>}
          </dl>
          <div className={styles.domains}><small>Domínios atribuídos</small>{domains.length ? <div>{domains.map((domain) => <span key={domain}>{domain}</span>)}</div> : <p>Não registrados.</p>}</div>
          {(ideals || objectives) && <div className={styles.tradition}><BookOpenText/><small>Trecho de tradição</small><blockquote>“{ideals || objectives}”</blockquote></div>}
        </aside>

        <figure className={styles.devotional}>
          <div className={styles.art}>{entity.coverAssetId ? <Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt={entity.title} fill sizes="(min-width: 900px) 56vw, 94vw" className={styles.mainArt} priority/> : <div className={styles.noArt}>{symbol()}<p>Nenhuma representação preservada</p></div>}</div>
          <figcaption><span>Representação atribuída</span><strong>{entity.title}</strong></figcaption>
        </figure>
      </section>

      {(objectives || ideals) && <section className={styles.tenets}>
        {objectives && <article><span>II</span><div><small>Propósito atribuído</small><h2>Objetivos</h2><p>{objectives}</p></div></article>}
        {ideals && <article><span>III</span><div><small>Princípio doutrinário</small><h2>Ideais</h2><p>{ideals}</p></div></article>}
      </section>}

      <div className={styles.symbolDivider}><i/>{symbol()}<i/></div>

      <section className={styles.relationSection}>
        <header><small>IV · Ordem e influência</small><h2>Relações conhecidas</h2></header>
        <div className={styles.hierarchy}>
          {parent && <RelationNode entity={parent} label="Ordem superior"/>}
          {parent && <ChevronRight/>}
          <div className={styles.currentNode}>{symbol()}<small>{nature}</small><strong>{entity.title}</strong></div>
          {children.length > 0 && <ChevronRight/>}
          {children.length > 0 && <div className={styles.childNodes}>{children.map((child) => <RelationNode key={child.id} entity={child} label="Subordinado"/>)}</div>}
        </div>
        {(organizations.length > 0 || artifacts.length > 0) && <div className={styles.associations}>
          <div><small>Cultos e organizações</small>{organizations.length ? organizations.map((organization) => <Link key={organization.id} href={'/entity/' + organization.id}><Shield/>{organization.title}</Link>) : <p>Nenhum culto associado.</p>}</div>
          <div><small>Artefatos associados</small>{artifacts.length ? artifacts.map((artifact) => <Link key={artifact.id} href={'/entity/' + artifact.id}>{symbol()} {artifact.title}</Link>) : <p>Nenhum artefato associado.</p>}</div>
        </div>}
      </section>

      <section className={styles.text}>
        <header><small>V · Registro comparado</small><h2>Corpus doutrinário</h2></header>
        {content.pages.map((contentPage, index) => <article key={contentPage.id}><aside>{String(index + 1).padStart(2, '0')}</aside><div><h3>{contentPage.title}</h3><ContentRenderer content={{ ...content, pages: [contentPage] }}/></div></article>)}
      </section>

      <section className={styles.references}>
        <div><h2>Vínculos registrados</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions}/></div>
        <div><h2>Menções e fontes</h2><BacklinksPanel backlinks={backlinks}/></div>
      </section>
    </main>
  </div>
}

function RelationNode({ entity, label }: { entity: EntityPageProps['entity']; label: string }) {
  return <Link href={'/entity/' + entity.id} className={styles.relationNode}><small>{label}</small><strong>{entity.title}</strong></Link>
}

