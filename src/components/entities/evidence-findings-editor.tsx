'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { EvidenceFinding } from '@/domain/entities/evidenceFinding'

export function EvidenceFindingsEditor({ initialFindings }: { initialFindings: EvidenceFinding[] }) {
  const [findings, setFindings] = useState(initialFindings)
  const update = (id: string, patch: Partial<EvidenceFinding>) => setFindings((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  return <div className="mt-6 border-t border-border pt-4">
    <input type="hidden" name="evidenceFindings" value={JSON.stringify(findings)} />
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-medium">Informações investigáveis</h2><p className="text-xs text-muted-foreground">Use abordagens e condições livres, sem vínculo com um sistema específico.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setFindings((current) => [...current, { id: crypto.randomUUID(), approach: '', condition: '', information: '' }])}><Plus className="size-4" />Adicionar</Button></div>
    <div className="mt-3 grid gap-3">{findings.map((finding) => <div key={finding.id} className="grid gap-2 border-l-2 border-primary/45 pl-3 sm:grid-cols-[1fr_1fr_auto]">
      <Input aria-label="Abordagem" placeholder="Abordagem" value={finding.approach} onChange={(event) => update(finding.id, { approach: event.target.value })} />
      <Input aria-label="Condição" placeholder="Condição opcional" value={finding.condition} onChange={(event) => update(finding.id, { condition: event.target.value })} />
      <Button type="button" variant="ghost" size="icon" aria-label="Apagar informação" onClick={() => setFindings((current) => current.filter((item) => item.id !== finding.id))}><X className="size-4" /></Button>
      <Textarea className="sm:col-span-3" rows={2} aria-label="Informação" placeholder="Informação revelada..." value={finding.information} onChange={(event) => update(finding.id, { information: event.target.value })} />
    </div>)}</div>
  </div>
}
