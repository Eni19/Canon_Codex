'use client'

import type { Editor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { Bold, Italic, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { getEditorExtensions } from '@/components/editor/extensions'
import type { ContentDocument, ContentPage } from '@/domain/content/contentDocument'
import type { CharacterTheme } from '@/domain/entities/characterTheme'
import styles from './content-editor.module.css'

const emptyBody: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function ContentEditor({
  content,
  theme,
  maxPages = 2,
  pageNoun = 'página',
}: {
  content: ContentDocument
  theme?: CharacterTheme
  maxPages?: number
  pageNoun?: 'página' | 'capítulo'
}) {
  const [pages, setPages] = useState<ContentPage[]>(content.pages)
  const [activeId, setActiveId] = useState(content.pages[0].id)
  const activePage = pages.find((page) => page.id === activeId) ?? pages[0]

  function updatePage(patch: Partial<ContentPage>) {
    setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, ...patch } : page))
  }

  function addPage() {
    if (pages.length >= maxPages) return
    const nextNumber = pages.length + 1
    const page: ContentPage = { id: crypto.randomUUID(), title: pageNoun === 'capítulo' ? `Capítulo ${nextNumber}` : `Página ${nextNumber}`, body: emptyBody }
    setPages((current) => [...current, page])
    setActiveId(page.id)
  }

  function removeActivePage() {
    if (pages.length === 1) return
    const remaining = pages.filter((page) => page.id !== activePage.id)
    setPages(remaining)
    setActiveId(remaining[0].id)
  }

  return (
    <div data-character-theme={theme ?? 'amber'}>
      <div className={styles.pageBar}>
        <div className={styles.pageTabs} role="tablist" aria-label="Páginas de conteúdo">
          {pages.map((page) => (
            <button key={page.id} type="button" role="tab" aria-selected={page.id === activePage.id}
              className={styles.pageTab} onClick={() => setActiveId(page.id)}>{page.title}</button>
          ))}
        </div>
        {pages.length < maxPages && <button type="button" className={styles.addPageButton} onClick={addPage}><Plus aria-hidden="true" /> Novo {pageNoun}</button>}
      </div>
      <div className={styles.pageNameRow}>
        <label htmlFor={`content-page-${activePage.id}`}>Nome do {pageNoun}</label>
        <input id={`content-page-${activePage.id}`} value={activePage.title} maxLength={40}
          onChange={(event) => updatePage({ title: event.target.value || 'Sem título' })} />
        {pages.length > 1 && <button type="button" onClick={removeActivePage}><Trash2 aria-hidden="true" /> Excluir página</button>}
      </div>
      <PageEditor key={activePage.id} page={activePage} onChange={(body) => updatePage({ body })} />
      <input type="hidden" name="content" value={JSON.stringify(pages)} readOnly />
    </div>
  )
}

function PageEditor({ page, onChange }: { page: ContentPage; onChange: (body: JSONContent) => void }) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [activeBlock, setActiveBlock] = useState<{ position: number; top: number } | null>(null)
  const [, forceToolbarUpdate] = useState(0)

  function locateActiveBlock(currentEditor: Editor) {
    requestAnimationFrame(() => {
      const shell = shellRef.current
      const { $from } = currentEditor.state.selection
      if (!shell || $from.depth === 0) return setActiveBlock(null)
      const position = $from.before(1)
      const nodeElement = currentEditor.view.nodeDOM(position)
      if (nodeElement instanceof HTMLElement) {
        setActiveBlock({ position, top: nodeElement.getBoundingClientRect().top - shell.getBoundingClientRect().top })
      }
    })
  }

  const editor = useEditor({
    extensions: getEditorExtensions({ editable: true }),
    content: page.body as JSONContent,
    immediatelyRender: false,
    editorProps: { attributes: { class: `tiptap-content ${styles.editor}` } },
    onUpdate: ({ editor: currentEditor }) => { onChange(currentEditor.getJSON()); locateActiveBlock(currentEditor) },
    onSelectionUpdate: ({ editor: currentEditor }) => { locateActiveBlock(currentEditor); forceToolbarUpdate((value) => value + 1) },
  })

  function deleteActiveBlock() {
    if (!editor || !activeBlock) return
    const node = editor.state.doc.nodeAt(activeBlock.position)
    if (node) editor.chain().focus().deleteRange({ from: activeBlock.position, to: activeBlock.position + node.nodeSize }).run()
  }

  return (
    <div ref={shellRef} className={styles.shell}>
      <div className={styles.toolbar}>
        <div className={styles.formatButtons} aria-label="Formatação do texto">
          <button type="button" aria-label="Negrito" aria-pressed={editor?.isActive('bold') ?? false}
            onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold aria-hidden="true" /></button>
          <button type="button" aria-label="Itálico" aria-pressed={editor?.isActive('italic') ?? false}
            onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic aria-hidden="true" /></button>
          <span>Selecione o texto para formatar</span>
        </div>
        <button type="button" className={styles.addButton} disabled={!editor}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus('end').insertContent({ type: 'paragraph' }).run()}>
          <Plus aria-hidden="true" /> Novo bloco de texto
        </button>
      </div>
      {activeBlock && <button type="button" className={styles.deleteBlockButton} style={{ top: activeBlock.top + 8 }}
        aria-label="Excluir este bloco" title="Excluir este bloco" onMouseDown={(event) => event.preventDefault()} onClick={deleteActiveBlock}>×</button>}
      <EditorContent editor={editor} />
    </div>
  )
}
