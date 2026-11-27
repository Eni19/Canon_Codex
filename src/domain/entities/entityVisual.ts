/**
 * Visual identity of a record type on the relationship graph and on boards: a silhouette (the card
 * outline) and a texture (a subtle fill pattern). Together with the type's icon and label they let
 * a type be told apart without relying on colour (WCAG 1.4.1). See ADR-011.
 *
 * The catalog is code keyed by type id, like the custom pages of ADR-010. It is not persisted: a
 * world keeps no visual data, and any type outside the catalog (created by the user, or renamed)
 * gets the neutral card. Renderers draw the shapes; this module only names them.
 */

/**
 * Card outlines. Every silhouette is drawn inside the current 180×70 card box and touches the
 * midpoint of each side, so connection anchors, ports and graph framing keep working unchanged.
 */
export const ENTITY_SILHOUETTES = [
  'rounded',
  'badge',
  'hexagon',
  'ticket',
  'pediment',
  'folder',
  'flag',
  'scroll',
  'foldedCorner',
  'serrated',
  'tag',
  'organic',
  'capsule',
  'wavy',
  'chamfered',
  'squircle',
  'arch',
  'ruler',
] as const
export type SilhouetteId = (typeof ENTITY_SILHOUETTES)[number]

/** Procedural fill patterns, drawn at low opacity over the card's solid fill. */
export const ENTITY_TEXTURES = [
  'none',
  'photoGrain',
  'honeycomb',
  'contour',
  'brick',
  'kraftFiber',
  'diagonalHatch',
  'agedStains',
  'ruledLines',
  'halftone',
  'crossHatch',
  'fur',
  'cells',
  'sineWaves',
  'brushedMetal',
  'grid',
  'orbitalRings',
  'verticalStripes',
] as const
export type TextureId = (typeof ENTITY_TEXTURES)[number]

export interface EntityVisual {
  readonly silhouette: SilhouetteId
  readonly texture: TextureId
}

/** Today's card: what any type outside the catalog gets. No shape is drawn at random for a new
 * type, so the card never suggests a meaning the user did not choose. */
export const NEUTRAL_ENTITY_VISUAL: EntityVisual = Object.freeze({ silhouette: 'rounded', texture: 'none' })

const visual = (silhouette: SilhouetteId, texture: TextureId): EntityVisual => Object.freeze({ silhouette, texture })

/** One distinct silhouette and texture per type of the seed world (issue #72). */
export const ENTITY_VISUAL_CATALOG: Readonly<Record<string, EntityVisual>> = Object.freeze({
  character: visual('badge', 'photoGrain'),
  species: visual('hexagon', 'honeycomb'),
  location: visual('ticket', 'contour'),
  organization: visual('pediment', 'brick'),
  case: visual('folder', 'kraftFiber'),
  event: visual('flag', 'diagonalHatch'),
  tale: visual('scroll', 'agedStains'),
  document: visual('foldedCorner', 'ruledLines'),
  evidence: visual('serrated', 'halftone'),
  clue: visual('tag', 'crossHatch'),
  creature: visual('organic', 'fur'),
  naturalScience: visual('capsule', 'cells'),
  phenomenon: visual('wavy', 'sineWaves'),
  artifact: visual('chamfered', 'brushedMetal'),
  concept: visual('squircle', 'grid'),
  cosmology: visual('arch', 'orbitalRings'),
  timeline: visual('ruler', 'verticalStripes'),
})

/** The visual identity of a record type, or the neutral card when the type is not in the catalog. */
export function entityVisualFor(typeId: string): EntityVisual {
  return Object.hasOwn(ENTITY_VISUAL_CATALOG, typeId) ? ENTITY_VISUAL_CATALOG[typeId] : NEUTRAL_ENTITY_VISUAL
}
