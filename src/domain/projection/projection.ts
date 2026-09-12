export interface ProjectionCamera {
  centerX: number
  centerY: number
  zoom: number
  viewWidth: number
  viewHeight: number
  sceneWidth: number
  sceneHeight: number
}

export interface PublicSceneBackground {
  assetId: string
  width: number
  height: number
}

export interface PublicToken {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  representation: 'cutout' | 'round'
  assetId?: string
  flipX: boolean
}

export interface PublicPoi {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  title: string
  publicDescription?: string
  presentationState: 'revealed'
}

export interface PublicGrid {
  enabled: boolean
  cellSize: number
  offsetX: number
  offsetY: number
  opacity: number
}

export interface ProjectionState {
  sceneId: string
  title: string
  background: PublicSceneBackground
  tokens: PublicToken[]
  pointsOfInterest: PublicPoi[]
  grid: PublicGrid
  camera: ProjectionCamera
  spotlight: ProjectionSpotlight | null
  revision: number
}

export type ProjectionSpotlight =
  | { kind:'entity'; id:string; title:string; typeLabel:string; assetId?:string; subtitle?:string; status?:string; aliases:string[]; tags:string[]; fields:Array<{label:string;value:string;wide?:boolean}> }
  | { kind:'poi'; id:string; title:string; poiKind:'text'|'evidence'|'document'; publicDescription?:string; discoveries:Array<{id:string;approach:string;condition:string;information:string}> }

export type ProjectionMessage =
  | { type: 'PROJECTION_READY' }
  | { type: 'REQUEST_FULL_STATE' }
  | { type: 'PING' }
  | { type: 'PONG' }
  | { type: 'FULL_STATE'; state: ProjectionState }
  | { type: 'TOKEN_UPDATE'; revision: number; token: PublicToken }
  | { type: 'TOKEN_REMOVE'; revision: number; tokenId: string }
  | { type: 'POI_UPDATE'; revision: number; poi: PublicPoi }
  | { type: 'POI_REMOVE'; revision: number; poiId: string }
  | { type: 'CAMERA_UPDATE'; revision: number; camera: ProjectionCamera }
  | { type: 'SPOTLIGHT_UPDATE'; revision: number; spotlight: ProjectionSpotlight | null }
  | { type: 'PROJECTION_STOPPED' }

export interface ProjectionTransport {
  connect(sessionId: string): void
  publish(message: ProjectionMessage): void
  subscribe(handler: (message: ProjectionMessage) => void): () => void
  disconnect(): void
}
