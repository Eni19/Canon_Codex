import Image from 'next/image'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { assetVariantUrl } from '@/lib/assetUrl'
import { coverFramingTransform, DEFAULT_COVER_FRAMING, type CoverFraming } from '@/domain/entities/coverFraming'

/**
 * Large, frameless portrait (object-cover, top-anchored so the bottom crops rather than shrinking
 * the figure) with a soft glow and a rim-light drop shadow in the app's accent color — for
 * transparent-background character art. See .agents/skills/design-inspiration/style-notes.md.
 *
 * The rim light is applied outside the image crop, so only the art is clipped and the glow
 * can fade naturally beyond the portrait column. `framing` moves/zooms the art inside that crop;
 * its default is the original top-anchored 1.4× presentation.
 */
export function PortraitHero({
  coverAssetId,
  fallbackIcon,
  className = 'h-[28rem] sm:h-[34rem]',
  framing = DEFAULT_COVER_FRAMING,
}: {
  coverAssetId?: string
  fallbackIcon: string
  className?: string
  framing?: CoverFraming
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[30%] left-1/2 size-36 -translate-x-1/2 -translate-y-1/2"
        style={{
          // The glow div has its own fixed width/height and is centered via transform, not via
          // `inset` percentages of the parent — so its size can never be read as "limited by the
          // column width". `closest-side` makes the circle end exactly at the div's edges; a bare
          // `circle` defaults to farthest-corner and gets cut into a visible square by the box.
          background: 'radial-gradient(circle closest-side, color-mix(in oklch, var(--primary) 18%, transparent), transparent 100%)',
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
              className="relative z-10 origin-top object-cover object-top"
              style={{ transform: coverFramingTransform(framing) }}
              data-framing-target
              draggable={false}
              unoptimized
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
