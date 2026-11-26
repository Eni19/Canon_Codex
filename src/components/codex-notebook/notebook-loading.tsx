import { hand, typewriter } from './notebook-fonts'
import styles from './notebook.module.css'

/**
 * A brief cover while the notebook is put together: first while its code loads, then while the 3D
 * scene draws and the first page pictures are taken. It shows the Codex itself, small: a leather
 * notebook with brass corners and its band, a line of ink writing itself, and the name typed below.
 * It fades away once `done`.
 */
export function NotebookLoading({ done = false }: { done?: boolean }) {
  return <div className={`${styles.loading} ${hand.variable} ${typewriter.variable}`} data-done={done || undefined} role="status" aria-label="Abrindo o Codex" aria-hidden={done || undefined}>
    <div className={styles.loadingMark}>
      <span className={styles.loadingBook}><span className={styles.loadingBand}/></span>
      <svg className={styles.loadingInk} viewBox="0 0 120 18" aria-hidden>
        <path d="M4 11 C 18 4, 28 15, 42 9 S 66 4, 78 10 S 102 14, 116 7"/>
      </svg>
      <span className={styles.loadingName}>Canon Codex</span>
    </div>
  </div>
}
