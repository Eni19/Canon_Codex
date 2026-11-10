'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { animate, stagger } from 'animejs'
import { AtSign, CircleAlert, Crop, Loader2, Tag } from 'lucide-react'
import type { EntityFormState } from '@/app/actions/entities'
import { ArtifactDetailsEditor } from '@/components/entities/artifact-details-editor'
import { CharacterThemePicker } from '@/components/entities/character-theme-picker'
import { ConceptBlocksEditor } from '@/components/entities/concept-blocks-editor'
import { DeleteEntityButton } from '@/components/entities/delete-entity-button'
import { EvidenceFindingsEditor } from '@/components/entities/evidence-findings-editor'
import { LocationPointsEditor } from '@/components/entities/location-points-editor'
import { OrganizationGroupsEditor } from '@/components/entities/organization-groups-editor'
import { PropertyField } from '@/components/entities/property-field'
import { ReferenceSelectionProvider } from '@/components/entities/reference-selection-context'
import { ImageField } from '@/components/entities/entity-editor/image-field'
import { CoverFramingStudio, type FramingPreviewSnapshot } from '@/components/entities/entity-editor/cover-framing-studio'
import { CharacterFramingPreview, CreatureFramingPreview } from '@/components/entities/entity-editor/framing-previews'
import { ContentEditor } from '@/components/editor/content-editor'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArtifactDetailsSchema } from '@/domain/entities/artifactDetail'
import type { CharacterTheme } from '@/domain/entities/characterTheme'
import { ConceptBlocksSchema } from '@/domain/entities/conceptBlock'
import { defaultCoverFraming, isDefaultCoverFraming, readCoverFraming } from '@/domain/entities/coverFraming'
import { emptyContentDocument, CONTENT_SCHEMA_VERSION } from '@/domain/content/contentDocument'
import type { Entity } from '@/domain/entities/entity'
import { contentRules, coverLabel, supportsAliases, supportsCover, supportsCoverFraming, supportsStatus, supportsSymbol, supportsTheme, themeLabel } from '@/domain/entities/entityFormRules'
import type { EntityTypeDefinition, PropertyDefinition } from '@/domain/entities/entityType'
import { EvidenceFindingsSchema } from '@/domain/entities/evidenceFinding'
import { LocationPointsSchema } from '@/domain/entities/locationPoint'
import { OrganizationGroupsSchema } from '@/domain/entities/organizationGroup'
import type { Calendar } from '@/domain/worlds/calendar'
import type { EntityEditorData } from '@/services/entities/getEntityEditorData'
import { cn } from '@/lib/utils'

const FORM_ID = 'entity-form'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Long prose fields get the full main column; everything else goes into the two-column sheet. */
const isLongField = (property: PropertyDefinition) => property.kind === 'textarea'
const isWideField = (property: PropertyDefinition) => property.kind === 'referenceList' || property.kind === 'date'

export interface EntityEditorProps {
  mode: 'create' | 'edit'
  entityType: EntityTypeDefinition
  entity?: Entity
  worldName: string
  calendar: Calendar
  hasOriginEvent: boolean
  data: EntityEditorData
  action: (formData: FormData) => Promise<EntityFormState>
  deleteAction?: () => Promise<void>
}

/**
 * The single entity form, for creating and editing alike. Layout: the record's words on the left
 * (name, sheet, long texts, content), its visual identity on a sticky right rail (images, color,
 * status). The chosen color re-tints the whole form live.
 */
