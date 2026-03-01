import { z } from 'zod'

export const UpdateAgentSettingsSchema = z.object({
  welcomeMessage: z.string().min(1).max(1000),
  personality: z.string().max(2000).optional(),
  faq: z.string().max(5000).optional(),
})

export type UpdateAgentSettingsDto = z.infer<typeof UpdateAgentSettingsSchema>
