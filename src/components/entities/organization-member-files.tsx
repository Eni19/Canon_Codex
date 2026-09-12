'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Crown, UserRound } from 'lucide-react'
import { useState } from 'react'
import type { Entity } from '@/domain/entities/entity'
import { assetVariantUrl } from '@/lib/assetUrl'
import styles from './organization-dossier.module.css'

export function OrganizationMemberFiles({ members, leaderIds }: { members: Entity[]; leaderIds: string[] }) {
  const [index, setIndex] = useState(0)
  if (members.length === 0) return <p className={styles.emptyRecord}>Nenhum membro registrado.</p>
  const member = members[index % members.length]
  const isLeader = leaderIds.includes(member.id)
  return <div className={styles.memberBrowser}>
    <button type="button" className={styles.fileArrow} aria-label="Membro anterior" onClick={() => setIndex((value) => (value - 1 + members.length) % members.length)}><ChevronLeft /></button>
    <Link href={`/entity/${member.id}`} className={styles.personnelFile}>
      <span className={styles.fileTab}>FICHA {String(index + 1).padStart(2, '0')}</span>
      <div className={styles.memberPhoto}>{member.coverAssetId ? <Image src={assetVariantUrl(member.coverAssetId, 'thumbnail')} alt="" fill sizes="220px" className="object-cover object-top" /> : <UserRound className="size-16 opacity-20" />}</div>
      <div className={styles.memberData}><span className={styles.recordLabel}>NOME REGISTRADO</span><strong>{member.title}</strong>{isLeader && <span className={styles.leaderMark}><Crown className="size-3.5" />LIDERANÇA</span>}<span className={styles.openRecord}>Abrir ficha pessoal →</span></div>
    </Link>
    <button type="button" className={styles.fileArrow} aria-label="Próximo membro" onClick={() => setIndex((value) => (value + 1) % members.length)}><ChevronRight /></button>
    <div className={styles.fileCounter}>{index + 1} / {members.length}</div>
  </div>
}
