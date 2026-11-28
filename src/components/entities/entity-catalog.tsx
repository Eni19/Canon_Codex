'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, FolderTree, Search, SlidersHorizontal } from 'lucide-react'
import { hand, typewriter } from '@/components/codex-notebook/notebook-fonts'
import { NotebookDeskStage } from '@/components/codex-notebook/notebook-desk-background'
import { CutoutTitle } from '@/components/codex-notebook/scraps'
import { EntityCard } from '@/components/entities/entity-card'
import type { Entity } from '@/domain/entities/entity'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { tagKey } from '@/domain/entities/entityTags'
import { buildLocationTree, filterLocationTree, type LocationNode } from '@/domain/entities/locationTree'
import { assetVariantUrl } from '@/lib/assetUrl'
import { cn } from '@/lib/utils'
import styles from './entity-catalog.module.css'

type CatalogMode = 'name' | 'organization' | 'location' | 'hierarchy' | 'nature' | 'recordKind' | 'discipline' | 'subtype'

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
const PORTRAITS_PER_SHEET = 4
const PORTRAITS_PER_SPREAD = 2 * PORTRAITS_PER_SHEET
const FIRST_SPREAD = { page: 0, direction: 0 }

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
  createButton,
  breadcrumbs,
}: {
  entities: Entity[]
  relatedEntities: Entity[]
  entityType: EntityTypeDefinition
  createButton?: ReactNode
  breadcrumbs?: ReactNode
}) {
  const modes = modesFor(entityType.id)
  const [mode, setMode] = useState<CatalogMode>(() => initialMode(entityType.id))
  const [query, setQuery] = useState('')
  const [turn, setTurn] = useState(FIRST_SPREAD)
  const titleById = useMemo(() => new Map(relatedEntities.map((entity) => [entity.id, entity.title])), [relatedEntities])
  const normalizedQuery = tagKey(query)
  const filtered = useMemo(
    () => entities.filter((entity) =>
      [entity.title, ...entity.aliases, ...entity.tags].some((value) => tagKey(value).includes(normalizedQuery)),
    ),
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

  function search(value: string) {
    if (tagKey(value) !== normalizedQuery) setTurn(FIRST_SPREAD)
    setQuery(value)
  }

  const toolbar = <div className={styles.toolbar}>
      <label className={styles.search}>
        <Search aria-hidden="true" />
        <span className="sr-only">Pesquisar por nome, apelido ou tag</span>
        <input value={query} onChange={(event) => search(event.target.value)} placeholder="Pesquisar por nome, apelido ou tag" />
        {query && <button type="button" onClick={() => search('')}>Limpar</button>}
      </label>
      {modes.length > 1 && <div className={styles.modes} aria-label="Organizar catálogo">
        <span><SlidersHorizontal />Organizar</span>
        {modes.map((option) => <button key={option.id} type="button" onClick={() => {
          if (mode !== option.id) setTurn(FIRST_SPREAD)
          setMode(option.id)
        }} aria-pressed={mode === option.id} data-active={mode === option.id}>{option.label}</button>)}
      </div>}
    </div>

  if (entityType.id === 'character') return <div className={cn(styles.albumWorkspace, hand.variable, typewriter.variable)}>
    <div className={styles.albumBreadcrumbs}>{breadcrumbs}</div>
    <NotebookDeskStage className={styles.albumDesk} backgroundClass={styles.albumBackground} overlayClass={styles.albumOverlay}>
      <CharacterAlbum groups={groups} entityType={entityType} total={entities.length}
        showGroup={mode !== 'name'} turn={turn} onTurn={setTurn} toolbar={toolbar} createButton={createButton} />
      <nav className={styles.albumIndex} aria-label="Índice de personagens">
        <h2>Índice</h2>
        {entities.length > 0 ? <ul>
          {[...entities].sort((a, b) => collator.compare(a.title, b.title)).map((entity) =>
            <li key={entity.id}><Link href={`/entity/${entity.id}`} prefetch={false}>{entity.title}</Link></li>,
          )}
        </ul> : <p>Nenhum personagem criado.</p>}
      </nav>
    </NotebookDeskStage>
  </div>

  return <div className={styles.catalog}>
    {toolbar}
    <div className={styles.resultCount}>{filtered.length} {filtered.length === 1 ? 'registro encontrado' : 'registros encontrados'}</div>
    {filtered.length === 0 ? <div className={styles.empty}><Search /><strong>Nenhum resultado</strong><p>Tente outro nome, apelido ou tag.</p></div>
      : mode === 'hierarchy'
        ? <LocationHierarchy entities={entities} filteredIds={new Set(filtered.map((entity) => entity.id))} searching={Boolean(normalizedQuery)} entityType={entityType} />
        : <div className={styles.groups}>{groups.map((group) => <section key={group.label} className={styles.group}>
          <header><span>{group.label}</span><small>{group.items.length}</small><i /></header>
          <div className={styles.grid}>{group.items.map((entity) => <EntityCard key={entity.id} entity={entity} entityType={entityType} />)}</div>
        </section>)}</div>}
  </div>
}

function CharacterAlbum({
  groups,
  entityType,
  total,
  showGroup,
  turn,
  onTurn,
  toolbar,
  createButton,
}: {
  groups: ReturnType<typeof alphabeticGroups>
  entityType: EntityTypeDefinition
  total: number
  showGroup: boolean
  turn: typeof FIRST_SPREAD
  onTurn: (turn: typeof FIRST_SPREAD) => void
  toolbar: ReactNode
  createButton?: ReactNode
}) {
  const entries = groups.flatMap(({ label, items }) => items.map((entity) => ({ label, entity })))
  const lastPage = Math.max(0, Math.ceil((entries.length - PORTRAITS_PER_SHEET) / PORTRAITS_PER_SPREAD))
  const currentPage = Math.min(turn.page, lastPage)
  const first = currentPage === 0
  const start = first ? 0 : PORTRAITS_PER_SHEET + (currentPage - 1) * PORTRAITS_PER_SPREAD
  const sheetStarts = first ? [start] : [start, start + PORTRAITS_PER_SHEET]

  function turnPage(direction: number) {
    const page = currentPage + direction
    if (page >= 0 && page <= lastPage) onTurn({ page, direction })
  }

  return <section className={styles.album} data-first={first} aria-label="Álbum de retratos">
    <header className={styles.albumIntro}>
      <div hidden={!first} className={styles.albumHeading}>
        <p className={styles.albumKicker}>Catálogo do arquivo</p>
        <h1 className={styles.albumTitle}>
          <CutoutTitle text={entityType.pluralLabel} seed="character-album" size="clamp(1.15rem, 3.7cqi, 2.5rem)" x={0} y={0} />
        </h1>
      </div>
      <div className={styles.albumTools}>{toolbar}{createButton}</div>
      {first && <p className={styles.albumNote} role="status">{entries.length} {entries.length === 1 ? 'personagem' : 'personagens'}{entries.length !== total ? ` de ${total}` : ''}</p>}
    </header>
    <div className={styles.albumSheets}>
      {entries.length === 0 ? <div className={cn(styles.albumSheet, styles.albumEmpty)} role="status">
        <strong>{total === 0 ? 'O álbum está vazio' : 'Nenhum personagem encontrado'}</strong>
        <p>{total === 0 ? 'Crie um personagem para preencher a primeira página.' : 'Tente outro nome, apelido ou tag.'}</p>
      </div> : sheetStarts.map((sheetStart) => <div className={styles.albumSheet} key={sheetStart}>
        <div className={styles.albumPortraits} data-turn={turn.direction}>
          {entries.slice(sheetStart, sheetStart + PORTRAITS_PER_SHEET).map(({ label, entity }) => <EntityCard key={entity.id} entity={entity} entityType={entityType}
            variant="portrait" contextLabel={showGroup ? label : undefined} />)}
        </div>
      </div>)}
    </div>
    <nav className={styles.albumNavigation} aria-label="Páginas do álbum">
      {first ? <Link href="/codex?pagina=character"><ChevronLeft aria-hidden="true" />Voltar ao início</Link>
        : <button type="button" onClick={() => turnPage(-1)}>
        <ChevronLeft aria-hidden="true" />Página anterior
      </button>}
      {lastPage > 0 && <span role="status">Página {currentPage + 1} de {lastPage + 1}</span>}
      {lastPage > 0 && <button type="button" aria-disabled={currentPage === lastPage} onClick={() => turnPage(1)}>
        Próxima página<ChevronRight aria-hidden="true" />
      </button>}
    </nav>
  </section>
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
