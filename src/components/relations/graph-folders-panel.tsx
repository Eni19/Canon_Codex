'use client'

import { useId, useState, type FormEvent } from 'react'
import { Folder, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FolderNameSchema, folderNameKey, type GraphFolder } from '@/domain/relations/graphFolders'

const field = 'min-h-10 w-full rounded-md border bg-background px-2 py-1'

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
  return <form className="space-y-2" onSubmit={submit}>
    <label className="grid gap-1">{folder ? 'Renomear pasta' : 'Nome da nova pasta'}
      <input className={field} value={name} maxLength={80} required onChange={(event) => { setName(event.target.value); setError('') }} />
    </label>
    <Button size="sm" type="submit" disabled={!name.trim()}>{folder ? 'Salvar nome' : 'Criar pasta'}</Button>
    {error && <p role="alert" className="text-danger">{error}</p>}
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
          <button type="button" className="flex min-h-12 w-full items-center gap-2 py-2 text-left hover:text-primary" onClick={() => open(folder.id)}>
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words">{folder.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{memberCount(folder)} · {closed ? 'Recolhida' : 'Aberta'}</span>
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
  return <form className="space-y-2 rounded-md border p-2" onSubmit={(event) => { event.preventDefault(); onMove(destination) }}>
    <label htmlFor={id} className="block">Mover para</label>
    <select className={field} id={id} value={destination} onChange={(event) => setDestination(event.target.value)}>
      <option value="">Vista principal</option>
      {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
    </select>
    <Button type="submit" size="sm" disabled={!count || destination === current}>{count > 1 ? `Mover ${count} registros` : 'Mover registro'}</Button>
  </form>
}
