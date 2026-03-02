import { z } from 'zod'

// Schema do response do dashboard do doutor (US-5.5)
// todayAppointments: consultas do dia atual ordenadas por date_time ASC
// totalPatients: total de pacientes ativos no tenant
// pendingFollowUps: consultas completadas sem nenhuma nota clínica associada

export const DashboardResponseSchema = z.object({
  todayAppointments: z.array(z.record(z.unknown())),
  totalPatients: z.number(),
  pendingFollowUps: z.number(),
})

export type DashboardResponseDto = z.infer<typeof DashboardResponseSchema>
