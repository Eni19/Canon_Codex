'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import styles from './org-archive.module.css'

export type LedgerMember = { id: string; name: string; groups: string[]; leader: boolean; number: number; spread: number }

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')

/**
 * Leitura do livro de registro: busca por nome ou subgrupo na lista completa dos membros e os
 * controles que viram as páginas do livro na mesa. "Ver no livro" abre o livro na página do membro.
 */
export function LedgerPanel({ title, members, spread, spreads, onSpread }: { title: string; members: LedgerMember[]; spread: number; spreads: number; onSpread: (spread: number) => void }) {
  const [query, setQuery] = useState('')
  const found = useMemo(() => {
    const term = fold(query.trim())
    if (!term) return members
    return members.filter((member) => fold(member.name).includes(term) || member.groups.some((group) => fold(group).includes(term)))
  }, [members, query])
  const leaders = members.filter((member) => member.leader).length

  return <>
    <h2>Livro de registro</h2>
    <p>{title} · {members.length} membro{members.length === 1 ? '' : 's'}{leaders ? ` · ${leaders} na liderança` : ''}</p>
    <div className={styles.ledgerNav}>
      <button type="button" onClick={() => onSpread(Math.max(0, spread - 1))} disabled={spread === 0} aria-label="Página anterior"><ChevronLeft/></button>
      <span>{spread === 0 ? 'Folha de rosto' : `Folhas ${spread * 2 - 1}–${spread * 2}`} · abertura {spread + 1} de {spreads}</span>
      <button type="button" onClick={() => onSpread(Math.min(spreads - 1, spread + 1))} disabled={spread >= spreads - 1} aria-label="Próxima página"><ChevronRight/></button>
    </div>
    {members.length > 0 && <label className={styles.ledgerSearch}>
      <Search aria-hidden="true"/>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou subgrupo" aria-label="Buscar membro"/>
    </label>}
    {members.length === 0 && <p>Nenhum membro registrado. Acrescente membros na edição da organização.</p>}
    <ol className={styles.ledgerList}>
      {found.map((member) => <li key={member.id}>
        <span className={styles.ledgerNumber}>{String(member.number).padStart(3, '0')}</span>
        <span className={styles.ledgerName}>
          <Link href={`/entity/${member.id}`}>{member.leader ? '★ ' : ''}{member.name}</Link>
          {member.groups.length > 0 && <small>{member.groups.join(', ')}</small>}
        </span>
        <button type="button" onClick={() => onSpread(member.spread)} title="Abrir o livro na página deste membro" aria-label={`Ver ${member.name} no livro`}><BookOpen/></button>
      </li>)}
    </ol>
    {members.length > 0 && found.length === 0 && <p>Ninguém encontrado com “{query}”.</p>}
  </>
}
