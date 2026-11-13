import type { CSSProperties } from 'react'
import { colorContrast, type resolveCalendarTheme } from '@/domain/worlds/calendar-appearance'
import { assetVariantUrl } from '@/lib/assetUrl'
import { MoonDisc } from './moon-disc'
import styles from './calendar-cover.module.css'

type Theme = ReturnType<typeof resolveCalendarTheme>

export function calendarThemeStyle(theme: Theme, themeId: string): CSSProperties {
  const celeste = themeId === 'celeste'
  const { text, accent, surface, border } = celeste
    ? { ...theme.colors, surface: '#111b2d', border: '#53627e' }
    : theme.colors

  return {
    '--background': surface,
    '--foreground': text,
    '--border': border,
    '--input': border,
    '--primary': accent,
    '--primary-foreground': colorContrast(accent, '#000000') >= 4.5 ? '#000000' : '#ffffff',
    '--muted': `color-mix(in srgb, ${text} 7%, ${surface})`,
    '--muted-foreground': `color-mix(in srgb, ${text} 88%, ${surface})`,
    '--card': `color-mix(in srgb, ${surface} 95%, ${text})`,
    '--card-foreground': text,
    '--ring': accent,
    '--destructive': colorContrast('#9c3030', surface) >= 4.5 ? '#9c3030' : '#ffaaa3',
    ...(celeste && {
      '--calendar-page': '#0c1423',
      '--calendar-weekdays': '#263957',
      '--calendar-weekdays-text': '#f6f1e8',
      '--calendar-day': '#162238',
      '--calendar-day-hover': '#20304b',
      '--calendar-day-selected': '#2a3c59',
      '--accent': '#253752',
      '--accent-foreground': text,
      '--secondary': '#22324d',
      '--secondary-foreground': text,
    }),
    colorScheme: colorContrast(text, '#000000') > colorContrast(surface, '#000000') ? 'dark' : 'light',
    backgroundColor: celeste ? 'var(--calendar-page)' : surface,
    color: text,
  } as CSSProperties
}

export function CalendarCover({ theme, title, year, era, moons, preview = false }: {
  theme: Theme
  title: string
  year: number
  era?: string
  moons: { id: string; color: string; position: number }[]
  preview?: boolean
}) {
  const custom = 'backgroundAssetId' in theme ? theme : undefined
  const image = custom?.backgroundAssetId
  const style = {
    '--cover-surface': theme.colors.surface,
    '--cover-text': theme.colors.text,
    '--cover-accent': theme.colors.accent,
    '--background': theme.colors.surface,
  } as CSSProperties

  return <header className={preview ? `${styles.cover} ${styles.preview}` : styles.cover} style={style}>
    {image && <picture className={styles.image}>
      {!preview && <source media="(min-width: 768px)" srcSet={assetVariantUrl(image, 'calendar-desktop')} />}
      {/* Calendar variants are served directly with the active world cookie. */}
      <img src={assetVariantUrl(image, 'calendar-mobile')} alt="" style={{
        objectPosition: `${custom.focalPoint.x * 100}% ${custom.focalPoint.y * 100}%`,
        filter: `brightness(${1 - custom.overlayOpacity})`,
      }} />
    </picture>}
    <div className={styles.composition}>
      {moons.slice(0, 2).map((moon, index) => <span key={moon.id} className={index === 0 ? styles.leftMoon : styles.rightMoon} aria-hidden="true"><MoonDisc color={moon.color} position={moon.position} /></span>)}
      <div className={styles.center}>
        <p className={styles.label}>Calendário</p>
        {preview ? <p className={styles.title}>{title}</p> : <h1 className={styles.title}>{title}</h1>}
        <p className={styles.year}>{year}</p>
        {era && <p className={styles.era}>{era}</p>}
      </div>
    </div>
  </header>
}
