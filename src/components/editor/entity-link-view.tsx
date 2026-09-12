'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { Link2 } from 'lucide-react'

export function EntityLinkView({ node, editor }: ReactNodeViewProps) {
  const entityId = node.attrs.entityId as string
  const [title, setTitle] = useState<string>(node.attrs.label as string)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/entities/${entityId}/summary`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { title: string } | null) => {
        if (!cancelled && data) setTitle(data.title)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [entityId])

  const chip = (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 align-baseline text-[0.95em] font-medium text-accent-foreground">
      <Link2 className="size-3" aria-hidden="true" />
      {title || '…'}
    </span>
  )

  return (
    <NodeViewWrapper as="span" data-entity-link="">
      {editor.isEditable ? chip : <Link href={`/entity/${entityId}`}>{chip}</Link>}
    </NodeViewWrapper>
  )
}
