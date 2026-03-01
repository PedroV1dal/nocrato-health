import { z } from 'zod'

// Cada slot de horário: { start: "HH:MM", end: "HH:MM" }
const TimeSlotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido — use HH:MM'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido — use HH:MM'),
})

// working_hours JSONB: chave = dia da semana, valor = array de slots
const WorkingHoursSchema = z
  .object({
    monday: z.array(TimeSlotSchema).optional(),
    tuesday: z.array(TimeSlotSchema).optional(),
    wednesday: z.array(TimeSlotSchema).optional(),
    thursday: z.array(TimeSlotSchema).optional(),
    friday: z.array(TimeSlotSchema).optional(),
    saturday: z.array(TimeSlotSchema).optional(),
    sunday: z.array(TimeSlotSchema).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'workingHours deve ter ao menos um dia configurado',
  })

export const UpdateScheduleSchema = z.object({
  workingHours: WorkingHoursSchema,
  timezone: z.string().max(50).optional(),
  appointmentDuration: z.number().int().min(5).max(480).optional(),
})

export type UpdateScheduleDto = z.infer<typeof UpdateScheduleSchema>
