import { z } from 'zod'

export const UpdateBrandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'primaryColor deve ser um hex válido (ex: #0066CC)')
    .optional(),
  logoUrl: z.string().url('logoUrl deve ser uma URL válida').optional(),
})

export type UpdateBrandingDto = z.infer<typeof UpdateBrandingSchema>
