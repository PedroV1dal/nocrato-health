import { z } from 'zod'

export const GetPortalAccessSchema = z.object({
  code: z.string().min(1, 'Código obrigatório'),
})

export type GetPortalAccessDto = z.infer<typeof GetPortalAccessSchema>
