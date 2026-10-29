'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, FolderTree, Search, SlidersHorizontal } from 'lucide-react'
import { EntityCard } from '@/components/entities/entity-card'
import type { Entity } from '@/domain/entities/entity'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { buildLocationTree, filterLocationTree, type LocationNode } from '@/domain/entities/locationTree'
import { assetVariantUrl } from '@/lib/assetUrl'
import { cn } from '@/lib/utils'
import styles from './entity-catalog.module.css'

type CatalogMode = 'name' | 'organization' | 'location' | 'hierarchy' | 'nature' | 'recordKind' | 'discipline' | 'subtype'

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

function referenceId(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function modesFor(typeId: string): Array<{ id: CatalogMode; label: string }> {
  if (typeId === 'character') return [
    { id: 'name', label: 'Nome' },
    { id: 'organization', label: 'Organização' },
    { id: 'location', label: 'Local' },
  ]
  if (typeId === 'location') return [
    { id: 'hierarchy', label: 'Regiões' },
    { id: 'name', label: 'Nome' },
  ]
  if (typeId === 'creature') return [
    { id: 'nature', label: 'Natureza' },
    { id: 'name', label: 'Nome' },
  ]
  if (typeId === 'species') return [
    { id: 'recordKind', label: 'Espécies e povos' },
    { id: 'name', label: 'Nome' },
  ]
  if (typeId === 'naturalScience') return [
    { id: 'discipline', label: 'Área' },
    { id: 'subtype', label: 'Subtipo' },
    { id: 'name', label: 'Nome' },
  ]
  return [{ id: 'name', label: 'Nome' }]
}

function initialMode(typeId: string): CatalogMode {
  if (typeId === 'location') return 'hierarchy'
  if (typeId === 'creature') return 'nature'
  if (typeId === 'species') return 'recordKind'
  if (typeId === 'naturalScience') return 'discipline'
  return 'name'
}

function alphabeticGroups(entities: Entity[]) {
  const groups = new Map<string, Entity[]>()
  for (const entity of entities) {
    const letter = entity.title.trim().charAt(0).toLocaleUpperCase('pt-BR') || '#'
    groups.set(letter, [...(groups.get(letter) ?? []), entity])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => collator.compare(left, right))
    .map(([label, items]) => ({ label, items: items.sort((a, b) => collator.compare(a.title, b.title)) }))
}

function groupedByLabel(entities: Entity[], getLabel: (entity: Entity) => string) {
  const groups = new Map<string, Entity[]>()
  for (const entity of entities) {
    const label = getLabel(entity)
    groups.set(label, [...(groups.get(label) ?? []), entity])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => collator.compare(left, right))
    .map(([label, items]) => ({ label, items: items.sort((a, b) => collator.compare(a.title, b.title)) }))
}

export function EntityCatalog({
  entities,
  relatedEntities,
  entityType,
}: {
  entities: Entity[]
  relatedEntities: Entity[]
  entityType: EntityTypeDefinition
}) {
  const modes = modesFor(entityType.id)
  const [mode, setMode] = useState<CatalogMode>(() => initialMode(entityType.id))
  const [query, setQuery] = useState('')
  const titleById = useMemo(() => new Map(relatedEntities.map((entity) => [entity.id, entity.title])), [relatedEntities])
  const normalizedQuery = normalize(query.trim())
  const filtered = useMemo(
    () => entities.filter((entity) => normalize(entity.title).includes(normalizedQuery)),
    [entities, normalizedQuery],
  )

  const groups = useMemo(() => {
    if (mode === 'organization') {
      return groupedByLabel(filtered, (entity) => {
        const id = referenceId(entity.properties.affiliation)
        return (id && titleById.get(id)) || 'Sem organização'
      })
    }
    if (mode === 'location') {
      return groupedByLabel(filtered, (entity) => {
        const id = referenceId(entity.properties.currentLocation)
        return (id && titleById.get(id)) || 'Local não informado'
      })
    }
    if (mode === 'nature') {
      const ordered = groupedByLabel(filtered, (entity) => String(entity.properties.creatureKind || 'Não classificada'))
      const rank = new Map([['Monstro', 0], ['Animal', 1], ['Não classificada', 2]])
      return ordered.sort((a, b) => (rank.get(a.label) ?? 10) - (rank.get(b.label) ?? 10) || collator.compare(a.label, b.label))
    }
    if (mode === 'recordKind') {
      const ordered = groupedByLabel(filtered, (entity) => String(entity.properties.recordKind || 'Não classificado'))
      const rank = new Map([['Espécie', 0], ['Povo / Cultura', 1], ['Não classificado', 2]])
      return ordered.sort((a, b) => (rank.get(a.label) ?? 10) - (rank.get(b.label) ?? 10) || collator.compare(a.label, b.label))
    }
    if (mode === 'discipline') {
      const ordered = groupedByLabel(filtered, (entity) => String(entity.properties.discipline || 'Não classificado'))
      const rank = new Map([['Natureza', 0], ['Medicina', 1], ['Não classificado', 2]])
      return ordered.sort((a, b) => (rank.get(a.label) ?? 10) - (rank.get(b.label) ?? 10) || collator.compare(a.label, b.label))
    }
    if (mode === 'subtype') return groupedByLabel(filtered, (entity) => String(entity.properties.scienceSubtype || 'Não classificado'))
    return alphabeticGroups(filtered)
  }, [filtered, mode, titleById])

  return <div className={styles.catalog}>
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <Search aria-hidden="true" />
        <span className="sr-only">Pesquisar por nome</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Pesquisar ${entityType.pluralLabel.toLocaleLowerCase('pt-BR')} por nome…`} />
        {query && <button type="button" onClick={() => setQuery('')}>Limpar</button>}
      </label>
      {modes.length > 1 && <div className={styles.modes} aria-label="Organizar catálogo">
        <span><SlidersHorizontal />Organizar</span>
        {modes.map((option) => <button key={option.id} type="button" onClick={() => setMode(option.id)} data-active={mode === option.id}>{option.label}</button>)}
      </div>}
    </div>

    <div className={styles.resultCount}>{filtered.length} {filtered.length === 1 ? 'registro encontrado' : 'registros encontrados'}</div>

    {filtered.length === 0 ? <div className={styles.empty}><Search /><strong>Nenhum resultado</strong><p>Tente pesquisar usando outra parte do nome.</p></div>
      : mode === 'hierarchy'
        ? <LocationHierarchy entities={entities} filteredIds={new Set(filtered.map((entity) => entity.id))} searching={Boolean(normalizedQuery)} entityType={entityType} />
        : <div className={styles.groups}>{groups.map((group) => <section key={group.label} className={styles.group}>
          <header><span>{group.label}</span><small>{group.items.length}</small><i /></header>
          <div className={styles.grid}>{group.items.map((entity) => <EntityCard key={entity.id} entity={entity} entityType={entityType} />)}</div>
        </section>)}</div>}
  </div>
}

function LocationHierarchy({
  entities,
  filteredIds,
  searching,
  entityType,
}: {
  entities: Entity[]
  filteredIds: Set<string>
  searching: boolean
  entityType: EntityTypeDefinition
}) {
  const tree = buildLocationTree(entities, (entity) => referenceId(entity.properties.parentLocation), (a, b) => collator.compare(a.title, b.title))
  const regions = searching ? filterLocationTree(tree, (entity) => filteredIds.has(entity.id)) : tree

  return <div className={styles.regionList}>
    {regions.map((node) => <RegionDivision key={node.item.id} node={node} entityType={entityType} />)}
  </div>
}

/**
 * One division per location that has sublocations. Children without their own sublocations are
 * cards; children with sublocations become nested divisions, so each level lives in its parent.
 */
function RegionDivision({ node, entityType, parentTitle }: { node: LocationNode<Entity>; entityType: EntityTypeDefinition; parentTitle?: string }) {
  const { item: region, children } = node
  const leaves = children.filter((child) => child.children.length === 0)
  const branches = children.filter((child) => child.children.length > 0)
  const nested = Boolean(parentTitle)

  return <section className={nested ? styles.subregion : styles.region}>
    <header className={cn(styles.regionHeader, nested && styles.subregionHeader)}>
      <span className={styles.regionCover}>
        {region.coverAssetId ? <Image src={assetVariantUrl(region.coverAssetId, 'thumbnail')} alt="" fill sizes="112px" className="object-cover" unoptimized /> : <FolderTree />}
      </span>
      <span><small>{nested ? `Sub-região de ${parentTitle}` : 'Região pai'}</small><strong>{region.title}</strong></span>
      <Link href={`/entity/${region.id}`}>{nested ? 'Abrir sub-região' : 'Abrir região'}<ArrowRight /></Link>
    </header>
    {leaves.length > 0 && <div className={cn(styles.grid, styles.regionGrid)}>
      {leaves.map(({ item }) => <EntityCard key={item.id} entity={item} entityType={entityType} contextLabel={`Sub-região · ${region.title}`} />)}
    </div>}
    {branches.map((branch) => <RegionDivision key={branch.item.id} node={branch} entityType={entityType} parentTitle={region.title} />)}
    {children.length === 0 && <p className={styles.noChildren}>Nenhuma sub-região cadastrada.</p>}
  </section>
}
