import { cookies } from 'next/headers'
import { CodexLauncher } from '@/components/wiki/codex-launcher'
import { getWorldRepository, LegacyMigrationRequiredError } from '@/repositories'

export default async function LibraryPage() {
  const activeWorldId = (await cookies()).get('canon-codex-world')?.value
  try {
    const repository = getWorldRepository()
    const worlds = await repository.listWorlds()
    const missingWorldMetadata = await repository.listMissingWorldMetadata()
    return <CodexLauncher worlds={worlds} activeWorldId={activeWorldId} missingWorldMetadata={missingWorldMetadata}/>
  } catch (error) {
    if (!(error instanceof LegacyMigrationRequiredError)) throw error
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 py-20">
        <h1 className="font-serif text-3xl">Migração da biblioteca</h1>
        <p>Esta biblioteca ainda usa arquivos. Use <code>pnpm storage preview</code> e <code>pnpm storage import</code> para convertê-la para SQLite.</p>
        <p>As instruções de migração e backup estão em <code>docs/data/sqlite.md</code>.</p>
      </main>
    )
  }
}
