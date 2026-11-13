import { CalendarCover, calendarThemeStyle } from '@/components/calendar/calendar-cover'
import { CalendarDayNavigation } from '@/components/calendar/calendar-day-navigation'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { CalendarAppearancePanel, CalendarEditorPanel, CalendarLandmarksPanel, CalendarMoonsPanel, CalendarSeasonsPanel } from '@/components/calendar/calendar-editor-panel'
import { CalendarVisualPrototype } from '@/components/calendar/calendar-visual-prototype'
import { MoonDisc } from '@/components/calendar/moon-disc'
import { CampaignTodayControls } from '@/components/calendar/campaign-today-controls'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { PageContainer } from '@/components/wiki/page-container'
import { dateToOrdinal, formatCalendarDate, getCalendarDateAtOrdinal, getCalendarYearLength, getMonthLength, isIntercalaryRuleActive, type Calendar } from '@/domain/worlds/calendar'
import { projectCalendarWindow } from '@/domain/worlds/calendar-projection'
import { projectCalendarLandmarks } from '@/domain/worlds/calendar-landmarks'
import { seasonAtDate } from '@/domain/worlds/calendar-season'
import { resolveCalendarTheme } from '@/domain/worlds/calendar-appearance'
import styles from './calendar.module.css'
import { projectAgenda } from '@/domain/worlds/calendar-agenda'
import { adjacentMonth } from '@/domain/worlds/calendar-view'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

type Query = { [key: string]: string | string[] | undefined }

function integer(value: string | string[] | undefined, fallback: number) {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return fallback
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : fallback
}

function validIntegerInput(value: string | string[] | undefined) {
  return value === undefined || (typeof value === 'string' && /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)))
}

function buildUrl(year: number, month: number, day = 1, view = 'month', page = 1, intercalary?: string, moonIds?: string[]) {
  const params = new URLSearchParams({ year: String(year), month: String(month), day: String(day), view, ...(page > 1 ? { page: String(page) } : {}), ...(intercalary ? { intercalary } : {}) })
  if (moonIds) for (const id of moonIds.length ? moonIds : ['']) params.append('moon', id)
  return `/calendar?${params}`
}

