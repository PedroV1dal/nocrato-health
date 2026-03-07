import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Knex } from 'knex'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { KNEX } from '@/database/knex.provider'
import { EventLogService } from '@/modules/event-log/event-log.service'
import { ListPatientsQueryDto } from './dto/list-patients.dto'
import { CreatePatientDto } from './dto/create-patient.dto'
import { UpdatePatientDto } from './dto/update-patient.dto'

// Tipo retornado em findByPhone e na listagem (campos públicos sem dados sensíveis)
export interface PatientPublicRow {
  id: string
  name: string
  phone: string
  email: string | null
  source: string
  status: string
  created_at: Date | string
}

// Campos públicos retornados na listagem — cpf e portal_access_code nunca são expostos
const PUBLIC_PATIENT_FIELDS = [
  'id',
  'name',
  'phone',
  'email',
  'source',
  'status',
  'created_at',
] as const

// Campos do perfil completo do paciente — inclui portal_active, exclui cpf e portal_access_code
const PATIENT_PROFILE_FIELDS = [
  'id',
  'name',
  'phone',
  'email',
  'source',
  'status',
  'portal_active',
  'created_at',
] as const

const APPOINTMENT_FIELDS = [
  'id',
  'date_time',
  'status',
  'duration_minutes',
  'started_at',
  'completed_at',
] as const

const CLINICAL_NOTE_FIELDS = [
  'id',
  'appointment_id',
  'content',
  'created_at',
] as const

const DOCUMENT_FIELDS = [
  'id',
  'file_name',
  'type',
  'file_url',
  'mime_type',
  'created_at',
] as const

@Injectable()
export class PatientService {
  constructor(
    @Inject(KNEX) private readonly knex: Knex,
    private readonly eventEmitter: EventEmitter2,
    private readonly eventLogService: EventLogService,
  ) {}

