import { z } from 'zod'

/**
 * DTO para PATCH /api/v1/doctor/profile/branding (US-8.2)
 *
 * Patch parcial real — todos os campos são opcionais.
 * Diferente de update-branding.dto.ts (onboarding) que é usado no wizard.
 * primaryColor deve ser hex válido (#RRGGBB) conforme CHECK constraint no DB.
 */
export const UpdateBrandingSettingsSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor primária deve ser um hex válido (#RRGGBB)')
    .optional(),
  logoUrl: z.string().url('Logo URL deve ser uma URL válida').nullable().optional(),
})

export type UpdateBrandingSettingsDto = z.infer<typeof UpdateBrandingSettingsSchema>
