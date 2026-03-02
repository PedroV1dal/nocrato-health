import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Knex } from 'knex'
import { KNEX } from '@/database/knex.provider'
import { ListAppointmentsDto } from './dto/list-appointments.dto'
import { CreateAppointmentDto } from './dto/create-appointment.dto'

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

  // US-5.2: Criação manual de consulta pelo doutor com verificação de conflito de horário
  async createAppointment(tenantId: string, dto: CreateAppointmentDto) {
    const { patientId, dateTime, durationMinutes } = dto

    return this.knex.transaction(async (trx) => {
      // 1. Verificar se o paciente existe neste tenant — nunca vazar existência de outros tenants
      const patient = await trx('patients')
        .where({ id: patientId, tenant_id: tenantId })
        .select('id')
        .first()

      if (!patient) {
        throw new NotFoundException('Paciente não encontrado')
      }

      // 2. Buscar appointment_duration do doutor se não fornecido no DTO
      let duration: number
      if (durationMinutes === undefined) {
        const doctor = await trx('doctors')
          .where({ tenant_id: tenantId })
          .select('appointment_duration')
          .first()
        duration = doctor?.appointment_duration ?? 30
      } else {
        duration = durationMinutes
      }

      // 3. Calcular o intervalo da nova consulta
      const startTime = new Date(dateTime)
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

      // 4. SELECT FOR UPDATE para verificar conflito de horário atomicamente
      // Condição de sobreposição: startA < endB AND endA > startB
      // i.e.: date_time < endTime AND (date_time + duration_minutes * '1 minute') > startTime
      const conflict = await trx('appointments')
        .where({ tenant_id: tenantId, patient_id: patientId })
        .whereNotIn('status', ['cancelled', 'completed'])
        .andWhere('date_time', '<', endTime.toISOString())
        .andWhereRaw(
          `(date_time + duration_minutes * INTERVAL '1 minute') > ?`,
          [startTime.toISOString()],
        )
        .select('id')
        .forUpdate()
        .first()

      if (conflict) {
        throw new ConflictException(
          'Conflito de horário: paciente já possui consulta no mesmo período',
        )
      }

      // 5. Inserir a nova consulta
      const [appointment] = await trx('appointments')
        .insert({
          tenant_id: tenantId,
          patient_id: patientId,
          date_time: dateTime,
          duration_minutes: duration,
          status: 'scheduled',
          created_by: 'doctor',
        })
        .returning([
          'id',
          'tenant_id',
          'patient_id',
          'date_time',
          'duration_minutes',
          'status',
          'created_by',
          'created_at',
        ])

      // 6. Registrar evento no event_log como audit trail (Epic 9 conectará via EventEmitter2)
      await trx('event_log').insert({
        tenant_id: tenantId,
        event_type: 'appointment.created',
        actor_type: 'doctor',
        payload: {
          appointment_id: appointment.id,
          patient_id: patientId,
          date_time: dateTime,
          created_by: 'doctor',
        },
      })

      return appointment
    })
  }
}
