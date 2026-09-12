import Image from 'next/image'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { assetVariantUrl } from '@/lib/assetUrl'

/**
 * Large, frameless portrait (object-cover, top-anchored so the bottom crops rather than shrinking
 * the figure) with a soft glow and a rim-light drop shadow in the app's accent color — for
 * transparent-background character art. See .agents/skills/design-inspiration/style-notes.md.
 *
 * The rim light is applied outside the image crop, so only the art is clipped and the glow
 * can fade naturally beyond the portrait column.
 */
export function PortraitHero({
  coverAssetId,
  fallbackIcon,
  className = 'h-[28rem] sm:h-[34rem]',
}: {
  coverAssetId?: string
  fallbackIcon: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[30%] left-1/2 size-36 -translate-x-1/2 -translate-y-1/2"
        style={{
          // The glow div has its own fixed width/height and is centered via transform, not via
          // `inset` percentages of the parent — so its size can never be read as "limited by the
          // column width". A bare `circle` (no explicit radius) sizes itself to the div's own
          // box (farthest-side), so it's always a perfect, fully self-contained circle.
          background: 'radial-gradient(circle, color-mix(in oklch, var(--primary) 18%, transparent), transparent 100%)',
        }}
      />

      <div
        className="absolute inset-0 overflow-visible"
        style={coverAssetId ? { filter: 'drop-shadow(0 0 24px color-mix(in oklch, var(--primary) 40%, transparent))' } : undefined}
      >
        <div
          className="absolute inset-0 overflow-visible"
          style={{ clipPath: 'inset(0 -100vw)' }}
        >
          {coverAssetId ? (
            <Image
              src={assetVariantUrl(coverAssetId, 'original')}
              alt=""
              fill
              sizes="100vw"
              quality={90}
              className="relative z-10 origin-top object-cover object-top scale-[1.4]"
              priority
            />
          ) : (
            <div className="relative z-10 flex h-full items-center justify-center">
              <EntityTypeIcon name={fallbackIcon} className="size-16 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
