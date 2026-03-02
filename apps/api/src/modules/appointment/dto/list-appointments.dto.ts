import { z } from 'zod'

// Enum dos 7 status válidos de consulta (espelha o CHECK constraint da tabela appointments)
export const AppointmentStatusEnum = z.enum([
  'scheduled',
  'waiting',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled',
])

export type AppointmentStatus = z.infer<typeof AppointmentStatusEnum>

export const ListAppointmentsQuerySchema = z.object({
  // z.coerce.number() é obrigatório: HTTP entrega query params como strings
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: AppointmentStatusEnum.optional(),
  // date no formato YYYY-MM-DD — validado como string; service converte para range UTC
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido. Use YYYY-MM-DD')
    .optional(),
  patientId: z.string().uuid('patientId deve ser um UUID válido').optional(),
})

export type ListAppointmentsDto = z.infer<typeof ListAppointmentsQuerySchema>
