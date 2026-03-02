import { z } from 'zod'

export const UpdatePatientSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(150).optional(),
    phone: z.string().max(20).optional(),
    cpf: z
      .string()
      .regex(/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos numéricos')
      .optional(),
    email: z.string().email('Email inválido').max(150).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'Pelo menos um campo deve ser informado para atualização' },
  )

export type UpdatePatientDto = z.infer<typeof UpdatePatientSchema>
