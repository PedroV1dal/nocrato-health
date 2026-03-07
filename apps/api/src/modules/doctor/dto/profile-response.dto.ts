import { z } from 'zod'

export const ProfileResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  specialty: z.string().nullable(),
  phone: z.string().nullable(),
  crm: z.string().nullable(),
  crmState: z.string().nullable(),
  workingHours: z.record(z.string(), z.array(z.object({ start: z.string(), end: z.string() }))).nullable(),
  timezone: z.string(),
  appointmentDuration: z.number(),
  onboardingCompleted: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  branding: z.object({
    primaryColor: z.string().nullable(),
    logoUrl: z.string().nullable(),
  }),
})

export type ProfileResponseDto = z.infer<typeof ProfileResponseSchema>
