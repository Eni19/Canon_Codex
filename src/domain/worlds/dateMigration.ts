export interface DateMigrationExample {
  entityId: string
  title: string
  type: string
  field: string
  before: string
  after?: string
  reason?: string
  trashed: boolean
}

export type DateMigrationState = 'applying' | 'completed' | 'restoring' | 'restored'

export interface DateMigrationPreview {
  worldId: string
  fingerprint: string
  total: number
  convertible: number
  alreadyConverted: number
  invalid: number
  examples: DateMigrationExample[]
  problems: DateMigrationExample[]
  recovery?: { id: string; state: DateMigrationState }
  latestBackup?: { id: string; state: DateMigrationState }
}
