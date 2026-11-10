'use client'

import { useActionState } from 'react'
import { Trash2 } from 'lucide-react'
import { manageWorldAction, type WorldLibraryActionState } from '@/app/actions/worlds'
import type { World } from '@/domain/worlds/world'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError, SubmitButton } from '@/components/wiki/world-library-dialogs'

const initialState: WorldLibraryActionState = {}

export function WorldManageDialog({ world, onClose }: { world: World; onClose: () => void }) {
  const [state, action, pending] = useActionState(manageWorldAction, initialState)
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent className="gap-5 p-6 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="truncate pr-8 text-xl">{world.name}</DialogTitle>
        <DialogDescription>Altere a identificação deste Codex ou remova seu arquivo da biblioteca.</DialogDescription>
      </DialogHeader>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="worldId" value={world.id}/>
        <div className="grid gap-2">
          <Label htmlFor="manage-world-name">Nome</Label>
          <Input id="manage-world-name" name="name" required defaultValue={world.name}/>
        </div>
        {state.error && <FormError>{state.error}</FormError>}
        <input type="hidden" name="intent" value="rename"/>
        <div className="flex justify-end">
          <SubmitButton pending={pending} pendingLabel="Salvando…">Salvar novo nome</SubmitButton>
        </div>
      </form>
      <form
        action={action}
        className="-mx-6 -mb-6 flex items-center justify-between gap-4 rounded-b-xl border-t border-border bg-destructive/5 px-6 py-4"
        onSubmit={(event) => { if (!window.confirm('Excluir “' + world.name + '” da biblioteca? Os arquivos serão movidos para a lixeira interna.')) event.preventDefault() }}
      >
        <input type="hidden" name="worldId" value={world.id}/>
        <input type="hidden" name="intent" value="delete"/>
        <div>
          <p className="text-sm font-medium">Excluir este Codex</p>
          <p className="mt-0.5 text-xs text-muted-foreground">O mundo sai da biblioteca e vai para a pasta de lixeira.</p>
        </div>
        <Button type="submit" variant="destructive" disabled={pending}><Trash2/>Excluir</Button>
      </form>
    </DialogContent>
  </Dialog>
}
