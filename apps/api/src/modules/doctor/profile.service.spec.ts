/**
 * US-8.2 — Perfil do Doutor
 *
 * Casos de teste cobertos:
 *  - CT-82-01: GET retorna perfil completo sem password_hash
 *  - CT-82-02: PATCH profile atualiza parcialmente (specialty, phone)
 *  - CT-82-03: PATCH branding persiste em tenants (primary_color)
 *  - CT-82-04: working_hours JSONB armazena formato correto
 *  - CT-82-06: doutor não atualiza dados de outro tenant (isolamento)
 *
 * Estratégia de mock:
 *  - KNEX: mock via Symbol token, simulando query builder encadeável
 *  - getProfile: duas queries paralelas — doctors + tenants
 *  - updateProfile: knex('doctors').where().update().returning() + knex('tenants').select().where().first()
 *  - updateBranding: knex('tenants').where().update().returning()
 */

// Mockar env ANTES de qualquer import que o carregue transitivamente.
jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-at-least-16-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-16',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_NAME: 'nocrato_test',
    DB_USER: 'postgres',
    DB_PASSWORD: 'postgres',
  },
}))

import { Test, TestingModule } from '@nestjs/testing'
import { ProfileService } from './profile.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { KNEX } from '@/database/knex.provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-a1b2c3'
const OTHER_TENANT_ID = 'tenant-uuid-x9y8z7'

const mockDoctorRow = {
  id: 'doctor-uuid-1',
  tenant_id: TENANT_ID,
  email: 'dr.silva@example.com',
  name: 'Dr. Silva',
  specialty: 'Cardiologia',
  phone: '11999999999',
  crm: '123456',
  crm_state: 'SP',
  working_hours: {
    monday: [{ start: '08:00', end: '12:00' }],
  },
  timezone: 'America/Sao_Paulo',
  appointment_duration: 30,
  onboarding_completed: true,
  created_at: '2024-01-15T10:00:00.000Z',
}

const mockTenantBranding = {
  primary_color: '#0066CC',
  logo_url: null,
}

// ---------------------------------------------------------------------------
// Tipo auxiliar
// ---------------------------------------------------------------------------

type KnexMockFn = jest.Mock & { fn: { now: jest.Mock } }

// ---------------------------------------------------------------------------
// Helpers de builder Knex
// ---------------------------------------------------------------------------

function buildSelectFirstBuilder(resolvedValue: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(resolvedValue),
  }
}

function buildUpdateReturningBuilder(resolvedValue: unknown) {
  return {
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue !== undefined ? [resolvedValue] : []),
  }
}

function buildKnexMock(...returnValues: unknown[]): KnexMockFn {
  const mockFn = jest.fn() as KnexMockFn
  for (const val of returnValues) {
    mockFn.mockReturnValueOnce(val)
  }
  mockFn.fn = { now: jest.fn().mockReturnValue('NOW()') }
  return mockFn
}

// ---------------------------------------------------------------------------
// Suite de testes
// ---------------------------------------------------------------------------

