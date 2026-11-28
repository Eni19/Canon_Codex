'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Boxes, CalendarDays, Clapperboard, Contrast, EyeOff, GripVertical, Layers, LayoutDashboard, LayoutList, Music, Network, Palette, RotateCcw, Sparkles, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { updateWorldPreferencesAction } from '@/app/actions/world-preferences'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { EntityTypeSwatch } from '@/components/entities/entity-type-swatch'
import { getCardDisplay, readCardTextureSetting, writeCardTextureSetting, type CardTextureSetting } from '@/lib/canvas/cardDisplay'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { CONTENT_GUIDE, INTERACTIVE_INTERFACES, TOOL_GUIDE, TOOL_IDS, moveInOrder, orderByPreference, type ToolId, type WorldPreferences } from '@/domain/worlds/worldPreferences'

const TOOL_ICONS: Record<ToolId, ReactNode> = {
  calendar: <CalendarDays className="size-4" />,
  relationships: <Network className="size-4" />,
  boards: <LayoutDashboard className="size-4" />,
  scenes: <Clapperboard className="size-4" />,
  soundtrack: <Music className="size-4" />,
}

type Tab = 'content' | 'tools' | 'interfaces' | 'appearance'
const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: 'content', label: 'Conteúdos', icon: <Boxes className="size-4" /> },
  { id: 'tools', label: 'Ferramentas', icon: <Wrench className="size-4" /> },
  { id: 'interfaces', label: 'Interfaces', icon: <Sparkles className="size-4" /> },
  { id: 'appearance', label: 'Aparência', icon: <Palette className="size-4" /> },
]

const TEXTURE_CHOICES: Array<{ id: CardTextureSetting; title: string; text: string; icon: ReactNode }> = [
  { id: 'normal', title: 'Normal', text: 'Cada tipo tem uma textura discreta no fundo do cartão.', icon: <Layers className="size-4" /> },
  { id: 'subtle', title: 'Sutil', text: 'A mesma textura, com metade da intensidade.', icon: <Contrast className="size-4" /> },
  { id: 'off', title: 'Desligada', text: 'Só o contorno e o ícone distinguem os tipos.', icon: <EyeOff className="size-4" /> },
]

/** Texture strength of the record cards in the graph and the boards. It belongs to this browser. */
function CardTextureChoice() {
  const [setting, setSetting] = useState(readCardTextureSetting)
  const highContrast = getCardDisplay().strongOutline
  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Textura dos cartões">
      {TEXTURE_CHOICES.map((choice) => <Choice key={choice.id} selected={setting === choice.id} icon={choice.icon} title={choice.title} text={choice.text}
        onSelect={() => { writeCardTextureSetting(choice.id); setSetting(choice.id) }} />)}
    </div>
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
      {['character', 'location', 'event', 'document'].map((id) => <EntityTypeSwatch key={id} typeId={id} />)}
    </div>
    {highContrast && <p className="text-xs text-muted-foreground" role="status">O alto contraste do sistema está ativo: os cartões ficam sem textura e com contorno reforçado, qualquer que seja a escolha.</p>}
  </div>
}

/**
 * Configurações do Codex: quais conteúdos e ferramentas aparecem na barra lateral e se as páginas
 * com interface interativa (caixa-arquivo, parede, bancada) usam a versão interativa ou a prática.
 * Cada mudança é gravada na hora no mundo; se falhar, volta ao que estava e avisa.
 */
