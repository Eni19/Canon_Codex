'use client'

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ConceptBlock, ConceptBlockType } from '@/domain/entities/conceptBlock'

const BLOCK_OPTIONS: Array<{ type: ConceptBlockType; label: string; hint: string }> = [
  { type: 'overview', label: 'Visão geral', hint: 'Apresente o conceito e sua finalidade.' },
  { type: 'operation', label: 'Funcionamento', hint: 'Explique o processo, mecanismo ou comportamento.' },
  { type: 'structure', label: 'Estrutura / componentes', hint: 'Escreva um componente ou parte por linha.' },
  { type: 'rules', label: 'Regras', hint: 'Escreva uma regra por linha; a numeração é automática.' },
  { type: 'examples', label: 'Exemplos', hint: 'Mostre aplicações concretas ou situações de uso.' },
  { type: 'limitations', label: 'Limitações', hint: 'Escreva uma limitação, condição ou risco por linha.' },
  { type: 'terminology', label: 'Terminologia', hint: 'Use uma linha por termo: Âncora :: objeto estabilizador.' },
  { type: 'diagram', label: 'Diagrama', hint: 'Use setas: Cristal -> Conversor -> Motor -> Movimento.' },
  { type: 'notes', label: 'Observações', hint: 'Informações complementares, exceções ou referências.' },
]

const SELECT_CLASS = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

function optionFor(type: ConceptBlockType) {
  return BLOCK_OPTIONS.find((option) => option.type === type) ?? BLOCK_OPTIONS[0]
}

export function ConceptBlocksEditor({ initialBlocks }: { initialBlocks: ConceptBlock[] }) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [nextType, setNextType] = useState<ConceptBlockType>('overview')

  function update(id: string, patch: Partial<ConceptBlock>) {
    setBlocks((current) => current.map((block) => block.id === id ? { ...block, ...patch } : block))
  }

  function move(index: number, offset: -1 | 1) {
    const destination = index + offset
    if (destination < 0 || destination >= blocks.length) return
    setBlocks((current) => {
      const next = [...current]
      const [block] = next.splice(index, 1)
      next.splice(destination, 0, block)
      return next
    })
  }

  function addBlock() {
    const option = optionFor(nextType)
    setBlocks((current) => [...current, { id: crypto.randomUUID(), type: nextType, title: option.label, body: '' }])
  }

  return <section className="mt-2 border-t border-border pt-5">
    <input type="hidden" name="conceptBlocks" value={JSON.stringify(blocks)} readOnly />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-medium">Blocos informativos</h2>
        <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">Adicione somente as seções necessárias. Os blocos são apresentados na mesma ordem na página do conceito.</p>
      </div>
      <div className="flex items-end gap-2">
        <label className="grid gap-1 text-[0.65rem] text-muted-foreground">Tipo de bloco
          <select className={SELECT_CLASS} value={nextType} onChange={(event) => setNextType(event.target.value as ConceptBlockType)}>
            {BLOCK_OPTIONS.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" onClick={addBlock} disabled={blocks.length >= 40}><Plus className="size-4" />Adicionar</Button>
      </div>
    </div>

    {blocks.length === 0 && <div className="mt-4 border border-dashed border-border px-5 py-8 text-center text-xs text-muted-foreground">Nenhum bloco informativo adicionado.</div>}

    <div className="mt-4 grid gap-3">
      {blocks.map((block, index) => {
        const option = optionFor(block.type)
        return <article key={block.id} className="rounded-sm border border-border bg-surface/45 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-muted font-mono text-[0.6rem] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
            <select aria-label="Tipo do bloco" className={SELECT_CLASS} value={block.type} onChange={(event) => update(block.id, { type: event.target.value as ConceptBlockType })}>
              {BLOCK_OPTIONS.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
            </select>
            <div className="ml-auto flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label="Mover bloco para cima" disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Mover bloco para baixo" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ChevronDown className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Apagar bloco" onClick={() => setBlocks((current) => current.filter((item) => item.id !== block.id))}><Trash2 className="size-4" /></Button>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <Input aria-label="Título do bloco" placeholder="Título da seção" maxLength={100} value={block.title} onChange={(event) => update(block.id, { title: event.target.value })} />
            <Textarea aria-label="Conteúdo do bloco" maxLength={8000} rows={block.type === 'diagram' ? 5 : 4} placeholder={option.hint} value={block.body} onChange={(event) => update(block.id, { body: event.target.value })} />
            <p className="text-[0.65rem] text-muted-foreground">{option.hint}</p>
          </div>
        </article>
      })}
    </div>
  </section>
}
