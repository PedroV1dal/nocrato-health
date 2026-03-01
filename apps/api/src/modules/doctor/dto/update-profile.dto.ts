import { z } from 'zod'

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(150),
  specialty: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  crm: z.string().min(1).max(20),
  crmState: z.string().length(2),
})

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>
