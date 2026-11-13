type MoonDiscProps = { color: string; position: number; className?: string }

/** Dark disc with the lit area shaped by the position in the lunar cycle. */
export function MoonDisc({ color, position, className }: MoonDiscProps) {
  const waxing = position < 0.5
  const cosine = Math.cos(2 * Math.PI * position)
  const radius = Math.max(0.001, 10 * Math.abs(cosine))
  const outerSweep = waxing ? 1 : 0
  const innerSweep = waxing ? (cosine >= 0 ? 0 : 1) : (cosine >= 0 ? 1 : 0)
  const illuminated = `M 10 0 A 10 10 0 0 ${outerSweep} 10 20 A ${radius} 10 0 0 ${innerSweep} 10 0 Z`
  const edge = `color-mix(in srgb, ${color} 65%, var(--moon-outline, var(--foreground)))`
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className={className}>
    <circle cx="10" cy="10" r="9.5" fill="var(--background)" />
    <path d={illuminated} fill={color} />
    <circle cx="10" cy="10" r="9.5" fill="none" stroke={edge} />
  </svg>
}
