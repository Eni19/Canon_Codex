'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

function finish(message: string): never {
  revalidatePath('/calendar/migration')
  revalidatePath('/', 'layout')
  redirect(`/calendar/migration?message=${encodeURIComponent(message)}`)
}

export async function startDateMigrationAction(formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  if (formData.get('worldId') !== world.id) finish('O mundo ativo mudou. Revise a prévia novamente.')
  if (formData.get('confirm') !== 'yes') finish('Confirme a conversão antes de continuar.')
  const fingerprint = formData.get('fingerprint')
  if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) finish('Prévia inválida. Atualize a página.')
  try {
    await getWorldRepository().startDateMigration(world.id, fingerprint)
  } catch (error) {
    finish(error instanceof Error ? error.message : 'A conversão falhou. Consulte a recuperação.')
  }
  finish('Conversão concluída. O backup permanece disponível para restauração.')
}

export async function recoverDateMigrationAction(formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  if (formData.get('worldId') !== world.id) finish('O mundo ativo mudou. Reabra esta página.')
  const id = formData.get('backupId')
  const operation = formData.get('operation')
  if (typeof id !== 'string' || (operation !== 'resume' && operation !== 'restore')) finish('Operação inválida.')
  if (operation === 'restore' && formData.get('confirm') !== 'yes') finish('Confirme a restauração antes de continuar.')
  try {
    await getWorldRepository().recoverDateMigration(world.id, id, operation === 'restore')
  } catch (error) {
    finish(error instanceof Error ? error.message : 'A recuperação falhou.')
  }
  finish(operation === 'restore' ? 'Backup restaurado.' : 'Conversão retomada e concluída.')
}
