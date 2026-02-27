import { z } from 'zod'

export const UpdateDoctorStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
})

export type UpdateDoctorStatusDto = z.infer<typeof UpdateDoctorStatusSchema>
