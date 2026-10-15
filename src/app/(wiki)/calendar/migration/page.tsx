import Link from 'next/link'
import { startDateMigrationAction, recoverDateMigrationAction } from '@/app/actions/date-migration'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { PageContainer } from '@/components/wiki/page-container'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function DateMigrationPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [world, query] = await Promise.all([getCurrentWorld(), searchParams])
  const preview = await getWorldRepository().previewDateMigration(world.id)
  return <PageContainer className="max-w-5xl">
    <Breadcrumbs items={[{ label: world.name, href: '/codex' }, { label: 'Calendário', href: '/calendar' }, { label: 'Conversão de datas' }]} />
    <h1 className="mt-4 font-serif text-3xl">Converter datas antigas</h1>
    <p className="mt-2 text-sm text-muted-foreground">A prévia cobre todos os campos de data declarados neste mundo, inclusive tipos personalizados e registros na lixeira. Datas válidas são convertidas pela posição ordinal; valores inválidos permanecem disponíveis para revisão.</p>
    {query.message && <p role="status" className="mt-4 rounded-md border border-border p-3">{query.message}</p>}
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[['Campos preenchidos', preview.total], ['Conversíveis', preview.convertible], ['Já convertidos', preview.alreadyConverted], ['Para revisão', preview.invalid]].map(([label, count]) =>
        <div key={label} className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{count}</p></div>)}
    </div>
    {preview.recovery && <section className="mt-6 rounded-md border border-amber-500 p-4">
      <h2 className="font-semibold">Conversão interrompida</h2>
      <p className="mt-1 text-sm">Backup {preview.recovery.id}. Continue a operação ou restaure os valores originais. Alterações posteriores em um registro impedem sua sobrescrita automática.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {preview.recovery.state === 'applying' && <form action={recoverDateMigrationAction}><input type="hidden" name="worldId" value={world.id} /><input type="hidden" name="backupId" value={preview.recovery.id} /><input type="hidden" name="operation" value="resume" /><button className="rounded-md border border-border px-3 py-2" type="submit">Retomar conversão</button></form>}
        <form action={recoverDateMigrationAction} className="flex items-center gap-2"><input type="hidden" name="worldId" value={world.id} /><input type="hidden" name="backupId" value={preview.recovery.id} /><input type="hidden" name="operation" value="restore" /><label className="text-sm"><input type="checkbox" name="confirm" value="yes" required /> Confirmo a restauração</label><button className="rounded-md border border-border px-3 py-2" type="submit">Restaurar backup</button></form>
      </div>
    </section>}
    {preview.latestBackup?.state === 'completed' && !preview.recovery && <section className="mt-6 rounded-md border border-border p-4"><h2 className="font-semibold">Último backup recuperável</h2><p className="mt-1 text-sm">{preview.latestBackup.id}</p><form action={recoverDateMigrationAction} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="worldId" value={world.id} /><input type="hidden" name="backupId" value={preview.latestBackup.id} /><input type="hidden" name="operation" value="restore" /><label className="text-sm"><input type="checkbox" name="confirm" value="yes" required /> Confirmo a restauração</label><button className="rounded-md border border-border px-3 py-2" type="submit">Restaurar backup</button></form></section>}
    <section className="mt-6"><h2 className="text-lg font-semibold">Exemplos antes e depois</h2>{preview.examples.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nenhuma data conversível.</p> : <ul className="mt-2 space-y-2">{preview.examples.map((item, index) => <li key={`${item.entityId}-${item.field}-${index}`} className="rounded-md border border-border p-3 text-sm"><strong>{item.title}</strong> · {item.type} · {item.field}{item.trashed ? ' · lixeira' : ''}<br />{item.before} → {item.after}</li>)}</ul>}</section>
    <section className="mt-6"><h2 className="text-lg font-semibold">Valores para revisão ({preview.invalid})</h2>{preview.problems.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nenhum problema encontrado.</p> : <ul className="mt-2 space-y-2">{preview.problems.map((item, index) => <li key={`${item.entityId}-${item.field}-${index}`} className="rounded-md border border-border p-3 text-sm"><strong>{item.title}</strong> · {item.type} · {item.field}{item.trashed ? ' · lixeira' : ''}<br />{item.before}: {item.reason}</li>)}</ul>}</section>
    {!preview.recovery && preview.convertible > 0 && <form action={startDateMigrationAction} className="mt-8 rounded-md border border-border p-4"><input type="hidden" name="worldId" value={world.id} /><input type="hidden" name="fingerprint" value={preview.fingerprint} /><p className="text-sm">Uma cópia recuperável dos metadados originais será gravada antes da conversão.</p><label className="mt-3 block text-sm"><input type="checkbox" name="confirm" value="yes" required /> Revisei a prévia e confirmo a conversão deste mundo</label><button className="mt-3 rounded-md bg-primary px-4 py-2 text-primary-foreground" type="submit">Criar backup e converter</button></form>}
    <p className="mt-6 text-sm"><Link href="/calendar" className="underline">Voltar ao calendário</Link></p>
  </PageContainer>
}
