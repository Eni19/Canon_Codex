'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { saveGraphSettingsAction } from '@/app/actions/relationship-graph'
import type { GraphSettings } from '@/domain/relations/graphSettings'

type Status = { kind: 'idle' | 'queued' | 'saving' | 'saved' } | { kind: 'error'; message: string }

export function useGraphAutosave(initial: GraphSettings) {
  const settings = useRef(initial)
  const revision = useRef(0)
  const saved = useRef(0)
  const running = useRef(false)
  const failed = useRef(false)
  const mounted = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const flush = useCallback(async function flush() {
    if (!mounted.current || running.current || revision.current === saved.current) return
    running.current = true
    failed.current = false
    setStatus({ kind: 'saving' })
    const version = revision.current
    try {
      const response = await saveGraphSettingsAction(structuredClone(settings.current))
      if (!mounted.current) return
      if ('error' in response) {
        failed.current = true
        setStatus({ kind: 'error', message: response.error })
        return
      }
      settings.current = { ...settings.current, revision: response.settings.revision }
      saved.current = version
      setStatus({ kind: 'saved' })
    } catch {
      if (mounted.current) {
        failed.current = true
        setStatus({ kind: 'error', message: 'Não foi possível salvar a vista. Tente novamente.' })
      }
    } finally {
      running.current = false
      if (mounted.current && !failed.current && revision.current !== saved.current) {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), 350)
        setStatus({ kind: 'queued' })
      }
    }
  }, [])
  const edit = (update: (current: GraphSettings) => GraphSettings) => {
    settings.current = update(settings.current)
    revision.current++
    clearTimeout(timer.current)
    if (failed.current || running.current) return
    setStatus({ kind: 'queued' })
    timer.current = setTimeout(() => void flush(), 350)
  }
  useEffect(() => {
    mounted.current = true
    const warn = (event: BeforeUnloadEvent) => {
      if (revision.current !== saved.current) { event.preventDefault(); event.returnValue = '' }
    }
    const navigate = (event: MouseEvent) => {
      if (revision.current === saved.current || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (link && (!link.target || link.target === '_self') && !link.hasAttribute('download') && link.pathname !== location.pathname && !window.confirm('Há mudanças da vista ainda não salvas. Sair mesmo assim?')) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', navigate, true)
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', navigate, true)
    }
  }, [])
  return { edit, status, retry: () => void flush() }
}
