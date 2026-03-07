import { z } from 'zod'

const TimeSlotSchema = z.object({
  start: z.string(),
  end: z.string(),
})

const WorkingHoursSchema = z.record(z.string(), z.array(TimeSlotSchema)).optional()

/**
 * DTO para PATCH /api/v1/doctor/profile (US-8.2)
 *
 * Patch parcial real — todos os campos são opcionais.
 * Diferente de update-profile.dto.ts (onboarding) que exige name e crm.
 */
export const UpdateProfileSettingsSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').optional(),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  workingHours: WorkingHoursSchema,
  timezone: z.string().optional(),
})

export type UpdateProfileSettingsDto = z.infer<typeof UpdateProfileSettingsSchema>