function JumpForm({ calendar, year, month, day, view, moonIds }: { calendar: Calendar; year: number; month: number; day: number; view: string; moonIds?: string[] }) {
  return <form action="/calendar" className={styles.jumpForm}>
    <input type="hidden" name="view" value={view} />
    {moonIds && (moonIds.length ? moonIds : ['']).map((id) => <input key={id} type="hidden" name="moon" value={id} />)}
    <label>Ano<input type="number" name="year" min={-1000000} max={1000000} defaultValue={year} required /></label>
    <label>Mês<select name="month" defaultValue={month}>{calendar.months.map((item, index) => <option key={index} value={index + 1}>{item.name}</option>)}</select></label>
    <label>Dia<input type="number" name="day" min={1} max={1000100} defaultValue={day} required /></label>
    <button className={styles.control} type="submit">Ir para</button>
  </form>
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [world, query] = await Promise.all([getCurrentWorld(), searchParams])
  if (process.env.NODE_ENV !== 'production' && query.prototype === 'visual') return <CalendarVisualPrototype />
  const calendar = world.calendar
  const todayIntercalaryId = world.campaignToday && 'intercalaryRuleId' in world.campaignToday ? world.campaignToday.intercalaryRuleId : undefined
  const todayRule = calendar.intercalaryRules.find((rule) => rule.id === todayIntercalaryId)
  const todayMonth = world.campaignToday && 'month' in world.campaignToday ? world.campaignToday.month : todayRule?.month
  const useToday = query.year === undefined && query.month === undefined && query.day === undefined && query.intercalary === undefined && Boolean(world.campaignToday)
  const requestedYear = integer(query.year, useToday ? world.campaignToday!.year : 0)
  const requestedMonth = integer(query.month, useToday ? todayMonth! : calendar.origin.month)
  const requestedDay = integer(query.day, useToday ? (world.campaignToday && 'day' in world.campaignToday ? world.campaignToday.day : getMonthLength(calendar, requestedYear, requestedMonth)) : query.month === undefined && query.year === undefined ? calendar.origin.day : 1)
  const validYear = validIntegerInput(query.year) && Math.abs(requestedYear) <= 1000000
  const validMonth = validIntegerInput(query.month) && requestedMonth >= 1 && requestedMonth <= calendar.months.length
  const year = validYear ? requestedYear : 0
  const month = validMonth ? requestedMonth : calendar.origin.month
  const validDay = validIntegerInput(query.day) && requestedDay >= 1 && requestedDay <= getMonthLength(calendar, year, month)
  const requestedIntercalary = typeof query.intercalary === 'string' ? query.intercalary : useToday ? todayRule?.id ?? '' : ''
  const intercalary = calendar.intercalaryRules.find((rule) => rule.id === requestedIntercalary && rule.month === month && !rule.extendsMonth && isIntercalaryRuleActive(rule, year))
  const validIntercalary = query.intercalary === undefined || Boolean(intercalary)
  const day = intercalary ? getMonthLength(calendar, year, month) : validDay ? requestedDay : 1
  const view = query.view === 'year' ? 'year' : query.view === 'agenda' ? 'agenda' : 'month'
  const moonParameter = query.moon === undefined ? undefined : Array.isArray(query.moon) ? query.moon : [query.moon]
  const selectedMoonIds = moonParameter?.filter((id, index) => world.calendarMoons.some((moon) => moon.id === id) && moonParameter.indexOf(id) === index)
  const visibleMoonIds = new Set(selectedMoonIds ?? world.calendarMoons.map((moon) => moon.id))
  const url = (targetYear: number, targetMonth: number, targetDay = 1, targetView = 'month', targetPage = 1, targetIntercalary?: string) => buildUrl(targetYear, targetMonth, targetDay, targetView, targetPage, targetIntercalary, selectedMoonIds)
  const todayUrl = world.campaignToday && todayMonth ? url(world.campaignToday.year, todayMonth, 'day' in world.campaignToday ? world.campaignToday.day : getMonthLength(calendar, world.campaignToday.year, todayMonth), 'month', 1, todayRule?.id) : null
  const theme = resolveCalendarTheme(world.calendarAppearance)
  const themeStyle = calendarThemeStyle(theme, world.calendarAppearance.activeTheme)
  const projection = view === 'month' ? projectCalendarWindow(calendar, year, month, day, { moons: world.calendarMoons, seasons: world.calendarSeasons, landmarks: world.calendarLandmarks }) : null
  const dayEntries = projection?.days.filter((entry) => 'day' in entry.date) ?? []
  const selectedDay = intercalary ? projection?.days.find((entry) => 'intercalaryRuleId' in entry.date && entry.date.intercalaryRuleId === intercalary.id) : dayEntries.find((entry) => 'day' in entry.date && entry.date.day === day)
  const selectedMoons = selectedDay?.moons.map((phase) => ({ ...phase, moon: world.calendarMoons.find((moon) => moon.id === phase.id)! })) ?? []
  const visibleLandmarks = [...new Map((projection?.days ?? []).flatMap((entry) => entry.landmarks).map((mark) => [`${mark.id}:${mark.first}`, mark])).values()]
  const previous = adjacentMonth(calendar, year, month, -1)
  const next = adjacentMonth(calendar, year, month, 1)
  const monthName = calendar.months[month - 1].name
  const selectedLabel = intercalary?.name ?? `${day} de ${monthName}`
  const selectedWeekday = selectedDay && !intercalary && calendar.daysOfWeek[((selectedDay.ordinal + calendar.weekdayOffset) % 7 + 7) % 7]
  const era = year === 0 ? calendar.origin.name : year < 0 ? calendar.eras.before : calendar.eras.after
  const coverMoons = world.calendarMoons.slice(0, 2).map(({ id, color }, index) => ({ id, color, position: index === 0 ? 0.28 : 0.5 }))
  const categories = new Map(world.calendarLandmarks.categories.map((category) => [category.id, category]))
  const annualLandmarks = view === 'year' ? projectCalendarLandmarks(calendar, world.calendarLandmarks, dateToOrdinal(calendar, { year, month: 1, day: 1 }), dateToOrdinal(calendar, { year: year + 1, month: 1, day: 1 }) - 1) : []
  const agenda = view === 'agenda' ? projectAgenda(calendar, year, month, await getWorldRepository().listCalendarAgenda(world.id)) : []
  const pageCount = Math.max(1, Math.ceil(agenda.length / 30))
  const page = Math.min(pageCount, Math.max(1, integer(query.page, 1)))
  const visibleAgenda = agenda.slice((page - 1) * 30, page * 30)

  return <div key={world.id} className={styles.calendar} style={themeStyle}><PageContainer className="max-w-7xl">
    <Breadcrumbs items={[{ label: world.name, href: '/codex' }, { label: 'Calendário' }]} />
    <CalendarCover theme={theme} title={world.name} year={year} era={era} moons={coverMoons} />
    <nav aria-label="Vistas do calendário" className={styles.toolbar}>
      <div className={styles.views}>
        {(['month', 'year', 'agenda'] as const).map((item, index) => <Link key={item} scroll={false} aria-current={view === item ? 'page' : undefined} href={url(year, month, day, item, 1, intercalary?.id)}>{['Mês', 'Ano', 'Agenda'][index]}</Link>)}
      </div>
      <div className={styles.shortcuts}>
        {todayUrl ? <Link scroll={false} className={styles.control} href={todayUrl}>Hoje</Link> : <Link className={styles.control} href={`${url(year, month, day, 'month', 1, intercalary?.id)}#dia-selecionado`}>Definir hoje</Link>}
        <a className={styles.control} href="#configuracoes-calendario">Personalizar calendário</a>
      </div>
    </nav>
    <section className={styles.sheet} aria-label={view === 'year' ? 'Visão anual' : view === 'agenda' ? 'Agenda' : 'Visão mensal'}>
      <div className={styles.periodHeader}>
        <div aria-live="polite">
          <p className={styles.eyebrow}>{formatCalendarDate(calendar, { year })}</p>
          <h2>{view === 'year' ? 'O ano em um olhar' : monthName}</h2>
          <p className={styles.periodMeta}>{view === 'year' ? `${getCalendarYearLength(calendar, year).toLocaleString('pt-BR')} dias · ${calendar.months.length} meses` : `${getMonthLength(calendar, year, month).toLocaleString('pt-BR')} dias · Mês ${month} de ${calendar.months.length}`}</p>
        </div>
        <div className={styles.periodActions}>
          {(view !== 'year' ? previous.year >= -1000000 : year > -1000000) ? <Link scroll={false} className={styles.control} aria-label={view === 'year' ? 'Ano anterior' : 'Mês anterior'} href={view !== 'year' ? url(previous.year, previous.month, 1, view) : url(year - 1, month, 1, 'year')}>←</Link> : <span aria-disabled="true" className={styles.control}>←</span>}
          <details className={styles.jump}><summary className={styles.control}>Ir para data</summary>
            <JumpForm key={`${year}:${month}:${day}:${intercalary?.id ?? ''}`} calendar={calendar} year={year} month={month} day={day} view={view} moonIds={selectedMoonIds} />
          </details>
          {(view !== 'year' ? next.year <= 1000000 : year < 1000000) ? <Link scroll={false} className={styles.control} aria-label={view === 'year' ? 'Próximo ano' : 'Próximo mês'} href={view !== 'year' ? url(next.year, next.month, 1, view) : url(year + 1, month, 1, 'year')}>→</Link> : <span aria-disabled="true" className={styles.control}>→</span>}
        </div>
      </div>
      {(!validYear || !validMonth || !validDay || !validIntercalary) && <p role="alert" className="mb-4 text-sm text-destructive">A data informada não existe ou está fora do limite de navegação. Exibindo uma data válida.</p>}
      {view === 'year' ? <><div className={styles.annualGrid}>{calendar.months.map((item, index) => {
        const monthNumber = index + 1
        const first = dateToOrdinal(calendar, { year, month: monthNumber, day: 1 })
        const last = monthNumber < calendar.months.length ? dateToOrdinal(calendar, { year, month: monthNumber + 1, day: 1 }) - 1 : dateToOrdinal(calendar, { year: year + 1, month: 1, day: 1 }) - 1
        const season = seasonAtDate(calendar, world.calendarSeasons, { year, month: monthNumber, day: 1 })
        const marks = annualLandmarks.filter((mark) => mark.first <= last && mark.last >= first)
        return <Link key={index} scroll={false} href={url(year, monthNumber)} className={styles.monthCard}>
          <div className={styles.monthCardHeader} style={{ '--month-color': season?.color } as CSSProperties}><h3>{item.name}</h3><span>{getMonthLength(calendar, year, monthNumber).toLocaleString('pt-BR')} dias</span></div>
          <div className={styles.monthCardBody}>
            {season && <p className={styles.periodMeta}>{season.name}</p>}
            {marks.length ? <ul>{marks.slice(0, 3).map((mark) => {
              const date = getCalendarDateAtOrdinal(calendar, Math.max(first, mark.first))
              return <li key={`${mark.id}:${mark.first}`}><span className={styles.dot} style={{ backgroundColor: categories.get(mark.categoryId)?.color }} /><span className={styles.markDay}>{date.day?.toString().padStart(2, '0') ?? date.intercalaryRuleName}</span><span>{mark.title}</span></li>
            })}{marks.length > 3 && <li>+{marks.length - 3} marcos</li>}</ul> : <p className={styles.periodMeta}>Sem marcos</p>}
          </div>
        </Link>
      })}</div>
        {world.calendarLandmarks.categories.length > 0 && <ul aria-label="Categorias dos marcos" className={styles.legend}>{world.calendarLandmarks.categories.map((category) => <li key={category.id}><span className={styles.dot} style={{ backgroundColor: category.color }} />{category.name}</li>)}</ul>}
      </> : view === 'agenda' ? <>
        <div className={styles.agendaIntro}><h3 className="font-serif text-xl">{agenda.length === 1 ? '1 Evento neste mês' : `${agenda.length} Eventos neste mês`}</h3><Link className={styles.primary} href="/event/new?sessionNote=1">Criar nota de sessão</Link></div>
        {agenda.length === 0 ? <p className="rounded-md border border-dashed p-5 text-sm">Nenhum Evento datado neste mês.</p> : <>
          {([false, true] as const).map((uncertain) => {
            const entries = visibleAgenda.filter((entry) => entry.uncertain === uncertain)
            if (!entries.length) return null
            return <section key={String(uncertain)} className="mb-6"><h3 className="mb-3 font-serif text-xl">{uncertain ? 'Datas aproximadas ou parciais' : 'Datas e intervalos'}</h3><ul className="space-y-3">{entries.map((entry) => <li key={entry.id} className={styles.agendaEntry}><p className={styles.agendaDate}>{entry.label}</p><Link className="mt-1 inline-block font-serif text-lg underline decoration-1 underline-offset-4" href={`/entity/${entry.id}`}>{entry.title}</Link></li>)}</ul></section>
          })}
          <nav aria-label="Páginas da agenda" className="flex gap-4 text-sm"><span>Página {page} de {pageCount}</span>{page > 1 && <Link className="underline" href={url(year, month, day, view, page - 1, intercalary?.id)}>Anterior</Link>}{page < pageCount && <Link className="underline" href={url(year, month, day, view, page + 1, intercalary?.id)}>Próxima</Link>}</nav>
        </>}
      </> : <>
        <div className={styles.monthLayout}><div className="min-w-0">
          <div className={styles.monthGridHeader}>{calendar.daysOfWeek.map((name, index) => <div key={`${index}-${name}`} title={name}><span className={styles.weekdayFull}>{name}</span><abbr className={styles.weekdayShort} aria-label={name}>{Array.from(name).slice(0, 3).join('')}</abbr></div>)}</div>
          <CalendarDayNavigation className={styles.monthGrid} firstWeekday={projection!.firstWeekday}>{Array.from({ length: projection!.firstWeekday }, (_, index) => <div key={`empty-${index}`} aria-hidden="true" />)}{dayEntries.map((entry) => {
            if (!('day' in entry.date)) return null
            const number = entry.date.day
            const phases = entry.moons.filter((phase) => visibleMoonIds.has(phase.id)).map((phase) => ({ ...phase, moon: world.calendarMoons.find((moon) => moon.id === phase.id)! }))
            const dateLabel = formatCalendarDate(calendar, { year, month, day: number })
            const phaseLabel = phases.map(({ moon, phase }) => `${moon.name}: ${phase}`).join('; ')
            const marks = entry.landmarks
            const season = entry.seasonStarts && entry.season ? `Início de ${entry.season.name}` : ''
            const isToday = world.campaignToday && 'month' in world.campaignToday && world.campaignToday.year === year && world.campaignToday.month === month && world.campaignToday.day === number
            return <Link key={number} scroll={false} href={url(year, month, number)} aria-current={!intercalary && number === day ? 'date' : undefined} aria-label={[dateLabel, isToday ? 'Hoje da campanha' : '', entry.season ? `Estação ${entry.season.name}` : '', season, ...marks.map((mark) => mark.title), phaseLabel].filter(Boolean).join('. ')} className={styles.dayCell} style={entry.season ? { borderTopColor: entry.season.color, borderTopWidth: 3 } : undefined}>
              <span className={styles.dayNumber}>{number}{isToday && <span className={styles.todayTag} title="Hoje da campanha"><span>Hoje</span></span>}</span>
              {season && <span className={styles.cellMark} title={season}><span aria-hidden="true">☼</span><span>{season}</span></span>}
              {marks.slice(0, 2).map((mark) => <span key={`${mark.id}:${mark.first}`} className={styles.cellMark} title={mark.title}><span className={styles.dot} style={{ backgroundColor: categories.get(mark.categoryId)?.color }} /><span>{mark.title}</span></span>)}
              {marks.length > 2 && <span className={styles.cellMore}>+{marks.length - 2}</span>}
              {phases.length > 0 && <span className={styles.cellMoons} aria-hidden="true">{phases.map(({ moon, position }, index) => <MoonDisc key={moon.id} color={moon.color} position={position} className={index >= 2 ? 'hidden sm:block' : 'block'} />)}{phases.length > 2 && <span className="sm:hidden">+{phases.length - 2}</span>}</span>}
            </Link>
          })}{Array.from({ length: (7 - (projection!.firstWeekday + dayEntries.length) % 7) % 7 }, (_, index) => <div key={`end-${index}`} aria-hidden="true" />)}</CalendarDayNavigation>
        <a href="#dia-selecionado" className={`${styles.control} ${styles.mobileDetail}`}>Detalhes · {selectedLabel}</a>
        {world.calendarSeasons.length > 0 && <ul aria-label="Legenda das estações" className={styles.legend}>{world.calendarSeasons.map((season) => <li key={season.id}><span aria-hidden="true" className={styles.dot} style={{ backgroundColor: season.color }} />{season.name}</li>)}</ul>}
        {world.calendarMoons.length > 0 && <details className={styles.moonFilter}><summary>Luas na grade <span>{visibleMoonIds.size}/{world.calendarMoons.length}</span></summary><form key={selectedMoonIds?.join(':') ?? 'all'} action="/calendar"><input type="hidden" name="year" value={year} /><input type="hidden" name="month" value={month} /><input type="hidden" name="day" value={day} /><input type="hidden" name="view" value="month" /><input type="hidden" name="moon" value="" />{intercalary && <input type="hidden" name="intercalary" value={intercalary.id} />}<fieldset><legend className="sr-only">Luas visíveis</legend>{world.calendarMoons.map((moon) => <label key={moon.id}><input type="checkbox" name="moon" value={moon.id} defaultChecked={visibleMoonIds.has(moon.id)} /><span aria-hidden="true" className={styles.dot} style={{ backgroundColor: moon.color }} />{moon.name}</label>)}</fieldset><button type="submit" className={styles.control}>Aplicar</button></form></details>}
        <div className="mt-3 flex gap-4 text-sm">{projection!.start > 1 && <Link className="underline" href={url(year, month, projection!.start - 1)}>Semanas anteriores</Link>}{projection!.end < projection!.length && <Link className="underline" href={url(year, month, projection!.end + 1)}>Próximas semanas</Link>}</div>
        {projection!.intercalary.length > 0 && <div className="mt-4 rounded-md border p-3 text-sm"><p className="font-medium">Dias intercalares após este mês</p><ul className="mt-2 flex flex-wrap gap-2">{projection!.intercalary.map((rule) => <li key={rule.id}><Link aria-current={intercalary?.id === rule.id ? 'date' : undefined} className="inline-block rounded-md border px-3 py-2 underline aria-current:border-primary aria-current:bg-primary/10" href={url(year, month, getMonthLength(calendar, year, month), 'month', 1, rule.id)}>{rule.name}</Link></li>)}</ul></div>}
        </div><aside id="dia-selecionado" aria-label="Detalhes do calendário" className={styles.detailPanel}><p className={styles.eyebrow}>Dia selecionado</p>
        <h3 className={styles.selectedTitle} aria-live="polite">{intercalary ? `${intercalary.name}, ${formatCalendarDate(calendar, { year })}` : selectedLabel}</h3>
        {selectedWeekday && <p className={styles.periodMeta}>{selectedWeekday}</p>}
        <Link className={styles.primary} href={`/event/new?${new URLSearchParams({ worldId: world.id, date: JSON.stringify(intercalary ? { year, intercalaryRuleId: intercalary.id } : { year, month, day }) })}`}>Criar Evento neste dia</Link>
        <CampaignTodayControls worldId={world.id} calendar={calendar} today={world.campaignToday} selected={intercalary ? { year, intercalaryRuleId: intercalary.id } : { year, month, day }} />
        {selectedDay?.season && <p className="mt-2 text-sm">Estação: {selectedDay.season.name}</p>}
        {selectedDay && selectedDay.landmarks.length > 0 && <section className={styles.detailGroup}><h3>Marcos neste dia</h3><ul className="mt-2 space-y-2 text-sm">{selectedDay.landmarks.map((mark) => {
          const detail = world.calendarLandmarks.landmarks.find((item) => item.id === mark.id)
          const category = categories.get(mark.categoryId)
          return <li key={`${mark.id}:${mark.first}`} className={styles.markCard} style={{ '--mark-color': category?.color } as CSSProperties}><strong>{mark.title}</strong>{category && <small>{category.name}</small>}{detail?.description && <p>{detail.description}</p>}</li>
        })}</ul></section>}
        {selectedMoons.length > 0 && <section aria-label="Fases das luas no dia selecionado" className={styles.detailGroup}><h3>Luas neste dia</h3><ul className="mt-3 grid gap-3">{selectedMoons.map(({ moon, phase, illuminated, position }) => <li key={moon.id} className="flex items-center gap-2 text-sm"><MoonDisc color={moon.color} position={position} className="size-6 shrink-0" /><span><strong className="block">{moon.name}</strong><small>{phase} · {Math.round(illuminated * 100)}% iluminada</small></span></li>)}</ul></section>}
        {visibleLandmarks.length > 0 && <details className={styles.detailGroup}><summary className="cursor-pointer text-sm font-semibold">Marcos deste trecho ({visibleLandmarks.length})</summary>
          <ul className="mt-2 space-y-2 text-sm">{visibleLandmarks.slice(0, 12).map((mark) => {
            const entry = projection?.days.find((entry) => entry.ordinal >= mark.first && entry.ordinal <= mark.last)
            if (!entry) return null
            const target = entry.date
            const targetRule = 'intercalaryRuleId' in target ? calendar.intercalaryRules.find((rule) => rule.id === target.intercalaryRuleId) : undefined
            return <li key={`${mark.id}:${mark.first}`}><Link scroll={false} className={styles.markLink} href={url(year, month, 'day' in target ? target.day : projection!.length, 'month', 1, targetRule?.id)}><span className={styles.markDay}>{'day' in target ? target.day : targetRule?.name}</span><span>{mark.title}</span></Link></li>
          })}{visibleLandmarks.length > 12 && <li>+{visibleLandmarks.length - 12} marcos</li>}</ul>
        </details>}
        </aside></div>
      </>}
    </section>
    <section aria-labelledby="configuracoes-calendario" className={styles.settings}>
      <h2 id="configuracoes-calendario" className="font-serif text-2xl">Personalizar calendário</h2>
      <p className="mt-2 mb-5 text-sm">As alterações são salvas por seção.</p>
      <CalendarEditorPanel initialCalendar={calendar} worldId={world.id} />
      <CalendarAppearancePanel initialAppearance={world.calendarAppearance} worldId={world.id} preview={{ title: world.name, year, era, moons: coverMoons, month: monthName }} />
      <CalendarMoonsPanel initialMoons={world.calendarMoons} calendar={calendar} worldId={world.id} initialDate={intercalary ? { year, intercalaryRuleId: intercalary.id } : { year, month, day }} />
      <CalendarSeasonsPanel initialSeasons={world.calendarSeasons} calendar={calendar} worldId={world.id} />
      <CalendarLandmarksPanel initialLandmarks={world.calendarLandmarks} calendar={calendar} worldId={world.id} initialDate={intercalary ? { year, intercalaryRuleId: intercalary.id } : { year, month, day }} />
    </section>
  </PageContainer></div>
}