  // US-4.1: Listagem paginada de pacientes com busca por nome/telefone e filtro por status
  async listPatients(tenantId: string, dto: ListPatientsQueryDto) {
    const { page, limit, search, status } = dto
    const offset = (page - 1) * limit

    // Constrói a base da query com isolamento de tenant obrigatório
    let query = this.knex('patients').where({ tenant_id: tenantId })

    // Filtros opcionais aplicados ANTES dos terminais (mutação in-place do Knex builder)
    if (search) {
      const escaped = search.replaceAll(/[%_\\]/g, String.raw`\$&`)
      query = query.andWhere((qb) =>
        qb.whereILike('name', `%${escaped}%`).orWhereILike('phone', `%${escaped}%`),
      )
    }

    if (status) {
      query = query.andWhere({ status })
    }

    // Executa count e data em paralelo para eficiência
    const [countResult, data] = await Promise.all([
      query.clone().count('id as count').first(),
      query
        .clone()
        .select(PUBLIC_PATIENT_FIELDS)
        .orderBy('created_at', 'desc')
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

  // US-4.2: Perfil completo do paciente com appointments, notas clínicas e documentos
  async getPatientProfile(tenantId: string, patientId: string) {
    // Busca o paciente com isolamento de tenant obrigatório
    const patient = await this.knex('patients')
      .where({ id: patientId, tenant_id: tenantId })
      .select(PATIENT_PROFILE_FIELDS)
      .first()

    // Se não encontrado ou pertence a outro tenant: 404 (não vazar existência)
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado')
    }

    // Executa as 3 queries paralelas — todas scoped por tenant_id e patient_id
    const [appointments, clinicalNotes, documents] = await Promise.all([
      this.knex('appointments')
        .where({ tenant_id: tenantId, patient_id: patientId })
        .select(APPOINTMENT_FIELDS)
        .orderBy('date_time', 'desc'),
      this.knex('clinical_notes')
        .where({ tenant_id: tenantId, patient_id: patientId })
        .select(CLINICAL_NOTE_FIELDS)
        .orderBy('created_at', 'desc'),
      this.knex('documents')
        .where({ tenant_id: tenantId, patient_id: patientId })
        .select(DOCUMENT_FIELDS)
        .orderBy('created_at', 'desc'),
    ])

    return {
      patient,
      appointments,
      clinicalNotes,
      documents,
    }
  }

  // US-4.4: Edição parcial de paciente pelo doutor
  async updatePatient(tenantId: string, patientId: string, dto: UpdatePatientDto) {
    // 1. Verificar se o paciente existe neste tenant — nunca vazar existência de outros tenants
    const existing = await this.knex('patients')
      .where({ id: patientId, tenant_id: tenantId })
      .select('id')
      .first()

    if (!existing) {
      throw new NotFoundException('Paciente não encontrado')
    }

    // 2. Construir objeto de update com apenas os campos presentes no dto (patch parcial real)
    const updateData: Record<string, unknown> = {}
    if (dto.name !== undefined) updateData.name = dto.name
    if (dto.phone !== undefined) updateData.phone = dto.phone
    if (dto.cpf !== undefined) updateData.cpf = dto.cpf
    if (dto.email !== undefined) updateData.email = dto.email
    if (dto.status !== undefined) updateData.status = dto.status
    updateData.updated_at = this.knex.fn.now()

    try {
      // 3. Executar update com isolamento de tenant e retornar campos públicos
      const [updated] = await this.knex('patients')
        .where({ id: patientId, tenant_id: tenantId })
        .update(updateData)
        .returning(PUBLIC_PATIENT_FIELDS)

      return updated
    } catch (error: unknown) {
      // Código PostgreSQL 23505 = unique_violation (telefone já cadastrado para este tenant)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictException('Telefone já cadastrado para outro paciente')
      }
      throw error
    }
  }

  // US-4.3: Criação manual de paciente pelo doutor
  async createPatient(tenantId: string, dto: CreatePatientDto) {
    const { name, phone, cpf, email, dateOfBirth } = dto

    try {
      const [patient] = await this.knex('patients')
        .insert({
          tenant_id: tenantId,
          name,
          phone,
          cpf: cpf ?? null,
          email: email ?? null,
          date_of_birth: dateOfBirth ?? null,
          source: 'manual',
          status: 'active',
        })
        .returning(PUBLIC_PATIENT_FIELDS)

      return patient
    } catch (error: unknown) {
      // Código PostgreSQL 23505 = unique_violation (telefone já cadastrado para este tenant)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictException('Telefone já cadastrado para outro paciente')
      }
      throw error
    }
  }

  // US-9.3: Busca paciente pelo telefone — retorna null se não encontrado (sem exceção)
  async findByPhone(
    tenantId: string,
    phone: string,
  ): Promise<PatientPublicRow | null> {
    const patient = await this.knex('patients')
      .where({ tenant_id: tenantId, phone })
      .select(PUBLIC_PATIENT_FIELDS)
      .first()

    return (patient as PatientPublicRow | undefined) ?? null
  }

  // US-9.1: Ativa o portal do paciente e emite evento para notificação WhatsApp
  async activatePortal(tenantId: string, patientId: string): Promise<void> {
    // 1. Buscar o paciente com isolamento de tenant obrigatório
    const patient = await this.knex('patients')
      .where({ id: patientId, tenant_id: tenantId })
      .select(['id', 'phone', 'portal_active', 'portal_access_code'])
      .first()

    if (!patient) {
      throw new NotFoundException('Paciente não encontrado')
    }

    // 2. Se já está ativo — idempotente, não emitir evento de duplicidade
    if (patient.portal_active) {
      return
    }

    // 3. Ativar portal
    await this.knex('patients')
      .where({ id: patientId, tenant_id: tenantId })
      .update({ portal_active: true })

    // 4. Registrar no event_log via EventLogService
    await this.eventLogService.append(
      tenantId,
      'patient.portal_activated',
      'system',
      null,
      { patientId, phone: patient.phone },
    )

    // 5. Emitir evento via EventEmitter2 (fire-and-forget)
    this.eventEmitter.emit('patient.portal_activated', {
      tenantId,
      patientId,
      phone: patient.phone as string,
      portalAccessCode: patient.portal_access_code as string | null,
    })
  }
}
