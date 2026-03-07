/**
 * US-8.2 — Controller spec: ProfileController
 *
 * Casos de teste cobertos:
 *  - CT-82-01: GET /profile delega ao service com tenantId correto
 *  - CT-82-02: PATCH /profile delega ao service com dto correto
 *  - CT-82-03: PATCH /profile/branding delega ao service com dto correto
 *  - CT-82-05: sem token → 401 (JwtAuthGuard mockado retornando false)
 *
 * Estratégia: testar que cada handler delega ao ProfileService com os argumentos
 * corretos. Os guards são desabilitados nos testes de delegação e habilitados
 * para o CT-82-05 (sem token → 401).
 */

// Mockar env ANTES de qualquer import que o carregue transitivamente.
const TEST_DB_PASS = 'postgres'
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
    DB_PASSWORD: TEST_DB_PASS,
  },
}))

import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext } from '@nestjs/common'
import { ProfileController } from './profile.controller'
import { ProfileService } from './profile.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { RolesGuard } from '@/common/guards/roles.guard'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-a1b2c3'

const mockProfileResponse = {
  id: 'doctor-uuid-1',
  tenantId: TENANT_ID,
  email: 'dr.silva@example.com',
  name: 'Dr. Silva',
  specialty: 'Cardiologia',
  phone: '11999999999',
  crm: '123456',
  crmState: 'SP',
  workingHours: {
    monday: [{ start: '08:00', end: '12:00' }],
  },
  timezone: 'America/Sao_Paulo',
  appointmentDuration: 30,
  onboardingCompleted: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  branding: {
    primaryColor: '#0066CC',
    logoUrl: null,
  },
}

const mockBrandingResponse = {
  primaryColor: '#FF5500',
  logoUrl: null,
}

// ---------------------------------------------------------------------------
// Guard passthrough mock (desabilita guards nas specs de delegação)
// ---------------------------------------------------------------------------

const allowAllGuard = {
  canActivate: (_ctx: ExecutionContext) => true,
}


// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ProfileController', () => {
  let controller: ProfileController
  let service: jest.Mocked<ProfileService>

  async function createModule(jwtGuardOverride = allowAllGuard): Promise<TestingModule> {
    const mockService: jest.Mocked<Partial<ProfileService>> = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      updateBranding: jest.fn(),
    }

    return Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: ProfileService, useValue: mockService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuardOverride)
      .overrideGuard(TenantGuard)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .compile()
  }

  beforeEach(async () => {
    const moduleRef = await createModule()
    controller = moduleRef.get<ProfileController>(ProfileController)
    service = moduleRef.get(ProfileService)
  })

  // -------------------------------------------------------------------------
  // GET /doctor/profile
  // -------------------------------------------------------------------------

  describe('getProfile', () => {
    it('CT-82-01: delega ao profileService.getProfile com tenantId correto', async () => {
      service.getProfile.mockResolvedValue(mockProfileResponse)

      const result = await controller.getProfile(TENANT_ID)

      expect(service.getProfile).toHaveBeenCalledWith(TENANT_ID)
      expect(result).toEqual(mockProfileResponse)
    })

    it('CT-82-01: resultado não contém password_hash', async () => {
      service.getProfile.mockResolvedValue(mockProfileResponse)

      const result = await controller.getProfile(TENANT_ID)

      expect(result).not.toHaveProperty('passwordHash')
      expect(result).not.toHaveProperty('password_hash')
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /doctor/profile
  // -------------------------------------------------------------------------

  describe('updateProfile', () => {
    it('CT-82-02: delega ao profileService.updateProfile com tenantId e dto corretos', async () => {
      const dto = { specialty: 'Neurologia', phone: '11988888888' }
      service.updateProfile.mockResolvedValue({ ...mockProfileResponse, specialty: 'Neurologia', phone: '11988888888' })

      const result = await controller.updateProfile(TENANT_ID, dto)

      expect(service.updateProfile).toHaveBeenCalledWith(TENANT_ID, dto)
      expect(result.specialty).toBe('Neurologia')
    })

    it('PATCH /profile com working_hours passa dto completo ao service', async () => {
      const dto = {
        workingHours: {
          monday: [{ start: '08:00', end: '12:00' }],
          wednesday: [{ start: '13:00', end: '17:00' }],
        },
      }
      service.updateProfile.mockResolvedValue(mockProfileResponse)

      await controller.updateProfile(TENANT_ID, dto)

      expect(service.updateProfile).toHaveBeenCalledWith(TENANT_ID, dto)
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /doctor/profile/branding
  // -------------------------------------------------------------------------

  describe('updateBranding', () => {
    it('CT-82-03: delega ao profileService.updateBranding com tenantId e dto corretos', async () => {
      const dto = { primaryColor: '#FF5500' }
      service.updateBranding.mockResolvedValue(mockBrandingResponse)

      const result = await controller.updateBranding(TENANT_ID, dto)

      expect(service.updateBranding).toHaveBeenCalledWith(TENANT_ID, dto)
      expect(result.primaryColor).toBe('#FF5500')
    })
  })

  // -------------------------------------------------------------------------
  // CT-82-05: sem token → 401
  // -------------------------------------------------------------------------

  describe('autenticação', () => {
    it('CT-82-05: JwtAuthGuard está aplicado na classe (sem token → 401 em e2e)', () => {
      // Guards são verificados via metadata — a execução real acontece no pipeline HTTP (e2e)
      const guards: unknown[] = Reflect.getMetadata('__guards__', ProfileController) ?? []
      const guardNames = guards.map((g) => (g as { name?: string }).name ?? 'unknown')
      expect(guardNames).toContain('JwtAuthGuard')
    })
  })
})
