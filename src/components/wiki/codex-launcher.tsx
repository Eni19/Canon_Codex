'use client'

import { useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, BookOpen, FolderInput, HardDrive, Loader2, Plus, Settings2 } from 'lucide-react'
import { openTaldoreiWorldAction, openWorldAction } from '@/app/actions/worlds'
import type { World } from '@/domain/worlds/world'
import { Button } from '@/components/ui/button'
import { CreateWorldDialog, ImportWorldDialog } from '@/components/wiki/world-library-dialogs'
import { WorldManageDialog } from '@/components/wiki/world-manage-dialog'
import { cn } from '@/lib/utils'

type Panel = 'create' | 'import' | null

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

/** Entrance for rarely-seen content: short rise + fade, staggered, skipped under reduced motion. */
const enter = 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [animation-fill-mode:both]'
const stagger = (index: number): CSSProperties => ({ animationDelay: `${index * 40}ms` })

/**
 * World library at `/` — the one route rendered outside WikiShell, so it reproduces the shell's
 * rail (same width, tokens and link style as WikiSidebar) to read as part of the same app.
 */
export function CodexLauncher({ worlds, activeWorldId }: { worlds: World[]; activeWorldId?: string }) {
  const [panel, setPanel] = useState<Panel>(null)
  const [managedWorld, setManagedWorld] = useState<World | null>(null)
  const active = worlds.find((world) => world.id === activeWorldId) ?? worlds[0]
  const others = worlds
    .filter((world) => world.id !== active?.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return <div className="flex h-full flex-1">
    <aside className="flex w-64 shrink-0 flex-col self-stretch border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-3">
        <span className="font-serif text-lg font-medium">Canon Codex</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <RailHeading first>Biblioteca</RailHeading>
        <RailButton onClick={() => setPanel('create')} icon={<Plus className="size-4"/>}>Criar Codex</RailButton>
        <RailButton onClick={() => setPanel('import')} icon={<FolderInput className="size-4"/>}>Carregar pasta</RailButton>

        <RailHeading>Atlas incluídos</RailHeading>
        <form action={openTaldoreiWorldAction}>
          <TaldoreiButton/>
        </form>
      </nav>

      <div className="flex gap-2.5 border-t border-sidebar-border px-4 py-4 text-xs leading-relaxed text-muted-foreground">
        <HardDrive className="mt-0.5 size-3.5 shrink-0"/>
        <p>Seus dados ficam em pastas locais e podem ser versionados ou copiados.</p>
      </div>
    </aside>

    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-12 py-14">
        <header>
          <h1 className="text-4xl font-medium tracking-tight">Seus mundos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {worlds.length === 1 ? 'Um mundo na biblioteca.' : `${worlds.length} mundos na biblioteca.`} Escolha um para abrir.
          </p>
        </header>

        {active && <ActiveWorld world={active} onManage={() => setManagedWorld(active)}/>}

        <section className="mt-14" aria-labelledby="other-worlds">
          <h2 id="other-worlds" className="text-xl font-medium">Outros mundos</h2>
          {others.length > 0
            ? <ul className="mt-4 border-t border-border">
                {others.map((world, index) => <WorldRow key={world.id} world={world} index={index} onManage={() => setManagedWorld(world)}/>)}
              </ul>
            : <div className={cn('mt-4 flex items-center justify-between gap-6 rounded-lg bg-surface px-6 py-5', enter)} style={stagger(1)}>
                <p className="text-sm text-muted-foreground">Nenhum outro mundo por enquanto. Comece um do zero ou traga uma pasta de outro Codex.</p>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" onClick={() => setPanel('import')}><FolderInput/>Carregar pasta</Button>
                  <Button onClick={() => setPanel('create')}><Plus/>Criar Codex</Button>
                </div>
              </div>}
        </section>
      </div>
    </main>

    <CreateWorldDialog open={panel === 'create'} onOpenChange={(open) => setPanel(open ? 'create' : null)}/>
    <ImportWorldDialog open={panel === 'import'} onOpenChange={(open) => setPanel(open ? 'import' : null)}/>
    {managedWorld && <WorldManageDialog world={managedWorld} onClose={() => setManagedWorld(null)}/>}
  </div>
}

function ActiveWorld({ world, onManage }: { world: World; onManage: () => void }) {
  return <section
    aria-label="Mundo ativo"
    className={cn('relative mt-10 overflow-hidden rounded-lg border border-border bg-surface p-8 before:absolute before:top-0 before:left-0 before:h-1 before:w-18 before:bg-primary', enter)}
  >
    <div className="flex items-end justify-between gap-10">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden/>Ativo
        </p>
        <h2 className="mt-2 truncate text-3xl font-medium tracking-tight">{world.name}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{world.description || 'Sem descrição.'}</p>
        <p className="mt-4 text-xs text-muted-foreground tabular-nums">Atualizado em {dateFormat.format(new Date(world.updatedAt))}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon-lg" onClick={onManage} aria-label={'Gerenciar ' + world.name} title="Gerenciar"><Settings2/></Button>
        <form action={openWorldAction}>
          <input type="hidden" name="worldId" value={world.id}/>
          <ContinueButton/>
        </form>
      </div>
    </div>
  </section>
}

function ContinueButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" size="lg" disabled={pending} className="px-4 active:scale-[0.97]">
    {pending ? <><Loader2 className="animate-spin"/>Abrindo…</> : <>Continuar<ArrowRight/></>}
  </Button>
}

