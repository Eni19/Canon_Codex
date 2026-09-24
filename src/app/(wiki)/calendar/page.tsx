import { CalendarDays } from 'lucide-react'
import { CalendarSettingsForm } from '@/components/calendar/calendar-settings-form'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { PageContainer } from '@/components/wiki/page-container'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function CalendarPage() {
  const world = await getCurrentWorld()

  return (
    <PageContainer className="max-w-5xl">
      <Breadcrumbs items={[{ label: world.name, href: '/codex' }, { label: 'Calendário' }]} />
      <header className="mt-3 mb-6 flex items-start gap-3">
        <CalendarDays className="mt-1 size-6 text-primary" />
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Calendário do mundo</p>
          <h1 className="mt-1 font-serif text-3xl font-medium">{world.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Configure nomes, durações, eras e dias intercalares. A configuração pertence somente a este mundo.</p>
        </div>
      </header>
      <CalendarSettingsForm initialCalendar={world.calendar} />
    </PageContainer>
  )
}
