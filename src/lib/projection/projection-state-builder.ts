import type { ProjectionCamera, ProjectionSpotlight, ProjectionState, PublicGrid, PublicPoi, PublicSceneBackground, PublicToken } from '@/domain/projection/projection'

export type ProjectionRuntimeToken = PublicToken & { visibility: 'visible' | 'hidden' }
export type ProjectionRuntimePoi = Omit<PublicPoi, 'presentationState'> & { visibility: 'visible' | 'hidden' }

export interface ProjectionRuntimeState {
  sceneId: string
  title: string
  background: PublicSceneBackground
  tokens: ProjectionRuntimeToken[]
  pointsOfInterest: ProjectionRuntimePoi[]
  grid: PublicGrid
  camera: ProjectionCamera
  spotlight: ProjectionSpotlight | null
}

/** Security boundary: hidden records and their render metadata never leave the master window. */
export function buildProjectionState(runtime: ProjectionRuntimeState, revision: number): ProjectionState {
  return {
    sceneId: runtime.sceneId,
    title: runtime.title,
    background: { ...runtime.background },
    tokens: runtime.tokens.flatMap(({ visibility, ...token }) => visibility === 'visible' ? [token] : []),
    pointsOfInterest: runtime.pointsOfInterest.flatMap(({ visibility, ...poi }) => visibility === 'visible' ? [{ ...poi, presentationState: 'revealed' as const }] : []),
    grid: { ...runtime.grid },
    camera: { ...runtime.camera },
    spotlight: runtime.spotlight ? structuredClone(runtime.spotlight) : null,
    revision,
  }
}
