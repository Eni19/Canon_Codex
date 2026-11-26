import {
  Building2,
  CalendarClock,
  Circle,
  Dna,
  Eclipse,
  FileText,
  Fingerprint,
  FolderSearch,
  Gem,
  History,
  KeyRound,
  Lightbulb,
  Microscope,
  BookOpenText,
  Orbit,
  MapPin,
  PawPrint,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  UserRound,
  UsersRound,
  Dna,
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
  KeyRound,
  Lightbulb,
  Microscope,
  History,
  BookOpenText,
  Orbit,
  Eclipse,
}

export function EntityTypeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle
  return <Icon className={className} aria-hidden="true" />
}
