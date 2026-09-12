'use client'

import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useState } from 'react'
import { getEditorExtensions } from '@/components/editor/extensions'
import type { ContentDocument, ContentPage } from '@/domain/content/contentDocument'
import styles from './content-pages.module.css'

export function ContentRenderer({ content }: { content: ContentDocument }) {
  const [activeId, setActiveId] = useState(content.pages[0].id)
  const activePage = content.pages.find((page) => page.id === activeId) ?? content.pages[0]
  return (
    <div>
      {content.pages.length > 1 && <div className={styles.tabs} role="tablist" aria-label="Páginas de conteúdo">
        {content.pages.map((page) => <button key={page.id} type="button" role="tab" aria-selected={page.id === activePage.id}
          onClick={() => setActiveId(page.id)}>{page.title}</button>)}
      </div>}
      <PageContent key={activePage.id} page={activePage} />
    </div>
  )
}

function PageContent({ page }: { page: ContentPage }) {
  const editor = useEditor({ extensions: getEditorExtensions({ editable: false }), content: page.body as JSONContent,
    editable: false, immediatelyRender: false, editorProps: { attributes: { class: 'tiptap-content' } } })
  return <EditorContent editor={editor} />
}
