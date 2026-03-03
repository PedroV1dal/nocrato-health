import { z } from 'zod'

export const ListDocumentsSchema = z.object({
  patientId: z.string().uuid('patientId deve ser um UUID válido'),
  type: z.enum(['prescription', 'certificate', 'exam', 'other']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export type ListDocumentsDto = z.infer<typeof ListDocumentsSchema>