describe('ProfileService', () => {
  async function createModule(knex: KnexMockFn): Promise<ProfileService> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: KNEX, useValue: knex },
      ],
    }).compile()

    return moduleRef.get<ProfileService>(ProfileService)
  }

  // -------------------------------------------------------------------------
  // getProfile
  // -------------------------------------------------------------------------

  describe('getProfile', () => {
    it('CT-82-01: retorna perfil completo em camelCase sem password_hash', async () => {
      const doctorBuilder = buildSelectFirstBuilder(mockDoctorRow)
      const tenantBuilder = buildSelectFirstBuilder(mockTenantBranding)

      const knexMock = buildKnexMock(doctorBuilder, tenantBuilder)
      const service = await createModule(knexMock)

      const result = await service.getProfile(TENANT_ID)

      // Campos do doutor mapeados para camelCase
      expect(result.id).toBe(mockDoctorRow.id)
      expect(result.tenantId).toBe(TENANT_ID)
      expect(result.email).toBe(mockDoctorRow.email)
      expect(result.name).toBe(mockDoctorRow.name)
      expect(result.specialty).toBe(mockDoctorRow.specialty)
      expect(result.phone).toBe(mockDoctorRow.phone)
      expect(result.crm).toBe(mockDoctorRow.crm)
      expect(result.crmState).toBe(mockDoctorRow.crm_state)
      expect(result.timezone).toBe(mockDoctorRow.timezone)
      expect(result.appointmentDuration).toBe(mockDoctorRow.appointment_duration)
      expect(result.onboardingCompleted).toBe(true)
      expect(result.createdAt).toBe(mockDoctorRow.created_at)

      // Branding do tenant incluído
      expect(result.branding.primaryColor).toBe('#0066CC')
      expect(result.branding.logoUrl).toBeNull()

      // Garante que password_hash nunca está presente
      expect(result).not.toHaveProperty('passwordHash')
      expect(result).not.toHaveProperty('password_hash')
    })

    it('lança NotFoundException se doutor não encontrado', async () => {
      // Cada chamada a getProfile consome dois builders (Promise.all: doctors + tenants)
      const knexMock = buildKnexMock(
        buildSelectFirstBuilder(undefined),  // doctors → undefined
        buildSelectFirstBuilder(mockTenantBranding), // tenants
        buildSelectFirstBuilder(undefined),  // segunda chamada: doctors → undefined
        buildSelectFirstBuilder(mockTenantBranding), // segunda chamada: tenants
      )
      const service = await createModule(knexMock)

      await expect(service.getProfile(TENANT_ID)).rejects.toThrow(NotFoundException)
      await expect(service.getProfile(TENANT_ID)).rejects.toThrow('Doutor não encontrado')
    })

    it('filtra pelo tenant_id do JWT — WHERE correto na query doctors', async () => {
      const doctorBuilder = buildSelectFirstBuilder(mockDoctorRow)
      const tenantBuilder = buildSelectFirstBuilder(mockTenantBranding)

      const knexMock = buildKnexMock(doctorBuilder, tenantBuilder)
      const service = await createModule(knexMock)

      await service.getProfile(TENANT_ID)

      expect(doctorBuilder.where).toHaveBeenCalledWith({ tenant_id: TENANT_ID })
      expect(tenantBuilder.where).toHaveBeenCalledWith({ id: TENANT_ID })
    })
  })

  // -------------------------------------------------------------------------
  // updateProfile
  // -------------------------------------------------------------------------

  describe('updateProfile', () => {
    it('CT-82-02: PATCH com specialty e phone atualiza apenas esses campos', async () => {
      const updatedRow = { ...mockDoctorRow, specialty: 'Neurologia', phone: '11988888888' }
      const updateBuilder = buildUpdateReturningBuilder(updatedRow)
      const tenantBuilder = buildSelectFirstBuilder(mockTenantBranding)

      const knexMock = buildKnexMock(updateBuilder, tenantBuilder)
      const service = await createModule(knexMock)

      const result = await service.updateProfile(TENANT_ID, {
        specialty: 'Neurologia',
        phone: '11988888888',
      })

      expect(result.specialty).toBe('Neurologia')
      expect(result.phone).toBe('11988888888')
      expect(result.name).toBe(mockDoctorRow.name) // não alterado

      // Verifica updateData — apenas specialty, phone e updated_at
      const callArg = updateBuilder.update.mock.calls[0][0] as Record<string, unknown>
      expect(callArg).toHaveProperty('specialty', 'Neurologia')
      expect(callArg).toHaveProperty('phone', '11988888888')
      expect(callArg).toHaveProperty('updated_at')
      expect(callArg).not.toHaveProperty('name')
      expect(callArg).not.toHaveProperty('timezone')
    })

    it('CT-82-04: working_hours JSONB é serializado como string no update', async () => {
      const workingHours = {
        monday: [{ start: '08:00', end: '12:00' }],
        wednesday: [{ start: '13:00', end: '17:00' }],
      }
      const updatedRow = { ...mockDoctorRow, working_hours: workingHours }
      const updateBuilder = buildUpdateReturningBuilder(updatedRow)
      const tenantBuilder = buildSelectFirstBuilder(mockTenantBranding)

      const knexMock = buildKnexMock(updateBuilder, tenantBuilder)
      const service = await createModule(knexMock)

      await service.updateProfile(TENANT_ID, { workingHours })

      const callArg = updateBuilder.update.mock.calls[0][0] as Record<string, unknown>
      expect(callArg).toHaveProperty('working_hours', JSON.stringify(workingHours))
    })

    it('lança BadRequestException se nenhum campo informado', async () => {
      const knexMock = buildKnexMock()
      const service = await createModule(knexMock)

      await expect(service.updateProfile(TENANT_ID, {})).rejects.toThrow(BadRequestException)
      await expect(service.updateProfile(TENANT_ID, {})).rejects.toThrow('Nenhum campo para atualizar')
    })

    it('lança NotFoundException se doutor não encontrado no update', async () => {
      const updateBuilder = buildUpdateReturningBuilder(undefined)
      // returning retorna [] — simula registro não encontrado
      updateBuilder.returning = jest.fn().mockResolvedValue([])

      const knexMock = buildKnexMock(updateBuilder)
      const service = await createModule(knexMock)

      await expect(service.updateProfile(TENANT_ID, { name: 'Novo Nome' })).rejects.toThrow(NotFoundException)
    })

    it('CT-82-06: isolamento — WHERE tenant_id do JWT, não aceita tenant_id externo', async () => {
      // Para OTHER_TENANT_ID, a query returning retorna [] (isolamento cross-tenant)
      const updateBuilder = buildUpdateReturningBuilder(undefined)
      updateBuilder.returning = jest.fn().mockResolvedValue([])

      const knexMock = buildKnexMock(updateBuilder)
      const service = await createModule(knexMock)

      await expect(
        service.updateProfile(OTHER_TENANT_ID, { name: 'Hacker' }),
      ).rejects.toThrow(NotFoundException)

      // WHERE deve ser chamado com o tenant correto (o que foi passado — validado pelo guard)
      expect(updateBuilder.where).toHaveBeenCalledWith({ tenant_id: OTHER_TENANT_ID })
    })
  })

  // -------------------------------------------------------------------------
  // updateBranding
  // -------------------------------------------------------------------------

  describe('updateBranding', () => {
    it('CT-82-03: PATCH branding persiste primary_color na tabela tenants', async () => {
      const updatedBranding = { primary_color: '#FF5500', logo_url: null }
      const updateBuilder = buildUpdateReturningBuilder(updatedBranding)

      const knexMock = buildKnexMock(updateBuilder)
      const service = await createModule(knexMock)

      const result = await service.updateBranding(TENANT_ID, { primaryColor: '#FF5500' })

      expect(result.primaryColor).toBe('#FF5500')
      expect(result.logoUrl).toBeNull()

      // Verifica que atualizou a tabela tenants com id = tenantId
      // Nota: .where('id', tenantId) é usado no service (dois argumentos)
      expect(updateBuilder.where).toHaveBeenCalledWith('id', TENANT_ID)
      const callArg = updateBuilder.update.mock.calls[0][0] as Record<string, unknown>
      expect(callArg).toHaveProperty('primary_color', '#FF5500')
      expect(callArg).not.toHaveProperty('logo_url')
    })

    it('PATCH branding com logoUrl atualiza apenas esse campo', async () => {
      const updatedBranding = { primary_color: '#0066CC', logo_url: 'https://example.com/logo.png' }
      const updateBuilder = buildUpdateReturningBuilder(updatedBranding)

      const knexMock = buildKnexMock(updateBuilder)
      const service = await createModule(knexMock)

      const result = await service.updateBranding(TENANT_ID, {
        logoUrl: 'https://example.com/logo.png',
      })

      expect(result.logoUrl).toBe('https://example.com/logo.png')

      const callArg = updateBuilder.update.mock.calls[0][0] as Record<string, unknown>
      expect(callArg).toHaveProperty('logo_url', 'https://example.com/logo.png')
      expect(callArg).not.toHaveProperty('primary_color')
    })

    it('lança BadRequestException se nenhum campo de branding informado', async () => {
      const knexMock = buildKnexMock()
      const service = await createModule(knexMock)

      await expect(service.updateBranding(TENANT_ID, {})).rejects.toThrow(BadRequestException)
      await expect(service.updateBranding(TENANT_ID, {})).rejects.toThrow('Nenhum campo para atualizar')
    })

    it('lança NotFoundException se tenant não encontrado no update de branding', async () => {
      const updateBuilder = buildUpdateReturningBuilder(undefined)
      updateBuilder.returning = jest.fn().mockResolvedValue([])

      const knexMock = buildKnexMock(updateBuilder)
      const service = await createModule(knexMock)

      await expect(
        service.updateBranding(TENANT_ID, { primaryColor: '#FF0000' }),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
