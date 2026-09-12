'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { OrganizationGroup } from '@/domain/entities/organizationGroup'
import type { ReferenceOption } from './property-field'

export function OrganizationGroupsEditor({ initialGroups, characters }: { initialGroups: OrganizationGroup[]; characters: ReferenceOption[] }) {
  const [groups, setGroups] = useState(initialGroups)
  const update = (id: string, patch: Partial<OrganizationGroup>) => setGroups((current) => current.map((group) => group.id === id ? { ...group, ...patch } : group))

  return <section className="mt-2 border-t border-border pt-4">
    <input type="hidden" name="organizationGroups" value={JSON.stringify(groups)} />
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><h2 className="text-sm font-medium">Subgrupos e equipes</h2><p className="text-xs text-muted-foreground">Organize os membros em equipes internas.</p></div>
      <Button type="button" size="sm" variant="outline" onClick={() => setGroups((current) => [...current, { id: crypto.randomUUID(), name: 'Nova equipe', description: '', memberIds: [] }])}><Plus className="size-4" />Adicionar</Button>
    </div>
    <div className="flex flex-col gap-4">
      {groups.map((group) => <div key={group.id} className="relative rounded-md border border-border p-4">
        <button type="button" aria-label={`Excluir ${group.name}`} className="absolute top-3 right-3 text-muted-foreground hover:text-danger" onClick={() => setGroups((current) => current.filter((candidate) => candidate.id !== group.id))}><X className="size-4" /></button>
        <div className="grid gap-3 pr-7 sm:grid-cols-2">
          <Input aria-label="Nome da equipe" value={group.name} onChange={(event) => update(group.id, { name: event.target.value })} />
          <select aria-label="Membros da equipe" multiple value={group.memberIds} onChange={(event) => update(group.id, { memberIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })} className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm">
            {characters.map((character) => <option key={character.id} value={character.id}>{character.title}</option>)}
          </select>
          <Textarea aria-label="Descrição da equipe" className="sm:col-span-2" rows={3} value={group.description} placeholder="Função, área de atuação ou observações..." onChange={(event) => update(group.id, { description: event.target.value })} />
        </div>
      </div>)}
      {groups.length === 0 && <p className="text-sm text-muted-foreground">Nenhum subgrupo criado.</p>}
    </div>
  </section>
}
