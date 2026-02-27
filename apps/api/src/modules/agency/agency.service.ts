import { Inject, Injectable, NotFoundException } from '@nestjs/common'
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

  // US-2.2: Listagem paginada de doutores com JOIN em tenants para o slug
  async listDoctors(page: number, limit: number, status?: 'active' | 'inactive') {
    const offset = (page - 1) * limit

    // Constrói a base da query de dados (sem os terminais limit/offset ainda)
    const baseQuery = this.knex('doctors as d')
      .join('tenants as t', 'd.tenant_id', 't.id')
      .select(
        'd.id',
        'd.name',
        'd.email',
        't.slug',
        'd.crm',
        'd.specialty',
        'd.status',
        'd.created_at as createdAt',
      )
      .orderBy('d.created_at', 'desc')

    // Constrói a base da query de contagem (sem o terminal count ainda)
    const baseCountQuery = this.knex('doctors as d')

    // Aplica o filtro opcional ANTES dos terminais
    if (status) {
      baseQuery.where('d.status', status)
      baseCountQuery.where('d.status', status)
    }

    // Adiciona os terminais após o filtro opcional
    const dataQuery = baseQuery.limit(limit).offset(offset)
    const countQuery = baseCountQuery.count('d.id as count')

    const [rows, [countRow]] = await Promise.all([dataQuery, countQuery])

    const total = Number(countRow.count)
    return {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // US-2.3: Atualização de status de um doutor pela agência
  async updateDoctorStatus(id: string, status: 'active' | 'inactive'): Promise<{ id: string; status: string }> {
    const [doctor] = await this.knex('doctors').where('id', id).select('id')

    if (!doctor) {
      throw new NotFoundException('Doutor não encontrado')
    }

    await this.knex('doctors').where('id', id).update({ status, updated_at: this.knex.fn.now() })

    return { id, status }
  }

  // US-2.4: Listagem paginada de membros da agência
  async listMembers(page: number, limit: number, status?: 'pending' | 'active' | 'inactive') {
    const offset = (page - 1) * limit

    // Constrói a base da query de dados (sem os terminais limit/offset ainda)
    const baseQuery = this.knex('agency_members')
      .select(
        'id',
        'name',
        'email',
        'role',
        'status',
        'last_login_at',
        'created_at',
      )
      .orderBy('created_at', 'desc')

    // Constrói a base da query de contagem (sem o terminal count ainda)
    const baseCountQuery = this.knex('agency_members')

    // Aplica o filtro opcional ANTES dos terminais
    if (status) {
      baseQuery.where('status', status)
      baseCountQuery.where('status', status)
    }

    // Adiciona os terminais após o filtro opcional
    const dataQuery = baseQuery.limit(limit).offset(offset)
    const countQuery = baseCountQuery.count('id as count')

    const [rows, [countRow]] = await Promise.all([dataQuery, countQuery])

    const total = Number(countRow.count)
    return {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // US-2.4: Atualização de status de um membro pela agência
  async updateMemberStatus(id: string, status: 'pending' | 'active' | 'inactive'): Promise<{ id: string; status: string }> {
    const [member] = await this.knex('agency_members').where('id', id).select('id')

    if (!member) {
      throw new NotFoundException('Membro não encontrado')
    }

    await this.knex('agency_members').where('id', id).update({ status, updated_at: this.knex.fn.now() })

    return { id, status }
  }

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
