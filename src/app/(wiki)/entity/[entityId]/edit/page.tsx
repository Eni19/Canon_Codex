import { notFound } from 'next/navigation'
import { deleteEntityAction, updateEntityAction } from '@/app/actions/entities'
import { importCosmologySymbolAction, importCoverImageAction, removeCoverImageAction } from '@/app/actions/assets'
import { AssetPicker } from '@/components/entities/asset-picker'
import { CharacterThemePicker } from '@/components/entities/character-theme-picker'
import { LocationPointsEditor, type LocationPointTarget } from '@/components/entities/location-points-editor'
import { EvidenceFindingsEditor } from '@/components/entities/evidence-findings-editor'
import { OrganizationGroupsEditor } from '@/components/entities/organization-groups-editor'
import { ArtifactDetailsEditor } from '@/components/entities/artifact-details-editor'
import { ConceptBlocksEditor } from '@/components/entities/concept-blocks-editor'
import { DeleteEntityButton } from '@/components/entities/delete-entity-button'
import type { ReferenceOption } from '@/components/entities/property-field'
import { PropertyList } from '@/components/entities/property-list'
import { ContentEditor } from '@/components/editor/content-editor'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageContainer } from '@/components/wiki/page-container'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'
import { LocationPointsSchema } from '@/domain/entities/locationPoint'
import { EvidenceFindingsSchema } from '@/domain/entities/evidenceFinding'
import { OrganizationGroupsSchema } from '@/domain/entities/organizationGroup'
import { ArtifactDetailsSchema } from '@/domain/entities/artifactDetail'
import { ConceptBlocksSchema } from '@/domain/entities/conceptBlock'

