'use client'
import { useTransition } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { deleteSceneAction, duplicateSceneAction } from '@/app/actions/scenes'
export function SceneListActions({ id, title }: { id: string; title: string }) { const [pending, start] = useTransition(); return <div className="flex gap-1"><button disabled={pending} title="Duplicar" onClick={() => start(() => void duplicateSceneAction(id))} className="p-2 text-muted-foreground hover:text-primary"><Copy className="size-4" /></button><button disabled={pending} title="Excluir" onClick={() => { if (confirm(`Mover “${title}” para a lixeira?`)) start(() => void deleteSceneAction(id)) }} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></div> }