function WorldRow({ world, index, onManage }: { world: World; index: number; onManage: () => void }) {
  return <li className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 border-b border-border pr-1', enter)} style={stagger(index + 1)}>
    <form action={openWorldAction} className="min-w-0">
      <input type="hidden" name="worldId" value={world.id}/>
      <OpenWorldButton world={world}/>
    </form>
    <Button variant="ghost" size="icon" onClick={onManage} aria-label={'Gerenciar ' + world.name} title="Gerenciar" className="text-muted-foreground"><Settings2/></Button>
  </li>
}

function OpenWorldButton({ world }: { world: World }) {
  const { pending } = useFormStatus()
  return <button
    type="submit"
    disabled={pending}
    className="group/row grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto_1rem] items-center gap-4 rounded-md px-2 py-3.5 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.995] disabled:opacity-70"
  >
    <span className="grid size-9 place-items-center rounded-md bg-muted font-serif text-base text-primary" aria-hidden>
      {world.name.trim().charAt(0).toUpperCase()}
    </span>
    <span className="min-w-0">
      <strong className="block truncate font-serif text-base font-medium">{world.name}</strong>
      <span className="mt-0.5 block truncate text-sm text-muted-foreground">{world.description || 'Sem descrição.'}</span>
    </span>
    <span className="text-xs text-muted-foreground tabular-nums">
      {pending ? 'Abrindo…' : dateFormat.format(new Date(world.updatedAt))}
    </span>
    {pending
      ? <Loader2 className="size-4 animate-spin text-primary"/>
      : <ArrowRight className="size-4 text-muted-foreground transition-[color,transform] duration-150 ease-out group-hover/row:translate-x-0.5 group-hover/row:text-primary"/>}
  </button>
}

function TaldoreiButton() {
  const { pending } = useFormStatus()
  return <RailButton type="submit" disabled={pending} icon={pending ? <Loader2 className="size-4 animate-spin"/> : <BookOpen className="size-4"/>}>
    {pending ? 'Abrindo atlas…' : 'Tal’Dorei Renascido'}
  </RailButton>
}

function RailHeading({ children, first = false }: { children: ReactNode; first?: boolean }) {
  return <p className={cn('mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase', first ? 'mt-1' : 'mt-5')}>{children}</p>
}

/** Same geometry and states as WikiSidebarNav's SidebarLink, as a button. */
function RailButton({ icon, children, type = 'button', ...props }: { icon: ReactNode; children: ReactNode } & ComponentProps<'button'>) {
  return <button
    type={type}
    className="mb-0.5 flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none disabled:opacity-70"
    {...props}
  >
    <span className="shrink-0">{icon}</span>
    <span className="truncate">{children}</span>
  </button>
}
