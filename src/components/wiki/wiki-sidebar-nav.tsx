'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { CalendarDays, Clapperboard, EyeOff, Layers, LayoutDashboard, LibraryBig, FolderInput, RotateCcw, Search, Settings2 } from 'lucide-react'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { useCommandPalette } from '@/components/wiki/command-palette-provider'
import { cn } from '@/lib/utils'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'

const HIDDEN_GUIDES_KEY = 'canon-codex:hidden-guides'
const HIDDEN_GUIDES_EVENT = 'canon-codex:hidden-guides-changed'

function subscribeToHiddenGuides(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(HIDDEN_GUIDES_EVENT, callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(HIDDEN_GUIDES_EVENT, callback) }
}

function hiddenGuidesSnapshot() { return window.localStorage.getItem(HIDDEN_GUIDES_KEY) ?? '[]' }
function saveHiddenGuides(ids: string[]) {
  window.localStorage.setItem(HIDDEN_GUIDES_KEY, JSON.stringify(ids))
  window.dispatchEvent(new Event(HIDDEN_GUIDES_EVENT))
}

export function WikiSidebarNav({
  entityTypes,
  collapsed = false,
  onNavigate,
}: {
  entityTypes: EntityTypeDefinition[]
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const { setOpen: setCommandPaletteOpen } = useCommandPalette()
  const [customizing, setCustomizing] = useState(false)
  const hiddenSnapshot = useSyncExternalStore(subscribeToHiddenGuides, hiddenGuidesSnapshot, () => '[]')
  const hiddenGuideIds = useMemo(() => {
    try { const parsed: unknown = JSON.parse(hiddenSnapshot); return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []) }
    catch { return new Set<string>() }
  }, [hiddenSnapshot])
  const availableTypes = entityTypes.filter((type) => type.showInSidebar)

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        title={collapsed ? 'Buscar' : undefined}
        className="mb-0.5 flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
      >
        <Search className="size-4 shrink-0" />
        {!collapsed && (
          <span className="flex flex-1 items-center justify-between">
            <span>Buscar</span>
            <span className="text-xs text-muted-foreground">Ctrl K</span>
          </span>
        )}
      </button>
      <SidebarLink href="/" active={false} collapsed={collapsed} label="Trocar Codex" onNavigate={onNavigate}>
        <FolderInput className="size-4" />
      </SidebarLink>
      <SidebarLink href="/codex" active={pathname === '/codex'} collapsed={collapsed} label="Início" onNavigate={onNavigate}>
        <LibraryBig className="size-4" />
      </SidebarLink>
      <SidebarLink href="/all" active={pathname === '/all'} collapsed={collapsed} label="Todos os conteúdos" onNavigate={onNavigate}>
        <Layers className="size-4" />
      </SidebarLink>
      <SidebarLink href="/calendar" active={pathname.startsWith('/calendar')} collapsed={collapsed} label="Calendário" onNavigate={onNavigate}>
        <CalendarDays className="size-4" />
      </SidebarLink>

      {!collapsed && (
        <p className="mt-5 mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Conteúdo</p>
      )}
      {collapsed && <div className="my-3 border-t border-sidebar-border" />}

      {availableTypes
        .filter((type) => !hiddenGuideIds.has(type.id))
        .map((type) => (
          <SidebarLink
            key={type.id}
            href={`/${type.id}`}
            active={pathname.startsWith(`/${type.id}`)}
            collapsed={collapsed}
            label={type.pluralLabel}
            onNavigate={onNavigate}
          >
            <EntityTypeIcon name={type.icon} className="size-4" />
          </SidebarLink>
        ))}
      {!collapsed && <p className="mt-5 mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Ferramentas</p>}
      {collapsed && <div className="my-3 border-t border-sidebar-border" />}
      <SidebarLink href="/boards" active={pathname.startsWith('/boards')} collapsed={collapsed} label="Quadros" onNavigate={onNavigate}>
        <LayoutDashboard className="size-4" />
      </SidebarLink>
      <SidebarLink href="/scenes" active={pathname.startsWith('/scenes')} collapsed={collapsed} label="Cenas" onNavigate={onNavigate}>
        <Clapperboard className="size-4" />
      </SidebarLink>
      {!collapsed && <div className="mt-4 border-t border-sidebar-border pt-2">
        <button type="button" onClick={() => setCustomizing((value) => !value)} className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" aria-expanded={customizing}>
          <Settings2 className="size-4" /><span>Personalizar guias</span>
        </button>
        {customizing && <div className="mt-2 rounded-md border border-sidebar-border bg-sidebar-accent/35 p-2">
          <p className="mb-2 flex items-center gap-2 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase"><EyeOff className="size-3.5" />Exibição</p>
          <div className="flex flex-col gap-1">{availableTypes.map((type) => <label key={type.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-sidebar-accent">
            <input type="checkbox" checked={!hiddenGuideIds.has(type.id)} onChange={(event) => { const next = new Set(hiddenGuideIds); if (event.target.checked) next.delete(type.id); else next.add(type.id); saveHiddenGuides([...next]) }} />
            <EntityTypeIcon name={type.icon} className="size-3.5" /><span className="truncate">{type.pluralLabel}</span>
          </label>)}</div>
          {hiddenGuideIds.size > 0 && <button type="button" onClick={() => saveHiddenGuides([])} className="mt-2 flex items-center gap-1.5 text-[0.68rem] text-muted-foreground hover:text-sidebar-foreground"><RotateCcw className="size-3" />Mostrar todos</button>}
        </div>}
      </div>}
    </nav>
  )
}

function SidebarLink({
  href,
  active,
  collapsed,
  label,
  onNavigate,
  children,
}: {
  href: string
  active: boolean
  collapsed: boolean
  label: string
  onNavigate?: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        'mb-0.5 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
      )}
    >
      <span className="shrink-0">{children}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

