import { typewriter } from './notebook-fonts'
import styles from './notebook.module.css'

/**
 * A brief cover while the notebook is put together: first while its code loads, then while the 3D
 * scene draws and the first page pictures are taken. Just the name, typed, softly pulsing on the
 * dark desk colour; it fades away once `done`.
 */
export function NotebookLoading({ done = false }: { done?: boolean }) {
  return <div className={`${styles.loading} ${typewriter.variable}`} data-done={done || undefined} role="status" aria-label="Abrindo o Codex" aria-hidden={done || undefined}>
    <span className={styles.loadingName}>Canon Codex</span>
  </div>
}