export function CodexSettingsDialog({ open, onOpenChange, worldId, entityTypes, preferences }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  entityTypes: EntityTypeDefinition[]
  preferences: WorldPreferences
}) {
  const [tab, setTab] = useState<Tab>('content')
  const [draft, setDraft] = useState(preferences)
  const [saved, setSaved] = useState(preferences)
  const [pending, startTransition] = useTransition()
  // Preferências novas vindas do servidor (outra aba, outro Codex) substituem o rascunho.
  const [source, setSource] = useState(preferences)
  if (source !== preferences) { setSource(preferences); setDraft(preferences); setSaved(preferences) }

  const save = (next: WorldPreferences) => {
    setDraft(next)
    startTransition(async () => {
      const result = await updateWorldPreferencesAction(worldId, next)
      if (result.ok) { setSaved(result.preferences); setDraft(result.preferences) }
      else { setDraft(saved); toast.error(result.error) }
    })
  }
  const toggle = <K extends 'hiddenEntityTypes' | 'hiddenTools' | 'plainInterfaces'>(key: K, id: WorldPreferences[K][number], on: boolean) => {
    const current = draft[key] as string[]
    save({ ...draft, [key]: on ? [...current, id] : current.filter((item) => item !== id) })
  }

  const contentTypes = orderByPreference(entityTypes, draft.contentOrder).filter((type) => type.showInSidebar)
  const contentIds = contentTypes.map((type) => type.id)
  /** Leva o tipo `id` para a posição `to` e grava a ordem inteira. */
  const reorder = (id: string, to: number) => {
    const next = moveInOrder(contentIds, id, to)
    if (next.join() !== contentIds.join()) save({ ...draft, contentOrder: next })
  }
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const interactiveTypes = entityTypes.filter((type) => type.id in INTERACTIVE_INTERFACES)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(46rem,90dvh)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="font-serif text-xl">Configurações do Codex</DialogTitle>
          <DialogDescription>Escolha o que aparece na barra lateral e como as páginas se apresentam. As mudanças valem para este Codex e são salvas na hora.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav className="flex shrink-0 gap-1 border-b border-border p-2 md:w-48 md:flex-col md:border-r md:border-b-0" aria-label="Seções das configurações">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent', tab === item.id && 'bg-accent font-medium')}
              >
                {item.icon}{item.label}
              </button>
            ))}
            <p className="mt-auto hidden px-3 py-2 text-xs text-muted-foreground md:block" role="status">{pending ? 'Salvando…' : 'Tudo salvo'}</p>
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tab === 'content' && <Section title="Conteúdos" description="Desativado, o tipo some da barra lateral. Os registros continuam no Codex e podem ser abertos pela busca ou por links. Arraste pela alça (ou use as setas) para mudar a ordem da barra lateral e do caderno.">
              {draft.contentOrder.length > 0 && <button type="button" onClick={() => save({ ...draft, contentOrder: [] })} className="-mt-1 mb-1 flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <RotateCcw className="size-3.5" />Voltar à ordem padrão
              </button>}
              {contentTypes.map((type, index) => (
                <ItemCard
                  key={type.id}
                  order={{
                    position: index,
                    total: contentTypes.length,
                    onMove: (to) => reorder(type.id, to),
                    dragging: dragging === type.id,
                    over: over === type.id && dragging !== type.id,
                    onDragStart: () => setDragging(type.id),
                    onDragOver: () => setOver(type.id),
                    onDragEnd: () => { setDragging(null); setOver(null) },
                    onDrop: () => { if (dragging) reorder(dragging, index); setDragging(null); setOver(null) },
                  }}
                  icon={<EntityTypeIcon name={type.icon} className="size-4" />}
                  title={type.pluralLabel}
                  summary={CONTENT_GUIDE[type.id] ?? 'Tipo de conteúdo personalizado deste Codex.'}
                  partsLabel="Campos"
                  parts={type.properties.map((property) => property.label)}
                  enabled={!draft.hiddenEntityTypes.includes(type.id)}
                  onToggle={(on) => toggle('hiddenEntityTypes', type.id, !on)}
                />
              ))}
            </Section>}

            {tab === 'tools' && <Section title="Ferramentas" description="Desativada, a ferramenta some da barra lateral. Nada do que foi criado nela é apagado.">
              {TOOL_IDS.map((id) => (
                <ItemCard
                  key={id}
                  icon={TOOL_ICONS[id]}
                  title={TOOL_GUIDE[id].label}
                  summary={TOOL_GUIDE[id].summary}
                  partsLabel="O que tem"
                  parts={TOOL_GUIDE[id].parts}
                  enabled={!draft.hiddenTools.includes(id)}
                  onToggle={(on) => toggle('hiddenTools', id, !on)}
                />
              ))}
            </Section>}

            {tab === 'appearance' && <Section title="Aparência" description="Textura dos cartões de registro em Relacionamentos e Quadros. A escolha vale para este navegador, em todos os Codex; o contorno e o ícone de cada tipo continuam aparecendo.">
              <CardTextureChoice />
            </Section>}

            {tab === 'interfaces' && <Section title="Interfaces" description="Algumas páginas têm uma experiência interativa. Prefere algo mais direto? Escolha a versão prática: a mesma informação numa página única, organizada para achar rápido.">
              {interactiveTypes.map((type) => {
                const plain = draft.plainInterfaces.includes(type.id)
                const guide = INTERACTIVE_INTERFACES[type.id]
                return (
                  <div key={type.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium"><EntityTypeIcon name={type.icon} className="size-4 text-primary" />{type.pluralLabel}</div>
                    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Interface de ${type.pluralLabel}`}>
                      <Choice selected={!plain} icon={<Sparkles className="size-4" />} title="Interativa" text={guide.interactive} onSelect={() => plain && toggle('plainInterfaces', type.id, false)} />
                      <Choice selected={plain} icon={<LayoutList className="size-4" />} title="Prática" text={guide.plain} onSelect={() => !plain && toggle('plainInterfaces', type.id, true)} />
                    </div>
                  </div>
                )
              })}
            </Section>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section>
    <h2 className="font-serif text-lg">{title}</h2>
    <p className="mt-1 mb-4 text-sm text-muted-foreground">{description}</p>
    <div className="grid gap-3">{children}</div>
  </section>
}

type Ordering = {
  position: number
  total: number
  onMove: (to: number) => void
  dragging: boolean
  over: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDragEnd: () => void
  onDrop: () => void
}

/**
 * Cartão de um conteúdo ou ferramenta: nome, resumo, o que tem dentro e o interruptor. Com
 * `order`, ganha a alça de arrastar e as setas para mudar a posição.
 */
function ItemCard({ icon, title, summary, partsLabel, parts, enabled, onToggle, order }: {
  icon: ReactNode; title: string; summary: string; partsLabel: string; parts: string[]; enabled: boolean; onToggle: (on: boolean) => void; order?: Ordering
}) {
  return (
    <div
      className={cn('rounded-lg border border-border p-4 transition-[opacity,box-shadow]', !enabled && 'opacity-60', order?.dragging && 'opacity-40', order?.over && 'ring-2 ring-primary')}
      draggable={Boolean(order)}
      onDragStart={order ? (event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', title); order.onDragStart() } : undefined}
      onDragOver={order ? (event) => { event.preventDefault(); order.onDragOver() } : undefined}
      onDragEnd={order?.onDragEnd}
      onDrop={order ? (event) => { event.preventDefault(); order.onDrop() } : undefined}
    >
      <div className="flex items-start gap-3">
        {order && <div className="-ml-1 flex shrink-0 flex-col items-center gap-0.5 text-muted-foreground">
          <span className="cursor-grab active:cursor-grabbing" title="Arraste para mudar a ordem" aria-hidden="true"><GripVertical className="size-4" /></span>
          <button type="button" onClick={() => order.onMove(order.position - 1)} disabled={order.position === 0} aria-label={`Subir ${title}`} className="rounded p-0.5 hover:bg-accent hover:text-foreground disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
          <button type="button" onClick={() => order.onMove(order.position + 1)} disabled={order.position === order.total - 1} aria-label={`Descer ${title}`} className="rounded p-0.5 hover:bg-accent hover:text-foreground disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
        </div>}
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">{title}</h3>
            <Switch checked={enabled} onChange={onToggle} label={`${enabled ? 'Desativar' : 'Ativar'} ${title}`} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
          {parts.length > 0 && <div className="mt-3">
            <p className="mb-1.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">{partsLabel}</p>
            <ul className="flex flex-wrap gap-1.5">{parts.map((part) => <li key={part} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs">{part}</li>)}</ul>
          </div>}
        </div>
      </div>
    </div>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', checked ? 'bg-primary' : 'bg-muted')}
    >
      <span className={cn('inline-block size-3.5 rounded-full bg-background shadow transition-transform', checked ? 'translate-x-[1.05rem]' : 'translate-x-0.5')} />
    </button>
  )
}

function Choice({ selected, icon, title, text, onSelect }: { selected: boolean; icon: ReactNode; title: string; text: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn('flex flex-col gap-1 rounded-md border p-3 text-left transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', selected ? 'border-primary bg-primary/10' : 'border-border')}
    >
      <span className="flex items-center gap-2 text-sm font-medium">{icon}{title}{selected && <span className="ml-auto text-[0.65rem] tracking-wide text-primary uppercase">em uso</span>}</span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </button>
  )
}
