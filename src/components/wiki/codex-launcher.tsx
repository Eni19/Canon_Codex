'use client'

import { useActionState, useState } from 'react'
import { Archive, ArrowRight, BookOpen, FolderInput, Plus, Settings, X } from 'lucide-react'
import { createWorldAction, importWorldAction, openWorldAction, type WorldLibraryActionState } from '@/app/actions/worlds'
import type { World } from '@/domain/worlds/world'
import { WorldManageDialog } from '@/components/wiki/world-manage-dialog'
import styles from './codex-launcher.module.css'

const initialState: WorldLibraryActionState = {}

export function CodexLauncher({ worlds, activeWorldId }: { worlds: World[]; activeWorldId?: string }) {
  const [panel, setPanel] = useState<'create' | 'import' | null>(null)
  const [managedWorld, setManagedWorld] = useState<World | null>(null)
  const [createState, createAction, creating] = useActionState(createWorldAction, initialState)
  const [importState, importAction, importing] = useActionState(importWorldAction, initialState)
  const active = worlds.find((world) => world.id === activeWorldId) ?? worlds[0]

  return <main className={styles.launcher}>
    <div className={styles.frame}/>
    <section className={styles.brand}>
      <p>Arquivo de mundos</p>
      <dl>
        <div><dt>Codex registrados</dt><dd>{String(worlds.length).padStart(2, '0')}</dd></div>
        <div><dt>Sistema</dt><dd>LOCAL</dd></div>
        <div><dt>Arquivo ativo</dt><dd>{active?.name ?? '—'}</dd></div>
      </dl>
    </section>

    <section className={styles.menu}>
      <header><Archive/><div><small>CANON</small><h1>CODEX</h1></div></header>
      <p className={styles.intro}>Selecione um arquivo de mundo ou inicie um novo registro.</p>
      <div className={styles.worlds}>
        {worlds.map((world, index) => <div key={world.id} className={styles.worldRow}>
          <form action={openWorldAction}>
            <input type="hidden" name="worldId" value={world.id}/>
            <button type="submit" className={styles.worldButton} data-active={world.id === active?.id}>
              <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
              <span><small>{world.id === active?.id ? 'Arquivo ativo' : 'Mundo registrado'}</small><strong>{world.name}</strong><em>{world.description || 'Sem descrição.'}</em></span>
              <ArrowRight/>
            </button>
          </form>
          <button type="button" className={styles.manageButton} onClick={() => setManagedWorld(world)} aria-label={'Gerenciar ' + world.name} title="Renomear ou excluir"><Settings/></button>
        </div>)}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => setPanel('create')}><Plus/><span><small>Novo arquivo</small><strong>Criar Codex</strong></span></button>
        <button type="button" onClick={() => setPanel('import')}><FolderInput/><span><small>Fonte externa</small><strong>Carregar pasta</strong></span></button>
      </div>
    </section>

    <aside className={styles.metadata}>
      <span>ARQUIVO</span>
      <strong>{active?.name ?? 'Nenhum'}</strong>
      <i/>
      <span>ATUALIZADO</span>
      <strong>{active ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(active.updatedAt)) : '—'}</strong>
      <i/>
      <p>Seus dados permanecem em pastas locais e podem ser versionados ou copiados.</p>
    </aside>

    {managedWorld && <WorldManageDialog world={managedWorld} onClose={() => setManagedWorld(null)}/>}
    {panel && <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={panel === 'create' ? 'Criar Codex' : 'Carregar pasta'}>
      <div className={styles.dialog}>
        <button type="button" className={styles.close} onClick={() => setPanel(null)} aria-label="Fechar"><X/></button>
        {panel === 'create' ? <>
          <small>NOVO ARQUIVO</small><h2>Criar um Codex</h2><p>Um novo mundo será criado com todas as categorias padrão, pronto para receber seu conteúdo.</p>
          <form action={createAction}>
            <label>Nome<input name="name" required autoFocus placeholder="Nome do mundo"/></label>
            <label>Descrição<textarea name="description" rows={3} placeholder="Uma breve apresentação opcional..."/></label>
            {createState.error && <div className={styles.error}>{createState.error}</div>}
            <button type="submit" disabled={creating}>{creating ? 'Criando…' : 'Criar e abrir'}<ArrowRight/></button>
          </form>
        </> : <>
          <small>IMPORTAÇÃO LOCAL</small><h2>Carregar uma pasta</h2><p>Informe uma pasta de mundo com <code>world.json</code> ou a pasta raiz de outro Canon Codex. Uma cópia independente será guardada nesta biblioteca.</p>
          <form action={importAction}>
            <label>Caminho da pasta<input name="folderPath" required autoFocus placeholder={'C:\\Meus Mundos\\Outro Codex'}/></label>
            <div className={styles.hint}><BookOpen/>No Explorador de Arquivos, use “Copiar como caminho” e cole aqui.</div>
            {importState.error && <div className={styles.error}>{importState.error}</div>}
            <button type="submit" disabled={importing}>{importing ? 'Carregando…' : 'Importar e abrir'}<ArrowRight/></button>
          </form>
        </>}
      </div>
    </div>}
  </main>
}

