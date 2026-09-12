import { describe, expect, it } from 'vitest'
import { buildProjectionState, type ProjectionRuntimeState } from './projection-state-builder'

const runtime: ProjectionRuntimeState = {
  sceneId:'scene-1',title:'Cena',background:{assetId:'background',width:1600,height:900},
  grid:{enabled:true,cellSize:70,offsetX:0,offsetY:0,opacity:.2},
  camera:{centerX:800,centerY:450,zoom:1,viewWidth:1600,viewHeight:900,sceneWidth:1600,sceneHeight:900},
  spotlight:null,
  tokens:[
    {id:'visible-token',x:1,y:2,width:100,height:150,rotation:0,zIndex:1,representation:'cutout',assetId:'public-art',flipX:false,visibility:'visible'},
    {id:'secret-token',x:3,y:4,width:100,height:150,rotation:0,zIndex:2,representation:'cutout',assetId:'secret-art',flipX:false,visibility:'hidden'},
  ],
  pointsOfInterest:[
    {id:'visible-poi',x:5,y:6,width:180,height:38,rotation:0,zIndex:3,title:'Porta',publicDescription:'Uma porta antiga.',visibility:'visible'},
    {id:'secret-poi',x:7,y:8,width:180,height:38,rotation:0,zIndex:4,title:'Segredo',publicDescription:'Informação privada.',visibility:'hidden'},
  ],
}

describe('buildProjectionState',()=>{
  it('remove tokens e pontos ocultos do estado público',()=>{
    const state=buildProjectionState(runtime,12)
    expect(state.tokens.map((token)=>token.id)).toEqual(['visible-token'])
    expect(state.pointsOfInterest.map((poi)=>poi.id)).toEqual(['visible-poi'])
    expect(JSON.stringify(state)).not.toContain('secret-art')
    expect(JSON.stringify(state)).not.toContain('Informação privada')
    expect(state.revision).toBe(12)
  })
})
