'use client'

import { Maximize } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectionMessage, ProjectionState } from '@/domain/projection/projection'
import { BroadcastChannelProjectionTransport } from '@/lib/projection/broadcast-channel-transport'
import { ProjectionDisplay } from './projection-display'
import styles from './projection-window.module.css'

function applyMessage(current: ProjectionState, message: ProjectionMessage): ProjectionState {
  if (!('revision' in message)) return current
  if (message.type==='TOKEN_UPDATE') return {...current,revision:message.revision,tokens:[...current.tokens.filter((item)=>item.id!==message.token.id),message.token]}
  if (message.type==='TOKEN_REMOVE') return {...current,revision:message.revision,tokens:current.tokens.filter((item)=>item.id!==message.tokenId)}
  if (message.type==='POI_UPDATE') return {...current,revision:message.revision,pointsOfInterest:[...current.pointsOfInterest.filter((item)=>item.id!==message.poi.id),message.poi]}
  if (message.type==='POI_REMOVE') return {...current,revision:message.revision,pointsOfInterest:current.pointsOfInterest.filter((item)=>item.id!==message.poiId)}
  if (message.type==='CAMERA_UPDATE') return {...current,revision:message.revision,camera:message.camera}
  if (message.type==='SPOTLIGHT_UPDATE') return {...current,revision:message.revision,spotlight:message.spotlight}
  return current
}

export function ProjectionWindow({sessionId}:{sessionId:string}){
  const transport=useMemo(()=>new BroadcastChannelProjectionTransport(),[]),stateRef=useRef<ProjectionState|null>(null),lastSeen=useRef(0),[state,setState]=useState<ProjectionState|null>(null),[connected,setConnected]=useState(false),[stopped,setStopped]=useState(false)
  useEffect(()=>{transport.connect(sessionId);const unsubscribe=transport.subscribe((message)=>{lastSeen.current=Date.now();if(message.type==='FULL_STATE'){stateRef.current=message.state;setState(message.state);setConnected(true);setStopped(false);return}if(message.type==='PONG'){setConnected(true);return}if(message.type==='PROJECTION_STOPPED'){setStopped(true);setConnected(false);return}const current=stateRef.current;if(!current||!('revision'in message))return;if(message.revision!==current.revision+1){transport.publish({type:'REQUEST_FULL_STATE'});return}const next=applyMessage(current,message);stateRef.current=next;setState(next)});transport.publish({type:'PROJECTION_READY'});const ping=window.setInterval(()=>{transport.publish({type:'PING'});if(Date.now()-lastSeen.current>5000)setConnected(false)},2000);return()=>{window.clearInterval(ping);unsubscribe();transport.disconnect()}},[sessionId,transport])
  return <main className={styles.window}><ProjectionDisplay state={stopped?null:state} connected={connected} zoomMultiplier={1.08}/><button className={styles.fullscreen} onClick={()=>document.documentElement.requestFullscreen()} title="Tela cheia"><Maximize/></button></main>
}
