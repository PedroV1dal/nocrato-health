import { z } from 'zod'

export const GetPortalAccessSchema = z.object({
  // Formato gerado pelo sistema: AAA-1234-BBB (3 letras, 4 dígitos, 3 letras)
  code: z.string().regex(/^[A-Z]{3}-\d{4}-[A-Z]{3}$/, 'Formato de código inválido'),
})

export type GetPortalAccessDto = z.infer<typeof GetPortalAccessSchema>
