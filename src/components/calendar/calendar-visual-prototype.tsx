'use client'

// PROTÓTIPO descartável: três organizações para capa, ano e mês, usando apenas dados sintéticos.
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './calendar-visual-prototype.module.css'

const months = ['Alvor', 'Bruma', 'Vento', 'Chuva', 'Broto', 'Sol', 'Colheita', 'Âmbar', 'Névoa', 'Geada', 'Noite']
const lengths = [27, 30, 32, 28, 31, 30, 29, 32, 28, 30, 31]
const weekdays = ['Sol', 'Lua', 'Mar', 'Ter', 'Ven', 'Est', 'Céu']
const labels = ['A · Almanaque celeste', 'B · Ano em destaque', 'C · Agenda lateral']

function Moons({ day }: { day: number }) {
  return <span className={styles.moons} aria-label={`Duas luas, dia ${day}`}><i style={{ '--light': `${Math.round(50 - 50 * Math.cos(day * Math.PI / 14))}%` } as React.CSSProperties} /><i style={{ '--light': `${Math.round(50 - 50 * Math.cos(day * Math.PI / 9))}%` } as React.CSSProperties} /></span>
}

function Month() {
  return <section className={styles.month} aria-label="Mês sintético de Broto"><header><div><small>QUINTO MÊS · PRIMAVERA</small><h2>Broto <em>836</em></h2></div><span>← &nbsp; →</span></header>
    <div className={styles.grid}>{weekdays.map((day) => <b key={day}>{day}</b>)}{Array.from({ length: 31 }, (_, i) => { const day = i + 1; return <div className={styles.day} key={day}><span>{day}</span>{day === 15 && <small>✦ Florescer<br />✧ Feira da luz</small>}{day === 16 && <small>☼ Verão começa</small>}<Moons day={day} /></div> })}</div>
    <p className={styles.legend}>● Lua Âmbar &nbsp;&nbsp; ● Lua Azul &nbsp;&nbsp; ✦ Festival &nbsp;&nbsp; ☼ Estação</p>
  </section>
}

function Year() {
  return <section className={styles.year}><div><small>O ANO EM UM OLHAR</small><h2>Os onze meses</h2></div><div className={styles.cards}>{months.map((name, i) => <article key={name}><small>{String(i + 1).padStart(2, '0')} / 11</small><h3>{name}</h3><span>{lengths[i]} dias · {i < 3 ? 'Inverno' : i < 5 ? 'Primavera' : i < 8 ? 'Verão' : 'Outono'}</span></article>)}</div></section>
}

function Cover() {
  return <header className={styles.cover}><span className={styles.coverMoons}>◐ &nbsp; ◑</span><small>UM ALMANAQUE DO MUNDO SINTÉTICO</small><h1>O calendário<br /><em>das duas luas</em></h1><p>O tempo, as estações e as histórias de uma campanha imaginária.</p><strong>836</strong></header>
}

function Detail() {
  return <aside className={styles.detail}><small>DATA SELECIONADA</small><h2>15 de Broto</h2><p>Dois acontecimentos compartilham este dia de primavera.</p><hr /><h3>✦ Florescer</h3><p>Festival · Celebração do jardim.</p><h3>✧ Feira da luz</h3><p>Encontro · A praça reúne viajantes.</p><hr /><h3>☼ Próxima estação</h3><p>O verão começa no dia 16.</p><h3>◐ &nbsp; ◑ &nbsp; Duas luas</h3><p>Âmbar e Azul seguem ciclos distintos.</p></aside>
}

export function CalendarVisualPrototype() {
  const router = useRouter()
  const search = useSearchParams()
  const raw = Number(search.get('variant'))
  const variant = raw >= 1 && raw <= 3 && Number.isInteger(raw) ? raw : 1
  const [view, setView] = useState<'month' | 'year' | 'cover'>('month')
  function move(direction: number) { router.replace(`/calendar?prototype=visual&variant=${((variant - 1 + direction + 3) % 3) + 1}`, { scroll: false }) }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select, [contenteditable="true"]') || event.target.isContentEditable)) return
      if (event.key === 'ArrowLeft') move(-1)
      if (event.key === 'ArrowRight') move(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return <div className={`${styles.prototype} ${styles[`variant${variant}`]}`}>
    <div className={styles.notice}>PROTÓTIPO VISUAL · dados sintéticos · sem salvamento</div>
    <nav className={styles.tabs} aria-label="Vistas do protótipo">{(['cover', 'year', 'month'] as const).map((item) => <button type="button" key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item === 'cover' ? 'Capa' : item === 'year' ? 'Ano' : 'Mês'}</button>)}</nav>
    {view === 'cover' ? <Cover /> : view === 'year' ? <Year /> : variant === 1 ? <><div className={styles.miniCover}><span>◐ &nbsp; ◑</span><div><small>CALENDÁRIO DAS DUAS LUAS</small><h1>O tempo de uma história</h1></div><strong>836</strong></div><div className={styles.split}><Month /><Detail /></div></> : variant === 2 ? <><div className={styles.title}><small>ALMANAQUE · ANO 836</small><h1>O ano em movimento</h1><p>Primavera em Broto · uma visão dos ciclos e das celebrações</p></div><div className={styles.yearStrip}>{months.map((month) => <span key={month} className={month === 'Broto' ? styles.active : ''}>{month}</span>)}</div><Month /><Detail /></> : <div className={styles.splitReverse}><Detail /><div><div className={styles.title}><small>ARQUIVO DO TEMPO · 836</small><h1>Entre duas luas</h1></div><Month /></div></div>}
    <div className={styles.switcher} aria-label="Alternar protótipos"><button type="button" onClick={() => move(-1)} aria-label="Variação anterior">←</button><span>{labels[variant - 1]} · {view === 'month' ? 'Mês' : view === 'year' ? 'Ano' : 'Capa'}</span><button type="button" onClick={() => move(1)} aria-label="Próxima variação">→</button></div>
  </div>
}
