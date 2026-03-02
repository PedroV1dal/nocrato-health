import { z } from 'zod'

export const createPatientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  cpf: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  dateOfBirth: z.string().date('Data de nascimento inválida — use o formato ISO 8601').optional(),
})

export type CreatePatientDto = z.infer<typeof createPatientSchema>
