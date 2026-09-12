'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { ProjectionState } from '@/domain/projection/projection'
import { assetVariantUrl } from '@/lib/assetUrl'
import styles from './projection-display.module.css'

export function ProjectionDisplay({
  state,
  connected = true,
  zoomMultiplier = 1,
}: {
  state: ProjectionState | null
  connected?: boolean
  zoomMultiplier?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(host)
    return () => observer.disconnect()
  }, [])
  const camera = state?.camera
  const scale = camera && size.width && size.height
    ? Math.min(size.width / camera.viewWidth, size.height / camera.viewHeight) * zoomMultiplier
    : 1
  const transform = camera ? `translate(${size.width / 2 - camera.centerX * scale}px,${size.height / 2 - camera.centerY * scale}px) scale(${scale})` : undefined
  return <div ref={hostRef} className={styles.display}>
    {state && <div className={styles.scene} style={{ width:state.background.width, height:state.background.height, transform }}>
      <Image className={styles.background} src={assetVariantUrl(state.background.assetId,'original')} alt="" width={state.background.width} height={state.background.height} unoptimized priority draggable={false}/>
      {state.grid.enabled&&<div className={styles.grid} style={{opacity:state.grid.opacity,backgroundSize:`${state.grid.cellSize}px ${state.grid.cellSize}px`,backgroundPosition:`${state.grid.offsetX}px ${state.grid.offsetY}px`}}/>}
      {state.tokens.map((token)=><div key={token.id} className={`${styles.token} ${token.representation==='round'?styles.round:styles.cutout}`} style={{left:token.x,top:token.y,width:token.width,height:token.height,zIndex:token.zIndex,transform:`rotate(${token.rotation}rad)`}}>{token.assetId&&<Image src={assetVariantUrl(token.assetId,'original')} alt="" width={500} height={700} unoptimized draggable={false} style={{transform:token.flipX?'scaleX(-1)':undefined}}/>}</div>)}
      {state.pointsOfInterest.map((poi)=><div key={poi.id} className={styles.poi} style={{left:poi.x,top:poi.y,width:poi.width,height:poi.height,zIndex:poi.zIndex,transform:`rotate(${poi.rotation??0}rad)`}}><i/><span>{poi.title}</span></div>)}
    </div>}
    {state?.spotlight&&<aside className={styles.spotlight}>{state.spotlight.kind==='entity'?<><span className={styles.spotlightKind}>{state.spotlight.typeLabel}</span>{state.spotlight.assetId&&<div className={styles.spotlightPhoto}><Image src={assetVariantUrl(state.spotlight.assetId,'original')} alt="" width={640} height={420} unoptimized/></div>}<h2>{state.spotlight.title}</h2>{state.spotlight.subtitle&&<p className={styles.subtitle}>{state.spotlight.subtitle}</p>}{state.spotlight.status&&<em>{state.spotlight.status}</em>}{state.spotlight.aliases.length>0&&<p className={styles.aliases}>{state.spotlight.aliases.join(' · ')}</p>}{state.spotlight.fields.length>0&&<dl>{state.spotlight.fields.map((field)=><div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}<div className={styles.spotlightTags}>{state.spotlight.tags.map((tag)=><span key={tag}>{tag}</span>)}</div></>:<><span className={styles.spotlightKind}>{state.spotlight.poiKind==='text'?'Ponto de interesse':state.spotlight.poiKind==='evidence'?'Evidência':'Documento'}</span><h2>{state.spotlight.title}</h2>{state.spotlight.publicDescription&&<p className={styles.poiText}>{state.spotlight.publicDescription}</p>}{state.spotlight.discoveries.length>0&&<div className={styles.spotlightDiscoveries}>{state.spotlight.discoveries.map((item)=><article key={item.id}><header><strong>{item.approach||'Abordagem livre'}</strong>{item.condition&&<span>{item.condition}</span>}</header><p>{item.information}</p></article>)}</div>}</>}</aside>}
    {!state&&<div className={styles.waiting}><span/>Aguardando a cena do mestre</div>}
    {state&&!connected&&<div className={styles.disconnected}>Projeção desconectada · último quadro mantido</div>}
  </div>
}
