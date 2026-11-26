'use client'

import { useId, useState, type FormEvent, type Ref } from 'react'
import { Check, ChevronRight, Ellipsis, Folder, FolderOpen, FolderPlus, Home, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FolderNameSchema, folderNameKey, type GraphFolder } from '@/domain/relations/graphFolders'

import form from './graph-forms.module.css'

export function GraphFolderNavigation({ folders, active, counts, dragging, dropTarget, obscured, navigationRef, open, manage, create }: {
  folders: GraphFolder[]; active: string; counts: ReadonlyMap<string, number>; dragging: boolean; dropTarget: string | null; obscured: boolean
  navigationRef: Ref<HTMLElement>; open: (id: string) => void; manage: (id: string) => void; create: () => void
}) {
  const destinations = [{ id: '', name: 'Vista principal' }, ...folders]
  return <nav ref={navigationRef} aria-label="Pastas do grafo" data-panel-open={obscured || undefined} className={form.folderDock}>
    <header className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
      <span className="text-xs font-medium text-muted-foreground">Pastas</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Nova pasta" onClick={create}><Plus aria-hidden="true" /></Button>
    </header>
    <ul className={form.folderDestinations}>
      {destinations.map((folder) => {
        const Icon = !folder.id ? Home : folder.id === active ? FolderOpen : Folder
        return <li key={folder.id} className="flex min-w-0 items-center gap-0.5">
          <button type="button" data-graph-folder-target={folder.id} data-drop-target={dropTarget === folder.id || undefined}
            aria-current={folder.id === active ? 'page' : undefined} aria-label={folder.id ? `Abrir pasta ${folder.name}` : 'Abrir vista principal'}
            title={folder.name} className={form.folderTarget} onClick={() => open(folder.id)}>
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{counts.get(folder.id) ?? 0}</span>
          </button>
          {folder.id && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Gerenciar pasta ${folder.name}`} onClick={() => manage(folder.id)}><Ellipsis aria-hidden="true" /></Button>}
        </li>
      })}
    </ul>
    <p role="status" className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      {dragging ? dropTarget !== null ? 'Solte para mover o registro.' : 'Arraste até a pasta de destino.' : 'Arraste um registro até uma pasta para movê-lo.'}
    </p>
  </nav>
}

export function FolderNameForm({ folders, folder, save }: {
  folders: GraphFolder[]; folder?: GraphFolder; save: (name: string) => void
}) {
  const [name, setName] = useState(folder?.name ?? '')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const result = FolderNameSchema.safeParse(name)
    if (!result.success) { setError('Use um nome de 1 a 80 caracteres.'); return }
    if (folders.some((item) => item.id !== folder?.id && folderNameKey(item.name) === folderNameKey(result.data))) {
      setError('Já existe uma pasta com esse nome.')
      return
    }
    save(result.data)
    if (!folder) setName('')
    setError('')
  }
  return <form className={form.form} onSubmit={submit}>
    <label className={form.field}>{folder ? 'Renomear pasta' : 'Nome da nova pasta'}
      <input className={form.control} value={name} maxLength={80} required onChange={(event) => { setName(event.target.value); setError('') }} />
    </label>
    {error && <p role="alert" className={`${form.feedback} ${form.error} ${form.reveal}`}>{error}</p>}
    <div className={form.actions}>
      <Button type="submit" disabled={!name.trim()}>{folder ? <Check aria-hidden="true" /> : <FolderPlus aria-hidden="true" />}{folder ? 'Salvar nome' : 'Criar pasta'}</Button>
    </div>
  </form>
}

export function GraphFoldersPanel({ folders, add, open, memberCount }: {
  folders: GraphFolder[]
  add: (name: string) => void
  open: (id: string) => void
  memberCount: (folder: GraphFolder) => number
}) {
  return <>
    <FolderNameForm folders={folders} save={add} />
    {folders.length === 0 && <p className="text-muted-foreground">Nenhuma pasta criada.</p>}
    <ul className="divide-y">
      {folders.map((folder) => {
        return <li key={folder.id}>
          <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent motion-safe:transition-colors" onClick={() => open(folder.id)}>
            <Folder aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="wrap-anywhere font-medium">{folder.name}</span>
              <span className="text-xs text-muted-foreground">{memberCount(folder)} registros</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      })}
    </ul>
  </>
}

export function FolderMoveForm({ folders, count, current, onMove }: {
  folders: GraphFolder[]; count: number; current?: string; onMove: (id: string) => void
}) {
  const id = useId()
  const [destination, setDestination] = useState(current ?? '')
  return <form className={form.form + ' ' + form.reveal + ' border-t pt-3'} onSubmit={(event) => { event.preventDefault(); onMove(destination) }}>
    <label className={form.field} htmlFor={id}>Mover para
    <select className={form.control} id={id} value={destination} onChange={(event) => setDestination(event.target.value)}>
      <option value="">Vista principal</option>
      {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
    </select></label>
    <Button type="submit" size="sm" className="justify-self-end" disabled={!count || destination === current}>{count > 1 ? `Mover ${count} registros` : 'Mover registro'}</Button>
  </form>
}
