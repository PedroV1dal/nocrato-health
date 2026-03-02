import { z } from 'zod'

export const CreateAppointmentSchema = z.object({
  patientId: z.string().uuid('patientId deve ser um UUID válido'),
  dateTime: z.string().datetime('dateTime deve ser uma string ISO 8601 válida'),
  durationMinutes: z.number().int().min(1).max(480).optional(),
})

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>