export function EntityEditor({ mode, entityType, entity, worldName, calendar, hasOriginEvent, data, action, deleteAction }: EntityEditorProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [theme, setTheme] = useState<CharacterTheme>(entity?.theme ?? 'amber')
  const [coverId, setCoverId] = useState<string | undefined>(entity?.coverAssetId)
  const typeFraming = defaultCoverFraming(entityType)
  const [framing, setFraming] = useState(() => readCoverFraming(entity?.properties.coverFraming, typeFraming))
  const [studio, setStudio] = useState<FramingPreviewSnapshot | null>(null)
  const framingButtonRef = useRef<HTMLButtonElement>(null)

  const values = entity?.properties ?? {}
  const shortFields = entityType.properties.filter((property) => !isLongField(property))
  const longFields = entityType.properties.filter(isLongField)
  const content = contentRules(entityType)
  const themed = supportsTheme(entityType)
  const cancelHref = entity ? `/entity/${entity.id}` : `/${entityType.id}`
  const errorRef = useRef<HTMLParagraphElement>(null)

  // One choreographed entrance: the header stays put; the form's blocks rise in, in reading order.
  // Layout effect = runs before paint, so blocks never flash visible and then jump back.
  useLayoutEffect(() => {
    const blocks = Array.from(formRef.current?.querySelectorAll<HTMLElement>('[data-reveal]') ?? [])
    if (blocks.length === 0 || prefersReducedMotion()) return
    blocks.sort((a, b) => Number(a.dataset.reveal) - Number(b.dataset.reveal))
    for (const block of blocks) { block.style.opacity = '0'; block.style.transform = 'translateY(18px)' }
    const animation = animate(blocks, {
      opacity: { from: 0, to: 1, duration: 420, ease: 'outQuad' },
      translateY: { from: 18, to: 0, duration: 720, ease: 'outExpo' },
      delay: stagger(55),
      // Leave no inline transform behind: it would trap fixed-position descendants.
      onComplete: () => blocks.forEach((block) => { block.style.removeProperty('transform'); block.style.removeProperty('opacity') }),
    })
    return () => { animation.revert() }
  }, [])

  useEffect(() => {
    if (!error || !errorRef.current || prefersReducedMotion()) return
    const animation = animate(errorRef.current, { opacity: { from: 0, to: 1 }, translateY: { from: -6, to: 0 }, duration: 320, ease: 'outCubic' })
    errorRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    return () => { animation.revert() }
  }, [error])

  // Ctrl/Cmd+S saves from anywhere in the form, as in any editor.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        formRef.current?.requestSubmit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (!dirty || pending) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, pending])

  // The preview shows what the page would show now, including unsaved edits in the form.
  function openFramingStudio() {
    if (!formRef.current) return
    const form = new FormData(formRef.current)
    const text = (key: string) => String(form.get(key) ?? '').trim()
    const properties: Record<string, unknown> = {}
    for (const property of entityType.properties) properties[property.key] = form.get(property.key) ?? undefined
    let content = emptyContentDocument()
    try {
      const pages: unknown = JSON.parse(text('content') || 'null')
      if (Array.isArray(pages) && pages.length > 0) content = { format: 'tiptap-json', schemaVersion: CONTENT_SCHEMA_VERSION, pages }
    } catch { /* keep the empty document */ }
    setStudio({ title: text('title') || 'Sem nome', status: text('status'), tags: text('tags').split(',').map((tag) => tag.trim()).filter(Boolean), aliases: text('aliases').split(',').map((alias) => alias.trim()).filter(Boolean), properties, content })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Not `<form action>`: React resets uncontrolled fields after a form action, which would wipe
    // everything typed when the server answers with a validation error.
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await action(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div data-character-theme={themed ? theme : undefined} className="min-h-full">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-6 border-b border-border bg-background/90 px-8 backdrop-blur-sm">
        <Breadcrumbs items={[
          { label: worldName, href: '/codex' },
          { label: entityType.pluralLabel, href: `/${entityType.id}` },
          ...(entity ? [{ label: entity.title, href: `/entity/${entity.id}` }, { label: 'Editar' }] : [{ label: 'Novo registro' }]),
        ]}/>
        <div className="flex shrink-0 items-center gap-2">
          <span className="mr-2 hidden text-xs text-muted-foreground lg:inline">
            <kbd className="rounded border border-border px-1 py-0.5 font-sans text-[0.7rem]">Ctrl</kbd> <kbd className="rounded border border-border px-1 py-0.5 font-sans text-[0.7rem]">S</kbd> para salvar
          </span>
          {deleteAction && entity && <DeleteEntityButton action={deleteAction} label={entity.title}/>}
          <Button asChild variant="ghost">
            <Link href={cancelHref} replace onClick={(event) => { if (dirty && !window.confirm('Descartar as alterações não salvas?')) event.preventDefault() }}>Cancelar</Link>
          </Button>
          <Button type="submit" form={FORM_ID} disabled={pending} className="min-w-32 transition-[background-color,transform] active:scale-[0.97]">
            {pending ? <><Loader2 className="animate-spin"/>Salvando…</> : mode === 'create' ? 'Criar registro' : 'Salvar alterações'}
          </Button>
        </div>
      </header>

      <ReferenceSelectionProvider initial={data.initialSelections}>
        <form id={FORM_ID} ref={formRef} onSubmit={handleSubmit} onInput={() => setDirty(true)} className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_19rem] items-start gap-x-14 px-8 pt-10 pb-24">
          <input type="hidden" name="type" value={entityType.id}/>

          <div className="flex min-w-0 flex-col gap-12">
            <section aria-label="Identificação" data-reveal={0}>
              {error && <p ref={errorRef} role="alert" className="mb-6 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0"/>{error}</p>}
              <label className="group/title relative block">
                <span className="sr-only">Título</span>
                <input
                  name="title"
                  required
                  autoFocus={mode === 'create'}
                  defaultValue={entity?.title}
                  placeholder="Dê um nome a este registro"
                  autoComplete="off"
                  className="w-full bg-transparent pb-2 font-serif text-4xl font-medium tracking-tight outline-none placeholder:text-muted-foreground/45"
                />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-border"/>
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-within/title:scale-x-100"/>
              </label>
              <div className={cn('mt-4 grid gap-3', supportsAliases(entityType) ? 'grid-cols-2' : 'grid-cols-1')}>
                {supportsAliases(entityType) && <InlineField icon={<AtSign/>} name="aliases" label="Apelidos" placeholder="Outros nomes, separados por vírgula" defaultValue={entity?.aliases.join(', ')}/>}
                <InlineField icon={<Tag/>} name="tags" label="Tags" placeholder="Tags, separadas por vírgula" defaultValue={entity?.tags.join(', ')}/>
              </div>
            </section>

            {(shortFields.length > 0 || (mode === 'create' && entityType.id === 'event')) && <EditorSection title="Ficha" reveal={2}>
              <div className="grid grid-cols-2 gap-x-5 gap-y-5">
                {shortFields.map((property) => <div key={property.key} className={isWideField(property) ? 'col-span-2' : undefined}>
                  <PropertyField property={property} defaultValue={values[property.key]} referenceOptions={data.referenceOptionsByKey[property.key]} calendar={calendar}/>
                </div>)}
              </div>
              {mode === 'create' && entityType.id === 'event' && <label className="mt-5 flex items-start gap-2.5 rounded-md bg-surface px-3 py-3 text-sm">
                <input type="checkbox" name="isOrigin" value="yes" disabled={hasOriginEvent} className="mt-0.5 accent-(--primary)"/>
                <span>Marcar como Evento de origem do calendário. A data informada será colocada no ano zero.{hasOriginEvent ? ' Já existe uma origem; substitua-a no calendário.' : ''}</span>
              </label>}
            </EditorSection>}

            {longFields.length > 0 && <EditorSection title="Detalhes" reveal={3}>
              <div className="flex flex-col gap-5">
                {longFields.map((property) => <div key={property.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={'property-' + property.key}>{property.label}</Label>
                  <textarea
                    id={'property-' + property.key}
                    name={property.key}
                    defaultValue={typeof values[property.key] === 'string' ? values[property.key] as string : ''}
                    className="field-sizing-content min-h-28 w-full rounded-lg border border-input bg-input/30 px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>)}
              </div>
            </EditorSection>}

            <StructuredEditor entityType={entityType} values={values} coverId={coverId} data={data}/>

            <EditorSection title={content.label} reveal={5}>
              <ContentEditor content={data.content} theme={themed ? theme : entity?.theme} maxPages={content.maxPages} pageNoun={content.pageNoun}/>
            </EditorSection>
          </div>

          <aside aria-label="Identidade visual" data-reveal={1} className="sticky top-24 flex flex-col gap-8">
            {supportsCover(entityType) && <ImageField
              name="coverAssetId"
              label={coverLabel(entityType)}
              hint={entityType.id === 'tale' ? 'Única imagem do conto; também aparece no cartão de prévia.' : undefined}
              initialAssetId={entity?.coverAssetId}
              onChange={(id) => { setCoverId(id ?? undefined); setFraming(typeFraming); setDirty(true) }}
              aspect={entityType.id === 'tale' ? 'aspect-3/4' : 'aspect-4/3'}
            />}
            {supportsCoverFraming(entityType) && <div className="-mt-5 flex items-center justify-between gap-2">
              <input type="hidden" name="coverFraming" value={JSON.stringify(framing)}/>
              <Button ref={framingButtonRef} type="button" variant="outline" size="sm" disabled={!coverId} onClick={openFramingStudio} title={coverId ? undefined : 'Escolha uma imagem primeiro'}>
                <Crop/>Ajustar enquadramento
              </Button>
              <span className="text-xs text-muted-foreground">{isDefaultCoverFraming(framing, typeFraming) ? 'Padrão' : 'Personalizado'}</span>
            </div>}
            {supportsSymbol(entityType) && <ImageField
              name="symbolAssetId"
              label="Selo ou símbolo"
              hint="Imagem simples, de preferência PNG com fundo transparente."
              initialAssetId={typeof values.symbolAssetId === 'string' ? values.symbolAssetId : undefined}
              onChange={() => setDirty(true)}
              aspect="aspect-[2/1]"
              contain
            />}
            {themed && <CharacterThemePicker value={theme} label={themeLabel(entityType)} onChange={(next) => { setTheme(next); setDirty(true) }}/>}
            {supportsStatus(entityType) && <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Input id="status" name="status" defaultValue={entity?.status ?? ''} placeholder="Ex.: rascunho, canônico"/>
            </div>}
          </aside>
        </form>
      </ReferenceSelectionProvider>

      {studio && coverId && <CoverFramingStudio
        initialFraming={framing}
        defaultFraming={typeFraming}
        theme={theme}
        renderPreview={(current) => {
          const Preview = entityType.id === 'creature' ? CreatureFramingPreview : CharacterFramingPreview
          return <Preview
            framing={current}
            coverAssetId={coverId}
            entityType={entityType}
            worldName={worldName}
            calendar={calendar}
            titleById={Object.fromEntries(Object.values(data.referenceOptionsByKey).flat().map((option) => [option.id, option.title]))}
            snapshot={studio}
          />
        }}
        onApply={(next) => { setFraming(next); setDirty(true) }}
        onClose={() => { setStudio(null); framingButtonRef.current?.focus() }}
      />}
    </div>
  )
}

function EditorSection({ title, children, reveal }: { title: string; children: ReactNode; reveal: number }) {
  return <section data-reveal={reveal}>
    <h2 className="mb-4 font-serif text-xl font-medium">{title}</h2>
    {children}
  </section>
}

function InlineField({ icon, name, label, placeholder, defaultValue }: { icon: ReactNode; name: string; label: string; placeholder: string; defaultValue?: string }) {
  return <label className="flex h-9 items-center gap-2 rounded-md bg-muted/60 px-3 text-sm text-muted-foreground transition-colors focus-within:bg-muted focus-within:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
    {icon}
    <span className="sr-only">{label}</span>
    <input name={name} defaultValue={defaultValue} placeholder={placeholder} autoComplete="off" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"/>
  </label>
}

/** Type-specific editors (points on a map, findings, groups, details, blocks). */
function StructuredEditor({ entityType, values, coverId, data }: { entityType: EntityTypeDefinition; values: Record<string, unknown>; coverId?: string; data: EntityEditorData }) {
  let editor: ReactNode = null
  if (entityType.id === 'location') {
    const parsed = LocationPointsSchema.safeParse(values.pointsOfInterest)
    editor = <LocationPointsEditor coverAssetId={coverId} initialPoints={parsed.success ? parsed.data : []} targets={data.pointTargets}/>
  } else if (entityType.id === 'evidence') {
    const parsed = EvidenceFindingsSchema.safeParse(values.evidenceFindings)
    editor = <EvidenceFindingsEditor initialFindings={parsed.success ? parsed.data : []}/>
  } else if (entityType.id === 'organization') {
    const parsed = OrganizationGroupsSchema.safeParse(values.organizationGroups)
    editor = <OrganizationGroupsEditor initialGroups={parsed.success ? parsed.data : []} characters={data.referenceOptionsByKey.members ?? []}/>
  } else if (entityType.id === 'artifact') {
    const parsed = ArtifactDetailsSchema.safeParse(values.artifactDetails)
    editor = <ArtifactDetailsEditor coverAssetId={coverId} initialDetails={parsed.success ? parsed.data : []}/>
  } else if (entityType.id === 'concept') {
    const parsed = ConceptBlocksSchema.safeParse(values.conceptBlocks)
    editor = <ConceptBlocksEditor initialBlocks={parsed.success ? parsed.data : []}/>
  }
  if (!editor) return null
  return <section data-reveal={4}>{editor}</section>
}
