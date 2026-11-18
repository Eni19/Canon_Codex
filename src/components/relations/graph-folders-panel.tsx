'use client'

import { useId, useState, type FormEvent } from 'react'
import { Check, ChevronRight, Folder, FolderOpen, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FolderNameSchema, folderNameKey, type GraphFolder } from '@/domain/relations/graphFolders'

import form from './graph-forms.module.css'

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

export function GraphFoldersPanel({ folders, add, open, isCollapsed, memberCount }: {
  folders: GraphFolder[]
  add: (name: string) => void
  open: (id: string) => void
  isCollapsed: (folder: GraphFolder) => boolean
  memberCount: (folder: GraphFolder) => number
}) {
  return <>
    <FolderNameForm folders={folders} save={add} />
    {folders.length === 0 && <p className="text-muted-foreground">Nenhuma pasta criada.</p>}
    <ul className="divide-y">
      {folders.map((folder) => {
        const closed = isCollapsed(folder)
        const Icon = closed ? Folder : FolderOpen
        return <li key={folder.id}>
          <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent motion-safe:transition-colors" onClick={() => open(folder.id)}>
            <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="wrap-anywhere font-medium">{folder.name}</span>
              <span className="text-xs text-muted-foreground">{memberCount(folder)} · {closed ? 'Recolhida' : 'Aberta'}</span>
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
