import { cookies } from 'next/headers'
import { CodexLauncher } from '@/components/wiki/codex-launcher'
import { describeTrashRemaining } from '@/domain/trash/trash'
import { getTrashRepository, getWorldRepository, LegacyMigrationRequiredError } from '@/repositories'

async function loadLibrary() {
  try {
    const repository = getWorldRepository()
    const worlds = await repository.listWorlds()
    const missingWorldMetadata = await repository.listMissingWorldMetadata()
    const now = new Date()
    const trashedWorlds = (await getTrashRepository()?.listTrashedWorlds(now) ?? [])
      .map((world) => ({ id: world.id, name: world.name, remaining: describeTrashRemaining(world.expiresAt, now) }))
    return { worlds, missingWorldMetadata, trashedWorlds }
  } catch (error) {
    if (error instanceof LegacyMigrationRequiredError) return null
    throw error
  }
}

export default async function LibraryPage() {
  const activeWorldId = (await cookies()).get('canon-codex-world')?.value
  const library = await loadLibrary()
  if (!library) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 py-20">
        <h1 className="font-serif text-3xl">Migração da biblioteca</h1>
        <p>Esta biblioteca ainda usa arquivos. Use <code>pnpm storage preview</code> e <code>pnpm storage import</code> para convertê-la para SQLite.</p>
        <p>Para continuar usando os arquivos por enquanto, defina <code>PERSISTENCE_DRIVER=filesystem</code> em <code>.env.local</code> e reinicie o servidor.</p>
        <p>As instruções de migração e backup estão em <code>docs/data/sqlite.md</code>.</p>
      </main>
    )
  }
  return <CodexLauncher worlds={library.worlds} activeWorldId={activeWorldId} missingWorldMetadata={library.missingWorldMetadata} trashedWorlds={library.trashedWorlds}/>
}
