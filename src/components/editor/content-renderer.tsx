'use client'

import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { getEditorExtensions } from '@/components/editor/extensions'
import type { ContentDocument, ContentPage } from '@/domain/content/contentDocument'
import { contentSections } from '@/domain/content/contentSections'
import styles from './content-pages.module.css'

export function ContentRenderer({ content }: { content: ContentDocument }) {
  const id = useId()
  const [activeId, setActiveId] = useState(content.pages[0].id)
  const activePage = content.pages.find((page) => page.id === activeId) ?? content.pages[0]
  const tabs = useRef<HTMLDivElement>(null)
  // Padrão de abas da WAI: setas, Home e End movem entre as páginas e já as ativam.
  function moveTab(event: KeyboardEvent<HTMLDivElement>) {
    const index = content.pages.findIndex((page) => page.id === activePage.id)
    const last = content.pages.length - 1
    const next = event.key === 'ArrowRight' ? (index + 1) % content.pages.length
      : event.key === 'ArrowLeft' ? (index - 1 + content.pages.length) % content.pages.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1
    if (next < 0) return
    event.preventDefault()
    setActiveId(content.pages[next].id)
    tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  const tabId = (page: ContentPage) => `${id}-tab-${page.id}`
  const panelId = `${id}-panel`
  return (
    <div>
      {content.pages.length > 1 && <div ref={tabs} className={styles.tabs} role="tablist" aria-label="Páginas de conteúdo" onKeyDown={moveTab}>
        {content.pages.map((page) => <button key={page.id} id={tabId(page)} type="button" role="tab" aria-selected={page.id === activePage.id}
          aria-controls={panelId} tabIndex={page.id === activePage.id ? 0 : -1}
          onClick={() => setActiveId(page.id)}>{page.title}</button>)}
      </div>}
      <div id={panelId} role={content.pages.length > 1 ? 'tabpanel' : undefined} aria-labelledby={content.pages.length > 1 ? tabId(activePage) : undefined}>
        <PageContent key={activePage.id} page={activePage} />
      </div>
    </div>
  )
}

function PageContent({ page }: { page: ContentPage }) {
  const body = useRef<HTMLDivElement>(null)
  const editor = useEditor({ extensions: getEditorExtensions({ editable: false }), content: page.body as JSONContent,
    editable: false, immediatelyRender: false, editorProps: { attributes: { class: 'tiptap-content' } } })
  const sections = contentSections(page.body)
  function open(index: number) {
    const heading = body.current?.querySelectorAll<HTMLElement>('.tiptap-content > h1, .tiptap-content > h2')[index]
    if (!heading) return
    heading.tabIndex = -1
    heading.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    heading.focus({ preventScroll: true })
  }
  return <>
    {sections.length >= 2 && <nav className={styles.sections} aria-label={`Seções de ${page.title}`}>
      <span aria-hidden="true">Seções</span>
      <ul>{sections.map((section) => <li key={section.index} data-level={section.level}>
        <button type="button" onClick={() => open(section.index)}>{section.title}</button>
      </li>)}</ul>
    </nav>}
    <div ref={body}><EditorContent editor={editor} /></div>
  </>
}
