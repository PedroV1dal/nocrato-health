import { Inject, Injectable } from '@nestjs/common'
import type { Knex } from 'knex'
import { KNEX } from '@/database/knex.provider'

export interface DashboardStats {
  totalDoctors: number
  activeDoctors: number
  totalPatients: number
  totalAppointments: number
  upcomingAppointments: number
}

@Injectable()
export class AgencyService {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  // US-2.1: Estatísticas globais da agência para o dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const [totalDoctorsRow] = await this.knex('doctors').count('id as count')
    const [activeDoctorsRow] = await this.knex('doctors')
      .where({ status: 'active' })
      .count('id as count')
    const [totalPatientsRow] = await this.knex('patients').count('id as count')
    const [totalAppointmentsRow] = await this.knex('appointments').count('id as count')
    const [upcomingAppointmentsRow] = await this.knex('appointments')
      .where('date_time', '>', this.knex.fn.now())
      .whereIn('status', ['scheduled', 'waiting'])
      .count('id as count')

    return {
      totalDoctors: Number(totalDoctorsRow.count),
      activeDoctors: Number(activeDoctorsRow.count),
      totalPatients: Number(totalPatientsRow.count),
      totalAppointments: Number(totalAppointmentsRow.count),
      upcomingAppointments: Number(upcomingAppointmentsRow.count),
    }
  }
}
