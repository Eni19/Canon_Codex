import { z } from 'zod'
import { LocationDiscoverySchema } from './locationPoint'

export const EvidenceFindingsSchema = z.array(LocationDiscoverySchema).max(24)
export type EvidenceFinding = z.infer<typeof LocationDiscoverySchema>
