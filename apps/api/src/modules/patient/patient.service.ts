import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Knex } from 'knex'
import { KNEX } from '@/database/knex.provider'
import { ListPatientsQueryDto } from './dto/list-patients.dto'
import { CreatePatientDto } from './dto/create-patient.dto'

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
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  // US-4.1: Listagem paginada de pacientes com busca por nome/telefone e filtro por status
  async listPatients(tenantId: string, dto: ListPatientsQueryDto) {
    const { page, limit, search, status } = dto
    const offset = (page - 1) * limit

    // Constrói a base da query com isolamento de tenant obrigatório
    let query = this.knex('patients').where({ tenant_id: tenantId })

    // Filtros opcionais aplicados ANTES dos terminais (mutação in-place do Knex builder)
    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&')
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
}
