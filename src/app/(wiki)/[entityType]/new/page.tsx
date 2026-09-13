import { notFound } from 'next/navigation'
import { createEntityAction } from '@/app/actions/entities'
import { CharacterThemePicker } from '@/components/entities/character-theme-picker'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageContainer } from '@/components/wiki/page-container'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function NewEntityPage(props: PageProps<'/[entityType]/new'>) {
  const { entityType: entityTypeId } = await props.params
  const world = await getCurrentWorld()
  const entityType = world.entityTypes.find((type) => type.id === entityTypeId)
  if (!entityType) notFound()

  return (
    <PageContainer className="max-w-lg">
      <Breadcrumbs
        items={[
          { label: world.name, href: '/codex' },
          { label: entityType.pluralLabel, href: `/${entityType.id}` },
          { label: 'Nova' },
        ]}
      />
      <h1 className="mt-3 font-serif text-2xl font-medium">Nova {entityType.label.toLowerCase()}</h1>

      <form action={createEntityAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="type" value={entityType.id} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" required autoFocus placeholder={`Nome ${entityType.label.toLowerCase()}...`} />
        </div>
        {entityType.id !== 'evidence' && <div className="flex flex-col gap-1.5">
          <Label htmlFor="aliases">
            Apelidos <span className="font-normal text-muted-foreground">(separados por vírgula)</span>
          </Label>
          <Input id="aliases" name="aliases" />
        </div>}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tags">
            Tags <span className="font-normal text-muted-foreground">(separadas por vírgula)</span>
          </Label>
          <Input id="tags" name="tags" />
        </div>
        <div>
          {(entityType.layout.includes('portraitHero') || entityType.id === 'location' || entityType.id === 'creature' || entityType.id === 'cosmology' || entityType.id === 'tale') && <CharacterThemePicker label={entityType.id === 'location' ? 'Cor do local' : entityType.id === 'creature' ? 'Cor da criatura' : entityType.id === 'cosmology' ? 'Paleta da entidade' : entityType.id === 'tale' ? 'Cor editorial' : 'Cor do personagem'} />}
        </div>
        <div>
          <Button type="submit">Criar e continuar editando</Button>
        </div>
      </form>
    </PageContainer>
  )
}


