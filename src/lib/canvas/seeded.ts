/**
 * Deterministic randomness for procedural textures: the same seed always draws the same texture,
 * so a texture never changes between renders, sessions or machines.
 */

/** A small linear congruential generator returning numbers in [0, 1). */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/** FNV-1a hash of a text, to turn a name or id into a seed. */
export const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0 }
