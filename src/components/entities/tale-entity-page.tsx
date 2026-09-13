'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { BookOpenText, ChevronLeft, Library, PanelRightClose, Pencil } from 'lucide-react'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { PageScrollLock } from '@/components/entities/page-scroll-lock'
import { PropertyDisplayList } from '@/components/entities/property-display-list'
import { RelationsPanel } from '@/components/entities/relations-panel'
import type { EntityPageProps } from '@/components/entities/entity-page'
import type { ContentDocument } from '@/domain/content/contentDocument'
import { assetVariantUrl } from '@/lib/assetUrl'
import styles from './tale-entity-page.module.css'

function textFromNode(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(textFromNode)
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  return [typeof record.text === 'string' ? record.text : '', ...textFromNode(record.content)]
}

function wordCount(content: ContentDocument) {
  const text = content.pages.flatMap((page) => textFromNode(page.body)).join(' ').trim()
  return text ? text.split(/\s+/u).length : 0
}

function valueAsText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function TaleEntityPage(props: EntityPageProps) {
  const { entity, entityType, worldName, content, entityTitleById, backlinks, relationTargetOptions } = props
  const [codexOpen, setCodexOpen] = useState(false)
  const subtitle = valueAsText(entity.properties.subtitle)
  const period = valueAsText(entity.properties.period)
  const notes = valueAsText(entity.properties.notes)
  const layoutValue = valueAsText(entity.properties.openingLayout)
  const openingLayout = layoutValue === 'Centralizado' ? 'centered' : layoutValue === 'Editorial' ? 'editorial' : 'panoramic'
  const metadataProperties = entityType.properties.filter((property) => !['subtitle', 'openingLayout', 'notes'].includes(property.key))
  const words = wordCount(content)

  return <div data-character-theme={entity.theme ?? 'amber'} className={styles.reader} data-codex-open={codexOpen}>
    <PageScrollLock />
    <nav className={styles.readerBar} aria-label="Controles do conto">
      <Link href="/tale"><ChevronLeft />Contos</Link>
      <div className={styles.modeSwitch}>
        <button type="button" data-active={!codexOpen} onClick={() => setCodexOpen(false)}><BookOpenText />Modo Leitura</button>
        <button type="button" data-active={codexOpen} onClick={() => setCodexOpen(true)}><Library />Modo Codex</button>
      </div>
      <Link href={`/entity/${entity.id}/edit`}><Pencil />Editar</Link>
    </nav>

    <div className={styles.scrollArea}>
      <article className={styles.book}>
        <header className={styles.opening} data-layout={openingLayout}>
          <div className={styles.titleBlock}>
            <p>Uma obra de {worldName}</p>
            <h1>{entity.title}</h1>
            {subtitle && <h2>{subtitle}</h2>}
            {openingLayout === 'editorial' && period && <span>{period}</span>}
            {openingLayout === 'centered' && <i aria-hidden="true"><BookOpenText /></i>}
          </div>
          {entity.coverAssetId && <figure className={styles.cover}>
            <Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt="" fill sizes="(max-width: 900px) 100vw, 1000px" className="object-cover" priority unoptimized />
          </figure>}
        </header>

        <div className={styles.story}>
          {content.pages.map((page, index) => {
            const singlePage: ContentDocument = { ...content, pages: [page] }
            const showChapterTitle = content.pages.length > 1 || !['Principal', 'Conteúdo'].includes(page.title)
            return <section key={page.id} className={styles.chapter}>
              {showChapterTitle && <header><small>{String(index + 1).padStart(2, '0')}</small><h2>{page.title}</h2><i /></header>}
              <ContentRenderer content={singlePage} />
            </section>
          })}

          {notes && <aside className={styles.notes}><small>Nota da obra</small><p>{notes}</p></aside>}
          <footer className={styles.endMark}><i /><BookOpenText /><i /></footer>
        </div>
      </article>
    </div>

    <aside className={styles.codexPanel} aria-hidden={!codexOpen}>
      <header><div><small>Informações do conto</small><h2>{entity.title}</h2></div><button type="button" onClick={() => setCodexOpen(false)} aria-label="Fechar Modo Codex"><PanelRightClose /></button></header>
      <dl className={styles.metrics}>
        <div><dt>Status</dt><dd>{entity.status || 'Não definido'}</dd></div>
        <div><dt>Palavras</dt><dd>{new Intl.NumberFormat('pt-BR').format(words)}</dd></div>
        <div><dt>Capítulos</dt><dd>{content.pages.length}</dd></div>
      </dl>
      <section><h3>Ficha da obra</h3><PropertyDisplayList properties={metadataProperties} values={entity.properties} entityTitleById={entityTitleById} columns={1} /></section>
      <section><h3>Relacionado a</h3><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions} /></section>
      <section><h3>Referências ao conto</h3><BacklinksPanel backlinks={backlinks} /></section>
    </aside>
  </div>
}
