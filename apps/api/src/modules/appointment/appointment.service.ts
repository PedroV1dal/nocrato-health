import { Inject, Injectable } from '@nestjs/common'
import type { Knex } from 'knex'
import { KNEX } from '@/database/knex.provider'
import { ListAppointmentsDto } from './dto/list-appointments.dto'

// Campos retornados na listagem de consultas
// agent_summary é dado interno de processamento — não é necessário na listagem
const APPOINTMENT_LIST_FIELDS = [
  'id',
  'tenant_id',
  'patient_id',
  'date_time',
  'duration_minutes',
  'status',
  'cancellation_reason',
  'rescheduled_to_id',
  'created_by',
  'started_at',
  'completed_at',
  'created_at',
] as const

@Injectable()
export class AppointmentService {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  // US-5.1: Listagem paginada de consultas com filtros opcionais
  async listAppointments(tenantId: string, dto: ListAppointmentsDto) {
    const { page, limit, status, date, patientId } = dto
    const offset = (page - 1) * limit

    // Constrói a base da query com isolamento de tenant obrigatório
    let query = this.knex('appointments').where({ tenant_id: tenantId })

    // Filtros opcionais aplicados ANTES dos terminais (mutação in-place do Knex builder)
    if (status) {
      query = query.andWhere({ status })
    }

    if (patientId) {
      query = query.andWhere({ patient_id: patientId })
    }

    // Filtro por data: converte YYYY-MM-DD em range [início do dia, fim do dia] UTC
    // Usa BETWEEN para capturar todas as consultas do dia independentemente do horário
    if (date) {
      const startOfDay = `${date}T00:00:00.000Z`
      const endOfDay = `${date}T23:59:59.999Z`
      query = query.andWhereBetween('date_time', [startOfDay, endOfDay])
    }

    // Executa count e data em paralelo para eficiência — clonar antes de aplicar terminais
    const [countResult, data] = await Promise.all([
      query.clone().count('id as count').first(),
      query
        .clone()
        .select(APPOINTMENT_LIST_FIELDS)
        .orderBy('date_time', 'desc')
        .limit(limit)
        .offset(offset),
    ])

    // Knex.count() retorna string do PostgreSQL — converter com Number()
    const total = Number(countResult?.count ?? 0)

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}
