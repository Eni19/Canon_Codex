import {
  Building2,
  CalendarClock,
  Circle,
  FileText,
  Fingerprint,
  FolderSearch,
  Gem,
  History,
  Lightbulb,
  BookOpenText,
  Orbit,
  MapPin,
  PawPrint,
  Search,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  UserRound,
  MapPin,
  Building2,
  FolderSearch,
  CalendarClock,
  FileText,
  Fingerprint,
  Search,
  PawPrint,
  Sparkles,
  Gem,
  Lightbulb,
  History,
  BookOpenText,
  Orbit,
}

export function EntityTypeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle
  return <Icon className={className} aria-hidden="true" />
}
