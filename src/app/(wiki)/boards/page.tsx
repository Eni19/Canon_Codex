import Link from 'next/link'
import { connection } from 'next/server'
import { ArrowRight, LayoutDashboard, Plus } from 'lucide-react'
import { createBoardAction } from '@/app/actions/boards'
import { DeleteBoardButton } from '@/components/boards/delete-board-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getBoardRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function BoardsPage() {
  await connection()
  const world = await getCurrentWorld()
  const boards = await getBoardRepository().listBoards(world.id)

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-primary uppercase">Mesa de trabalho</p>
          <h1 className="font-serif text-4xl font-semibold">Quadros</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Organize investigações, relações e ideias usando o mesmo conteúdo da sua wiki.</p>
        </div>
        <LayoutDashboard className="hidden size-12 text-primary/50 sm:block" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_19rem]">
        <section>
          {boards.length === 0 ? (
            <div className="grid min-h-72 place-items-center border border-dashed border-border bg-card/25 p-8 text-center">
              <div><LayoutDashboard className="mx-auto mb-4 size-10 text-primary/60" /><h2 className="font-serif text-2xl">A mesa está vazia</h2><p className="mt-2 text-sm text-muted-foreground">Crie o primeiro quadro para começar a organizar seu mundo.</p></div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {boards.map((board) => (
                <article key={board.id} className="group relative overflow-hidden border border-border bg-card/55 p-5 transition-colors hover:border-primary/45 hover:bg-card">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><p className="text-[0.65rem] tracking-[0.18em] text-primary uppercase">Quadro</p><h2 className="mt-1 truncate font-serif text-xl font-semibold">{board.title}</h2></div>
                    <DeleteBoardButton boardId={board.id} title={board.title} />
                  </div>
                  {board.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{board.description}</p>}
                  {board.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{board.tags.map((tag) => <span key={tag} className="bg-primary/10 px-2 py-1 text-[0.65rem] text-primary uppercase">{tag}</span>)}</div>}
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>Atualizado {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(board.updatedAt))}</span>
                    <Link href={`/boards/${board.id}`} className="flex items-center gap-1 font-medium text-foreground hover:text-primary">Abrir <ArrowRight className="size-3.5" /></Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit border border-border bg-card/45 p-5">
          <h2 className="flex items-center gap-2 font-serif text-xl"><Plus className="size-4 text-primary" /> Novo quadro</h2>
          <form action={createBoardAction} className="mt-5 space-y-4">
            <div className="space-y-1.5"><Label htmlFor="board-title">Título</Label><Input id="board-title" name="title" required placeholder="Caso Klein" /></div>
            <div className="space-y-1.5"><Label htmlFor="board-description">Descrição</Label><Textarea id="board-description" name="description" rows={3} placeholder="O que será organizado aqui?" /></div>
            <div className="space-y-1.5"><Label htmlFor="board-tags">Etiquetas</Label><Input id="board-tags" name="tags" placeholder="investigação, cronologia" /><p className="text-xs text-muted-foreground">Separe por vírgulas.</p></div>
            <Button type="submit" className="w-full"><Plus className="size-4" />Criar quadro</Button>
          </form>
        </aside>
      </div>
    </div>
  )
}
