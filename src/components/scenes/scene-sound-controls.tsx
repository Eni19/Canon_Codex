'use client'

import { Cast, ListMusic, Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, TriangleAlert } from 'lucide-react'
import { useSoundtrack } from '@/components/soundtrack/soundtrack-provider'
import styles from './scene-runner.module.css'

/** Music controls for the Mestrar tab: what is playing, transport buttons and a door to every playlist. */
export function SceneSoundControls() {
  const sound = useSoundtrack()
  const track = sound.tracks.find((item) => item.id === sound.currentTrackId)
  const busy = sound.status === 'loading'
  const playing = sound.status === 'playing' || busy
  const { projectionAudio } = sound

  return (
    <section className={styles.soundControls}>
      <h3>Trilha sonora</h3>
      <p className={styles.soundNow}>{track ? track.title : 'Nada tocando'}</p>
      {track && sound.source && <small className={styles.soundSource}>{sound.source.playlistTitle}</small>}
      <div className={styles.soundButtons}>
        <button type="button" onClick={sound.toggleShuffle} aria-pressed={sound.shuffle} className={sound.shuffle ? styles.soundOn : ''} title="Aleatório"><Shuffle /></button>
        <button type="button" onClick={sound.previous} disabled={!track} title="Faixa anterior"><SkipBack /></button>
        <button type="button" onClick={sound.toggle} disabled={!track} title={playing ? 'Pausar' : 'Tocar'}>{busy ? <Loader2 className={styles.spin} /> : playing ? <Pause /> : <Play />}</button>
        <button type="button" onClick={sound.next} disabled={!track} title="Próxima faixa"><SkipForward /></button>
        <button type="button" onClick={sound.cycleRepeat} aria-pressed={sound.repeat !== 'off'} className={sound.repeat !== 'off' ? styles.soundOn : ''} title={`Repetir: ${sound.repeat === 'off' ? 'desligado' : sound.repeat === 'all' ? 'playlist' : 'faixa'}`}>{sound.repeat === 'one' ? <Repeat1 /> : <Repeat />}</button>
      </div>
      <input type="range" min={0} max={100} value={sound.volume} onChange={(event) => sound.setVolume(Number(event.target.value))} aria-label="Volume da trilha" className={styles.soundVolume} />
      <button type="button" className={styles.soundBrowse} onClick={sound.openBrowser}><ListMusic />Playlists e faixas</button>
      {projectionAudio.connected && <p className={styles.soundHint}><Cast />Tocando pela projeção</p>}
      {projectionAudio.connected && <label className={styles.soundCheck}><input type="checkbox" checked={projectionAudio.showPlayer} onChange={(event) => projectionAudio.setShowPlayer(event.target.checked)} />Mostrar o player na projeção</label>}
      {projectionAudio.blocked && <p className={styles.soundWarning}><TriangleAlert />O navegador bloqueou o áudio na janela de projeção. Clique nela uma vez para ativar.</p>}
    </section>
  )
}
