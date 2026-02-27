import { z } from 'zod'

export const ListMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'active', 'inactive']).optional(),
})

export type ListMembersQueryDto = z.infer<typeof ListMembersQuerySchema>
