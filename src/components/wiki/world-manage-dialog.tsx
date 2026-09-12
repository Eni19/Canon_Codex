'use client'

import { useActionState } from 'react'
import { ArrowRight, Trash2, X } from 'lucide-react'
import { manageWorldAction, type WorldLibraryActionState } from '@/app/actions/worlds'
import type { World } from '@/domain/worlds/world'
import styles from './codex-launcher.module.css'

const initialState: WorldLibraryActionState = {}

export function WorldManageDialog({ world, onClose }: { world: World; onClose: () => void }) {
  const [state, action, pending] = useActionState(manageWorldAction, initialState)
  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={'Gerenciar ' + world.name}>
    <div className={styles.dialog}>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar"><X/></button>
      <small>GESTÃO DO ARQUIVO</small>
      <h2>{world.name}</h2>
      <p>Altere a identificação deste Codex ou remova seu arquivo da biblioteca.</p>
      <form action={action}>
        <input type="hidden" name="worldId" value={world.id}/>
        <label>Nome<input name="name" required defaultValue={world.name}/></label>
        {state.error && <div className={styles.error}>{state.error}</div>}
        <button type="submit" name="intent" value="rename" disabled={pending}>{pending ? 'Salvando…' : 'Salvar novo nome'}<ArrowRight/></button>
      </form>
      <form action={action} className={styles.dangerZone} onSubmit={(event) => { if (!window.confirm('Excluir “' + world.name + '” da biblioteca? Os arquivos serão movidos para a lixeira interna.')) event.preventDefault() }}>
        <input type="hidden" name="worldId" value={world.id}/>
        <div><strong>Excluir este Codex</strong><p>O mundo será removido da biblioteca e movido para a pasta de lixeira.</p></div>
        <button type="submit" name="intent" value="delete" disabled={pending}><Trash2/>Excluir</button>
      </form>
    </div>
  </div>
}
