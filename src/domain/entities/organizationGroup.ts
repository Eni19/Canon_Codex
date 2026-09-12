import { z } from 'zod'

export const OrganizationGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(''),
  memberIds: z.array(z.uuid()).max(30).default([]),
})

export const OrganizationGroupsSchema = z.array(OrganizationGroupSchema).max(20)
export type OrganizationGroup = z.infer<typeof OrganizationGroupSchema>
