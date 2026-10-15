import Link from 'next/link'
import { replaceOriginEventAction } from '@/app/actions/origin-event'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { PageContainer } from '@/components/wiki/page-container'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function OriginEventPage(props: { searchParams: Promise<{ eventId?: string; updated?: string }> }) {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const params = await props.searchParams
  const eventId = typeof params.eventId === 'string' ? params.eventId : ''
  const events = await repo.listEntities(world.id, { type: 'event' })
  const current = await repo.getOriginEvent(world.id)
  let preview: Awaited<ReturnType<typeof repo.previewOriginEvent>> | null = null
  let error = ''
  if (eventId) {
    try { preview = await repo.previewOriginEvent(world.id, eventId) }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Não foi possível preparar a prévia.' }
  }

  return <PageContainer className="max-w-3xl">
    <Breadcrumbs items={[{ label: world.name, href: '/codex' }, { label: 'Calendário', href: '/calendar' }, { label: 'Evento de origem' }]} />
    <h1 className="mt-4 font-serif text-3xl">Evento de origem</h1>
    <p className="mt-2 text-sm text-muted-foreground">{current
      ? <>Origem atual: {current.trashed ? <strong>{current.title} (na lixeira)</strong> : <Link className="underline" href={`/entity/${current.id}`}>{current.title}</Link>}.</>
      : world.originEventId ? 'O Evento de origem vinculado não está disponível.' : 'Este mundo ainda não tem um Evento de origem.'}</p>
    <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm" htmlFor="eventId">Evento para a origem
        <select id="eventId" name="eventId" required defaultValue={eventId} className="rounded-md border border-input bg-background px-3 py-2">
          <option value="">Selecione um Evento</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
        </select>
      </label>
      <button type="submit" className="rounded-md border border-border px-4 py-2 text-sm">Ver prévia</button>
    </form>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {preview && <section className="mt-6 rounded-md border border-border p-4">
      <h2 className="font-serif text-xl">Prévia: {preview.eventTitle}</h2>
      <p className="mt-2 text-sm">Deslocamento: {preview.shiftDays} dia(s). {preview.affectedDates} data(s) em {preview.affectedEntities} registro(s), inclusive registros na lixeira. A ordem e as distâncias entre dias completos são preservadas.</p>
      {preview.precisionChanges > 0 && <p role="alert" className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm">{preview.precisionChanges} data(s) perderão precisão de ano ou mês porque o intervalo deslocado não coincide com uma unidade inteira. A duração aberta continua sem fim.</p>}
      {preview.examples.length > 0 && <ul className="mt-3 space-y-2 text-xs">{preview.examples.map((example, index) => <li key={index} className="break-all rounded bg-muted/40 p-2"><strong>{example.title} · {example.field}</strong>{example.precisionChanged && <span className="ml-2 font-medium text-destructive">Precisão alterada</span>}<br />{example.before} → {example.after}</li>)}</ul>}
      <form action={replaceOriginEventAction} className="mt-5 space-y-3">
        <input type="hidden" name="worldId" value={world.id} />
        <input type="hidden" name="eventId" value={preview.eventId} />
        <input type="hidden" name="fingerprint" value={preview.fingerprint} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Revisei o deslocamento e confirmo a troca da origem</label>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Substituir origem</button>
      </form>
    </section>}
    {params.updated === 'yes' && <p role="status" className="mt-4 text-sm">Origem atualizada.</p>}
  </PageContainer>
}