export default async function EditEntityPage(props: PageProps<'/entity/[entityId]/edit'>) {
  const { entityId } = await props.params
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const entity = await repo.getEntity(world.id, entityId)
  if (!entity) notFound()
  const entityType = world.entityTypes.find((type) => type.id === entity.type)
  if (!entityType) notFound()

  const referenceOptionsByKey: Record<string, ReferenceOption[]> = {}
  for (const property of entityType.properties) {
    if (property.kind !== 'reference' && property.kind !== 'referenceList') continue
    if (!property.refType) continue
    const candidates = await repo.listEntities(world.id, { type: property.refType })
    referenceOptionsByKey[property.key] = candidates
      .filter((candidate) => candidate.id !== entity.id)
      .sort((left, right) => left.title.localeCompare(right.title, 'pt-BR'))
      .map((candidate) => ({ id: candidate.id, title: candidate.title }))
  }

  const content = await repo.getContent(world.id, entity.id)
  const pointTargets: LocationPointTarget[] = entity.type === 'location'
    ? (await repo.listEntities(world.id))
        .filter((candidate) => candidate.type === 'evidence' || candidate.type === 'document')
        .map((candidate) => ({ id: candidate.id, title: candidate.title, type: candidate.type as 'evidence' | 'document' }))
    : []
  const parsedPoints = LocationPointsSchema.safeParse(entity.properties.pointsOfInterest)
  const parsedFindings = EvidenceFindingsSchema.safeParse(entity.properties.evidenceFindings)
  const parsedOrganizationGroups = OrganizationGroupsSchema.safeParse(entity.properties.organizationGroups)
  const parsedArtifactDetails = ArtifactDetailsSchema.safeParse(entity.properties.artifactDetails)
  const parsedConceptBlocks = ConceptBlocksSchema.safeParse(entity.properties.conceptBlocks)

  const boundUpdate = updateEntityAction.bind(null, entity.id)
  const boundDelete = deleteEntityAction.bind(null, entity.id, entityType.id)
  const boundImportCover = importCoverImageAction.bind(null, entity.id)
  const boundRemoveCover = removeCoverImageAction.bind(null, entity.id)
  const boundImportSymbol = importCosmologySymbolAction.bind(null, entity.id)

  return (
    <PageContainer className="max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Breadcrumbs
          items={[
            { label: world.name, href: '/codex' },
            { label: entityType.pluralLabel, href: `/${entityType.id}` },
            { label: entity.title, href: `/entity/${entity.id}` },
            { label: 'Editar' },
          ]}
        />
        <DeleteEntityButton action={boundDelete} label={entity.title} />
      </div>
      <h1 className="mt-3 font-serif text-2xl font-medium">Editar {entityType.label.toLowerCase()}</h1>

      {!['tale', 'concept'].includes(entity.type) && <div className="mt-6">
        <Label>{entity.type === 'cosmology' ? 'Arte principal' : 'Imagem principal'}</Label>
        <div className="mt-1.5"><AssetPicker currentAssetId={entity.coverAssetId} importAction={boundImportCover} /></div>
      </div>}

      {entity.type === 'tale' && <section className="mt-6 border-y border-border py-5">
        <p className="font-mono text-[0.6rem] tracking-[0.16em] text-primary uppercase">Capa da obra</p>
        <div className="mt-4">
          <Label>Imagem de capa</Label>
          <p className="mt-1 text-xs text-muted-foreground">Esta é a única imagem do conto e também aparece no cartão de prévia.</p>
          <div className="mt-2"><AssetPicker currentAssetId={entity.coverAssetId} importAction={boundImportCover} /></div>
          {entity.coverAssetId && <form action={boundRemoveCover} className="mt-2"><button type="submit" className="text-xs text-destructive hover:underline">Remover imagem de capa</button></form>}
        </div>
      </section>}

      {entity.type === 'cosmology' && <div className="mt-6">
        <Label>Selo ou símbolo</Label>
        <p className="mt-1 text-xs text-muted-foreground">Use uma imagem simples, preferencialmente PNG com fundo transparente.</p>
        <div className="mt-1.5"><AssetPicker currentAssetId={typeof entity.properties.symbolAssetId === 'string' ? entity.properties.symbolAssetId : undefined} importAction={boundImportSymbol} contain /></div>
      </div>}

      <form action={boundUpdate} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5"><Label htmlFor="title">Título</Label><Input id="title" name="title" required defaultValue={entity.title} /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {entity.type !== 'evidence' && <div className="flex flex-col gap-1.5"><Label htmlFor="aliases">Apelidos <span className="font-normal text-muted-foreground">(separados por vírgula)</span></Label><Input id="aliases" name="aliases" defaultValue={entity.aliases.join(', ')} /></div>}
          <div className="flex flex-col gap-1.5"><Label htmlFor="tags">Tags <span className="font-normal text-muted-foreground">(separadas por vírgula)</span></Label><Input id="tags" name="tags" defaultValue={entity.tags.join(', ')} /></div>
        </div>
        {entity.type !== 'evidence' && <div className="flex flex-col gap-1.5 sm:w-1/2 sm:pr-2"><Label htmlFor="status">Status</Label><Input id="status" name="status" defaultValue={entity.status ?? ''} /></div>}

        {entityType.properties.length > 0 && <div className="mt-2 border-t border-border pt-4"><h2 className="mb-3 text-sm font-medium text-muted-foreground">Propriedades</h2><PropertyList properties={entityType.properties} values={entity.properties} referenceOptionsByKey={referenceOptionsByKey} /></div>}

        {entity.type === 'location' && <LocationPointsEditor coverAssetId={entity.coverAssetId} initialPoints={parsedPoints.success ? parsedPoints.data : []} targets={pointTargets} />}
        {entity.type === 'evidence' && <EvidenceFindingsEditor initialFindings={parsedFindings.success ? parsedFindings.data : []} />}
        {entity.type === 'organization' && <OrganizationGroupsEditor initialGroups={parsedOrganizationGroups.success ? parsedOrganizationGroups.data : []} characters={referenceOptionsByKey.members ?? []} />}
        {entity.type === 'artifact' && <ArtifactDetailsEditor coverAssetId={entity.coverAssetId} initialDetails={parsedArtifactDetails.success ? parsedArtifactDetails.data : []} />}
        {entity.type === 'concept' && <ConceptBlocksEditor initialBlocks={parsedConceptBlocks.success ? parsedConceptBlocks.data : []} />}

        {(entityType.layout.includes('portraitHero') || ['location', 'creature', 'cosmology', 'tale'].includes(entityType.id)) && <CharacterThemePicker value={entity.theme} label={entityType.id === 'location' ? 'Cor do local' : entityType.id === 'creature' ? 'Cor da criatura' : entityType.id === 'cosmology' ? 'Paleta da entidade' : entityType.id === 'tale' ? 'Cor editorial' : 'Cor do personagem'} />}

        <div className="mt-2 border-t border-border pt-4">
          <Label className="mb-1.5">{entity.type === 'tale' ? 'Capítulos' : entity.type === 'concept' ? 'Texto base' : 'Conteúdo'}</Label>
          <ContentEditor content={content} theme={entity.theme} maxPages={entity.type === 'tale' ? 50 : entity.type === 'concept' ? 1 : 2} pageNoun={entity.type === 'tale' ? 'capítulo' : 'página'} />
        </div>

        <div className="mt-2"><Button type="submit">Salvar</Button></div>
      </form>
    </PageContainer>
  )
}
