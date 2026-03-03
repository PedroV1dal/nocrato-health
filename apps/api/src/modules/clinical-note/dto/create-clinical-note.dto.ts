import { z } from 'zod'

export const CreateClinicalNoteSchema = z.object({
  appointmentId: z.string().uuid('appointmentId deve ser um UUID válido'),
  patientId: z.string().uuid('patientId deve ser um UUID válido'),
  content: z.string().min(1, 'content não pode estar vazio'),
})

export type CreateClinicalNoteDto = z.infer<typeof CreateClinicalNoteSchema>
