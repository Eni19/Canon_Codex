'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { CalendarDays, Clapperboard, LayoutDashboard, LibraryBig, FolderInput, Layers, Music, Network, Search, Settings } from 'lucide-react'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { useCodexSettings } from '@/components/wiki/codex-settings-provider'
import { useCommandPalette } from '@/components/wiki/command-palette-provider'
import { cn } from '@/lib/utils'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { TOOL_GUIDE, TOOL_IDS, type ToolId, type WorldPreferences } from '@/domain/worlds/worldPreferences'

const TOOLS: Record<ToolId, { href: string; icon: ReactNode }> = {
  calendar: { href: '/calendar', icon: <CalendarDays className="size-4" /> },
  relationships: { href: '/relationships', icon: <Network className="size-4" /> },
  boards: { href: '/boards', icon: <LayoutDashboard className="size-4" /> },
  scenes: { href: '/scenes', icon: <Clapperboard className="size-4" /> },
  soundtrack: { href: '/soundtrack', icon: <Music className="size-4" /> },
}

/**
 * Navegação da barra lateral (desktop e menu móvel). Conteúdos e ferramentas desativados nas
 * configurações do Codex (`preferences`) não aparecem; o botão Configurações abre a janela.
 */
export function WikiSidebarNav({
  entityTypes,
  preferences,
  collapsed = false,
  onNavigate,
}: {
  entityTypes: EntityTypeDefinition[]
  preferences: WorldPreferences
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const { setOpen: setCommandPaletteOpen } = useCommandPalette()
  const { openSettings } = useCodexSettings()
  const contentTypes = entityTypes.filter((type) => type.showInSidebar && !preferences.hiddenEntityTypes.includes(type.id))
  const tools = TOOL_IDS.filter((id) => !preferences.hiddenTools.includes(id))

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3">
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

      {contentTypes.length > 0 && <>
        {!collapsed && <p className="mt-5 mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Conteúdo</p>}
        {collapsed && <div className="my-3 border-t border-sidebar-border" />}
        {contentTypes.map((type) => (
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
      </>}

      {tools.length > 0 && <>
        {!collapsed && <p className="mt-5 mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Ferramentas</p>}
        {collapsed && <div className="my-3 border-t border-sidebar-border" />}
        {tools.map((id) => (
          <SidebarLink key={id} href={TOOLS[id].href} active={pathname.startsWith(TOOLS[id].href)} collapsed={collapsed} label={TOOL_GUIDE[id].label} onNavigate={onNavigate}>
            {TOOLS[id].icon}
          </SidebarLink>
        ))}
      </>}

      <div className="mt-auto pt-4">
        <div className="border-t border-sidebar-border pt-2">
          <button
            type="button"
            onClick={() => { onNavigate?.(); openSettings() }}
            title={collapsed ? 'Configurações' : undefined}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            <Settings className="size-4 shrink-0" />
            {!collapsed && <span>Configurações</span>}
          </button>
        </div>
      </div>
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
  children: ReactNode
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

