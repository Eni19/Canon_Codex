'use client'

import { lazy, Suspense, useState, type ComponentProps, type ReactNode } from 'react'
import Link from 'next/link'
import { CalendarCog, ChevronDown, Moon, Palette, Sprout, Tags, type LucideIcon } from 'lucide-react'
import type { Calendar } from '@/domain/worlds/calendar'
import type { CalendarMoon } from '@/domain/worlds/calendar-moon'
import type { CalendarSeason } from '@/domain/worlds/calendar-season'
import type { CalendarLandmarks } from '@/domain/worlds/calendar-landmarks'
import type { CalendarExactDate } from '@/domain/worlds/calendar-exact-date'
import type { CalendarAppearance } from '@/domain/worlds/calendar-appearance'

const CalendarSettingsForm = lazy(() => import('./calendar-settings-form').then((module) => ({ default: module.CalendarSettingsForm })))
const CalendarMoonsForm = lazy(() => import('./calendar-moons-form').then((module) => ({ default: module.CalendarMoonsForm })))
const CalendarSeasonsForm = lazy(() => import('./calendar-seasons-form').then((module) => ({ default: module.CalendarSeasonsForm })))
const CalendarLandmarksForm = lazy(() => import('./calendar-landmarks-form').then((module) => ({ default: module.CalendarLandmarksForm })))
const CalendarAppearanceForm = lazy(() => import('./calendar-appearance-form').then((module) => ({ default: module.CalendarAppearanceForm })))

function EditorPanel({ id, icon: Icon, title, description, children }: { id: string; icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  const [opened, setOpened] = useState(false)
  return <details id={id} className="group mb-2 rounded-lg border bg-card" onToggle={(event) => { if (event.currentTarget.open) setOpened(true) }}>
    <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg p-3 hover:bg-muted [&::-webkit-details-marker]:hidden sm:p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-primary"><Icon size={18} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block font-serif text-base font-semibold">{title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{description}</span></span>
      <ChevronDown size={16} aria-hidden="true" className="shrink-0 group-open:rotate-180" />
    </summary>
    {opened && <div className="border-t p-2 sm:p-4"><Suspense fallback={<p role="status" className="text-sm">Carregando editor…</p>}>{children}</Suspense></div>}
  </details>
}

export function CalendarAppearancePanel(props: { initialAppearance: CalendarAppearance; worldId: string; preview: ComponentProps<typeof CalendarAppearanceForm>['preview'] }) {
  return <EditorPanel id="aparencia" icon={Palette} title="Aparência" description="Temas, cores e imagem de capa"><CalendarAppearanceForm {...props} /></EditorPanel>
}

export function CalendarLandmarksPanel({ initialLandmarks, calendar, worldId, initialDate }: { initialLandmarks: CalendarLandmarks; calendar: Calendar; worldId: string; initialDate: CalendarExactDate }) {
  return <EditorPanel id="marcos" icon={Tags} title="Marcos e categorias" description="Festivais, feriados e datas importantes"><CalendarLandmarksForm initialLandmarks={initialLandmarks} calendar={calendar} worldId={worldId} initialDate={initialDate} /></EditorPanel>
}

export function CalendarSeasonsPanel({ initialSeasons, calendar, worldId }: { initialSeasons: CalendarSeason[]; calendar: Calendar; worldId: string }) {
  return <EditorPanel id="estacoes" icon={Sprout} title="Estações" description="Datas de início e cores na grade"><CalendarSeasonsForm initialSeasons={initialSeasons} calendar={calendar} worldId={worldId} /></EditorPanel>
}

export function CalendarMoonsPanel({ initialMoons, calendar, worldId, initialDate }: { initialMoons: CalendarMoon[]; calendar: Calendar; worldId: string; initialDate: CalendarExactDate }) {
  return <EditorPanel id="luas" icon={Moon} title="Luas" description="Nomes, cores e ciclos lunares"><CalendarMoonsForm initialMoons={initialMoons} calendar={calendar} worldId={worldId} initialDate={initialDate} /></EditorPanel>
}

/** The structural editor is loaded only after opening its disclosure. */
export function CalendarEditorPanel({ initialCalendar, worldId }: { initialCalendar: Calendar; worldId: string }) {
  return <EditorPanel id="editar" icon={CalendarCog} title="Estrutura" description="Meses, semana, eras e dias intercalares">
    <CalendarSettingsForm initialCalendar={initialCalendar} worldId={worldId} />
    <div className="mt-4 flex flex-wrap gap-3 text-sm"><Link href="/calendar/migration" className="underline">Converter datas antigas</Link><Link href="/calendar/origin" className="underline">Gerenciar Evento de origem</Link></div>
  </EditorPanel>
}
