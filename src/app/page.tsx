import { cookies } from 'next/headers'
import { CodexLauncher } from '@/components/wiki/codex-launcher'
import { getWorldRepository } from '@/repositories'

export default async function LibraryPage() {
  const worlds = await getWorldRepository().listWorlds()
  const activeWorldId = (await cookies()).get('canon-codex-world')?.value
  return <CodexLauncher worlds={worlds} activeWorldId={activeWorldId}/>
}
