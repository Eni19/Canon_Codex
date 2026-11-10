'use client'

import { useActionState, type ReactNode } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { createWorldAction, importWorldAction, type WorldLibraryActionState } from '@/app/actions/worlds'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const initialState: WorldLibraryActionState = {}

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

export function CreateWorldDialog({ open, onOpenChange }: DialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="gap-5 p-6 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-xl">Criar um Codex</DialogTitle>
        <DialogDescription>Um novo mundo com todas as categorias padrão, pronto para receber seu conteúdo.</DialogDescription>
      </DialogHeader>
      {/* Mounted only while open, so the action state (and any error) resets between openings. */}
      <CreateWorldForm/>
    </DialogContent>
  </Dialog>
}

function CreateWorldForm() {
  const [state, action, pending] = useActionState(createWorldAction, initialState)
  return <form action={action} className="grid gap-4">
    <div className="grid gap-2">
      <Label htmlFor="world-name">Nome</Label>
      <Input id="world-name" name="name" required autoFocus placeholder="Nome do mundo"/>
    </div>
    <div className="grid gap-2">
      <Label htmlFor="world-description">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
      <Textarea id="world-description" name="description" rows={3} placeholder="Uma breve apresentação do mundo"/>
    </div>
    {state.error && <FormError>{state.error}</FormError>}
    <DialogFooter className="-mx-6 -mb-6 mt-1 px-6">
      <SubmitButton pending={pending} pendingLabel="Criando…">Criar e abrir</SubmitButton>
    </DialogFooter>
  </form>
}

export function ImportWorldDialog({ open, onOpenChange }: DialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="gap-5 p-6 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-xl">Carregar uma pasta</DialogTitle>
        <DialogDescription>
          Informe uma pasta de mundo com <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">world.json</code> ou
          a pasta raiz de outro Canon Codex. Uma cópia independente será guardada nesta biblioteca.
        </DialogDescription>
      </DialogHeader>
      <ImportWorldForm/>
    </DialogContent>
  </Dialog>
}

function ImportWorldForm() {
  const [state, action, pending] = useActionState(importWorldAction, initialState)
  return <form action={action} className="grid gap-4">
    <div className="grid gap-2">
      <Label htmlFor="world-folder">Caminho da pasta</Label>
      <Input id="world-folder" name="folderPath" required autoFocus placeholder={'C:\\Meus Mundos\\Outro Codex'}/>
      <p className="text-xs text-muted-foreground">No Explorador de Arquivos, use “Copiar como caminho” e cole aqui.</p>
    </div>
    {state.error && <FormError>{state.error}</FormError>}
    <DialogFooter className="-mx-6 -mb-6 mt-1 px-6">
      <SubmitButton pending={pending} pendingLabel="Carregando…">Importar e abrir</SubmitButton>
    </DialogFooter>
  </form>
}

export function FormError({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</p>
}

export function SubmitButton({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: ReactNode }) {
  return <Button type="submit" disabled={pending} className="active:scale-[0.97]">
    {pending ? <><Loader2 className="animate-spin"/>{pendingLabel}</> : <>{children}<ArrowRight/></>}
  </Button>
}
