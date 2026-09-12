import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Standard page width/padding — opt-in per page so a page can instead go full-width if it needs to. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8', className)}>{children}</div>
}
