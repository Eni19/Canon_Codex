'use client'

import { useActionState, useState } from 'react'
import { updateCalendarAppearanceAction, type CalendarActionState } from '@/app/actions/calendar'
import { CALENDAR_PRESET_THEMES, colorContrast, resolveCalendarTheme, type CalendarAppearance } from '@/domain/worlds/calendar-appearance'
import { CalendarCover, calendarThemeStyle } from './calendar-cover'

type Theme = CalendarAppearance['customThemes'][number]
const inputClass = 'mt-1 block w-full rounded-md border bg-background px-3 py-2'

export function CalendarAppearanceForm({ initialAppearance, worldId, preview }: { initialAppearance: CalendarAppearance; worldId: string; preview: Pick<React.ComponentProps<typeof CalendarCover>, 'title' | 'year' | 'era' | 'moons'> & { month: string } }) {
  const [appearance, setAppearance] = useState(initialAppearance)
  const [state, action, pending] = useActionState(updateCalendarAppearanceAction, {} as CalendarActionState)
  const [initialSnapshot] = useState(() => JSON.stringify(initialAppearance))
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const selected = resolveCalendarTheme(appearance)
  const custom = appearance.customThemes.find((item) => item.id === appearance.activeTheme)
  const textContrast = colorContrast(selected.colors.text, selected.colors.surface)
  const accentContrast = colorContrast(selected.colors.accent, selected.colors.surface)
  const contrastError = textContrast < 4.5 || accentContrast < 4.5
  const changed = JSON.stringify(appearance) !== (state.savedAppearance ?? initialSnapshot)

  function editTheme(id: string, edit: (theme: Theme) => Theme) {
    setAppearance((current) => ({ ...current, customThemes: current.customThemes.map((theme) => theme.id === id ? edit(theme) : theme) }))
  }

  function duplicate(blank = false) {
    const id = crypto.randomUUID()
    const base = blank ? null : custom?.base ?? (appearance.activeTheme in CALENDAR_PRESET_THEMES ? appearance.activeTheme as keyof typeof CALENDAR_PRESET_THEMES : null)
    const copy: Theme = { id, name: blank ? 'Novo tema' : `${selected.name} (cópia)`.slice(0, 80), base, colors: { ...(blank ? CALENDAR_PRESET_THEMES.codex.colors : selected.colors) }, backgroundAssetId: blank ? null : custom?.backgroundAssetId ?? null, focalPoint: blank ? { x: 0.5, y: 0.5 } : custom?.focalPoint ?? { x: 0.5, y: 0.5 }, overlayOpacity: blank ? 0.35 : custom?.overlayOpacity ?? 0.35 }
    setAppearance((current) => ({ ...current, activeTheme: id, customThemes: [...current.customThemes, copy] }))
  }

  async function upload(file: File, id: string) {
    setUploading(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.set('worldId', worldId)
      form.set('file', file)
      const response = await fetch('/api/calendar-background', { method: 'POST', body: form })
      const result: { assetId?: string; error?: string } = await response.json()
      if (!response.ok || !result.assetId) throw new Error(result.error || 'Não foi possível enviar a imagem.')
      editTheme(id, (theme) => ({ ...theme, backgroundAssetId: result.assetId! }))
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    } finally { setUploading(false) }
  }

  return <form action={action} onReset={(event) => event.preventDefault()} className="space-y-4 rounded-lg border p-4">
    <input type="hidden" name="worldId" value={worldId} />
    <input type="hidden" name="appearance" value={JSON.stringify(appearance)} />
    <input type="hidden" name="expectedAppearance" value={state.savedAppearance ?? initialSnapshot} />
    <label className="block text-sm">Tema<select key={state.savedAppearance ?? initialSnapshot} className={inputClass} value={appearance.activeTheme} onChange={(event) => setAppearance((current) => ({ ...current, activeTheme: event.target.value }))}>
      <optgroup label="Predefinidos">{Object.entries(CALENDAR_PRESET_THEMES).map(([id, theme]) => <option key={id} value={id}>{theme.name}</option>)}</optgroup>
      {appearance.customThemes.length > 0 && <optgroup label="Personalizados">{appearance.customThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</optgroup>}
    </select></label>
    <section aria-label="Prévia do tema" className="space-y-2">
      <h3 className="text-sm font-medium">Prévia do tema</h3>
      <CalendarCover theme={selected} {...preview} preview />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3" style={calendarThemeStyle(selected, appearance.activeTheme)}>
        <p className="font-serif text-lg">{preview.month}</p><span className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Dia selecionado</span>
      </div>
    </section>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={appearance.customThemes.length >= 100 || uploading} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" onClick={() => duplicate()}>Duplicar tema</button><button type="button" disabled={appearance.customThemes.length >= 100 || uploading} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" onClick={() => duplicate(true)}>Novo tema</button>
      {custom && <><button type="button" disabled={uploading} className="rounded-md border px-3 py-2 text-sm text-destructive" onClick={() => {
        if (window.confirm(`Excluir “${custom.name}” da biblioteca ao salvar? O calendário passará a usar o tema Codex.`)) setAppearance((current) => ({ activeTheme: 'codex', customThemes: current.customThemes.filter((item) => item.id !== custom.id) }))
      }}>Excluir tema</button>{custom.base && <button type="button" disabled={uploading} className="rounded-md border px-3 py-2 text-sm" onClick={() => editTheme(custom.id, (item) => ({ ...item, colors: { ...CALENDAR_PRESET_THEMES[custom.base!].colors }, backgroundAssetId: null, focalPoint: { x: 0.5, y: 0.5 }, overlayOpacity: 0.35 }))}>Restaurar modelo</button>}</>}</div>
    {custom && <fieldset className="space-y-4 rounded-md border p-4"><legend className="px-1 font-medium">Personalizar tema</legend>
      <label className="block text-sm">Nome<input required maxLength={80} className={inputClass} value={custom.name} onChange={(event) => editTheme(custom.id, (item) => ({ ...item, name: event.target.value }))} /></label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([['text', 'Texto'], ['accent', 'Destaque'], ['surface', 'Superfície'], ['border', 'Borda']] as const).map(([key, label]) => <label key={key} className="text-sm">{label}<input type="color" className="mt-1 block h-10 w-20" value={custom.colors[key]} onChange={(event) => editTheme(custom.id, (item) => ({ ...item, colors: { ...item.colors, [key]: event.target.value } }))} /></label>)}</div>
      <p className="text-xs text-muted-foreground">Contraste: texto {textContrast.toFixed(1)}:1 · destaque {accentContrast.toFixed(1)}:1. O mínimo é 4,5:1.</p>
      {contrastError && <p role="alert" className="text-sm text-destructive">Ajuste as cores para atingir o contraste mínimo.</p>}
      <label className="block text-sm">Imagem de fundo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" disabled={uploading} className="mt-2 block w-full text-sm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, custom.id); event.target.value = '' }} /></label>
      <p className="text-xs text-muted-foreground">A imagem é copiada para este mundo ao ser escolhida. Removê-la do tema não apaga a cópia armazenada.</p>
      {uploading && <p role="status" className="text-sm">Processando imagem…</p>}
      {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
      {custom.backgroundAssetId && <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">{([['x', 'Posição horizontal'], ['y', 'Posição vertical']] as const).map(([axis, label]) => <label key={axis} className="text-sm">{label} ({Math.round(custom.focalPoint[axis] * 100)}%)<input type="range" min="0" max="100" value={Math.round(custom.focalPoint[axis] * 100)} className="mt-2 block w-full" onChange={(event) => editTheme(custom.id, (item) => ({ ...item, focalPoint: { ...item.focalPoint, [axis]: Number(event.target.value) / 100 } }))} /></label>)}
          <label className="text-sm">Escurecimento ({Math.round(custom.overlayOpacity * 100)}%)<input type="range" min="0" max="100" value={Math.round(custom.overlayOpacity * 100)} className="mt-2 block w-full" onChange={(event) => editTheme(custom.id, (item) => ({ ...item, overlayOpacity: Number(event.target.value) / 100 }))} /></label></div>
        <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => editTheme(custom.id, (item) => ({ ...item, backgroundAssetId: null }))}>Remover fundo</button></div>}
    </fieldset>}
    <button type="submit" disabled={pending || uploading || contrastError} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{pending ? 'Salvando…' : 'Aplicar e salvar tema'}</button>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{changed ? <p role="status" className="text-sm">Alterações ainda não salvas.</p> : state.saved && <p role="status" className="text-sm text-primary">Aparência salva neste mundo.</p>}
  </form>
}
