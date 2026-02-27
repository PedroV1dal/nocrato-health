import { z } from 'zod'

export const UpdateMemberStatusSchema = z.object({
  status: z.enum(['pending', 'active', 'inactive']),
})

export type UpdateMemberStatusDto = z.infer<typeof UpdateMemberStatusSchema>
