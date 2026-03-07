import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Knex } from 'knex'
import { KNEX } from '@/database/knex.provider'
import type { ProfileResponseDto } from './dto/profile-response.dto'
import type { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto'
import type { UpdateBrandingSettingsDto } from './dto/update-branding-settings.dto'

interface DoctorProfileRow {
  id: string
  tenant_id: string
  email: string
  name: string | null
  specialty: string | null
  phone: string | null
  crm: string | null
  crm_state: string | null
  working_hours: object | null
  timezone: string
  appointment_duration: number
  onboarding_completed: boolean
  created_at: string | Date
}

interface TenantBrandingRow {
  primary_color: string | null
  logo_url: string | null
}

const DOCTOR_FIELDS = [
  'id',
  'tenant_id',
  'email',
  'name',
  'specialty',
  'phone',
  'crm',
  'crm_state',
  'working_hours',
  'timezone',
  'appointment_duration',
  'onboarding_completed',
  'created_at',
] as const

const TENANT_BRANDING_FIELDS = ['primary_color', 'logo_url'] as const

function mapProfile(doctor: DoctorProfileRow, branding: TenantBrandingRow): ProfileResponseDto {
  return {
    id: doctor.id,
    tenantId: doctor.tenant_id,
    email: doctor.email,
    name: doctor.name,
    specialty: doctor.specialty,
    phone: doctor.phone,
    crm: doctor.crm,
    crmState: doctor.crm_state,
    workingHours: doctor.working_hours as Record<string, Array<{ start: string; end: string }>> | null,
    timezone: doctor.timezone,
    appointmentDuration: doctor.appointment_duration,
    onboardingCompleted: doctor.onboarding_completed,
    createdAt: doctor.created_at,
    branding: {
      primaryColor: branding.primary_color,
      logoUrl: branding.logo_url,
    },
  }
}

@Injectable()
export class ProfileService {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  /**
   * GET /api/v1/doctor/profile
   *
   * Retorna o perfil completo do doutor autenticado incluindo branding do tenant.
   * Executa duas queries paralelas: doctors + tenants.
   * Nunca retorna password_hash.
   */
  async getProfile(tenantId: string): Promise<ProfileResponseDto> {
    const [doctor, tenant] = await Promise.all([
      this.knex<DoctorProfileRow>('doctors')
        .select([...DOCTOR_FIELDS])
        .where({ tenant_id: tenantId })
        .first(),
      this.knex('tenants')
        .select([...TENANT_BRANDING_FIELDS])
        .where({ id: tenantId })
        .first() as Promise<TenantBrandingRow | undefined>,
    ])

    if (!doctor) {
      throw new NotFoundException('Doutor não encontrado')
    }

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado')
    }

    return mapProfile(doctor, tenant)
  }

  /**
   * PATCH /api/v1/doctor/profile
   *
   * Atualiza parcialmente o perfil do doutor (name, specialty, phone, workingHours, timezone).
   * Apenas os campos presentes no dto são atualizados (patch real).
   * Se nenhum campo informado, lança BadRequestException.
   */
  async updateProfile(tenantId: string, dto: UpdateProfileSettingsDto): Promise<ProfileResponseDto> {
    const updateData: Record<string, unknown> = {
      updated_at: this.knex.fn.now(),
    }

    if (dto.name !== undefined) {
      updateData.name = dto.name
    }

    if (dto.specialty !== undefined) {
      updateData.specialty = dto.specialty
    }

    if (dto.phone !== undefined) {
      updateData.phone = dto.phone
    }

    if (dto.workingHours !== undefined) {
      updateData.working_hours = JSON.stringify(dto.workingHours)
    }

    if (dto.timezone !== undefined) {
      updateData.timezone = dto.timezone
    }

    // Apenas updated_at não conta como campo real
    const hasFields = Object.keys(updateData).length > 1
    if (!hasFields) {
      throw new BadRequestException('Nenhum campo para atualizar')
    }

    const rows = await this.knex('doctors')
      .where({ tenant_id: tenantId })
      .update(updateData)
      .returning([...DOCTOR_FIELDS])

    const updated = rows[0] as DoctorProfileRow | undefined

    if (!updated) {
      throw new NotFoundException('Doutor não encontrado')
    }

    // Busca branding atualizado para montar resposta completa
    const tenant = await (this.knex('tenants')
      .select([...TENANT_BRANDING_FIELDS])
      .where({ id: tenantId })
      .first() as Promise<TenantBrandingRow | undefined>)

    return mapProfile(updated, tenant ?? { primary_color: null, logo_url: null })
  }

  /**
   * PATCH /api/v1/doctor/profile/branding
   *
   * Atualiza parcialmente o branding do tenant (primaryColor, logoUrl).
   * Atualiza a tabela tenants, não doctors.
   * Se nenhum campo informado, lança BadRequestException.
   */
  async updateBranding(
    tenantId: string,
    dto: UpdateBrandingSettingsDto,
  ): Promise<{ primaryColor: string | null; logoUrl: string | null }> {
    const updateData: Record<string, unknown> = {
      updated_at: this.knex.fn.now(),
    }

    if (dto.primaryColor !== undefined) {
      updateData.primary_color = dto.primaryColor
    }

    if (dto.logoUrl !== undefined) {
      updateData.logo_url = dto.logoUrl
    }

    const hasFields = Object.keys(updateData).length > 1
    if (!hasFields) {
      throw new BadRequestException('Nenhum campo para atualizar')
    }

    const rows = (await this.knex('tenants')
      .where('id', tenantId)
      .update(updateData)
      .returning([...TENANT_BRANDING_FIELDS])) as TenantBrandingRow[]

    const updated = rows[0]

    if (!updated) {
      throw new NotFoundException('Tenant não encontrado')
    }

    return {
      primaryColor: updated.primary_color,
      logoUrl: updated.logo_url,
    }
  }
}
