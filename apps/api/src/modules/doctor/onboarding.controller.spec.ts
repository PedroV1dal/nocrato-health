/**
 * US-3.1 — Controller spec: OnboardingController
 *
 * Estratégia: testar que cada handler delega ao serviço correto com os argumentos
 * corretos (tenantId, dto). Os guards são desabilitados — são testados isoladamente.
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
import { ExecutionContext } from '@nestjs/common'
import { OnboardingController } from './onboarding.controller'
import { OnboardingService } from './onboarding.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { RolesGuard } from '@/common/guards/roles.guard'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1'

const mockOnboardingStatus = {
  currentStep: 3,
  completed: false,
  steps: { profile: true, schedule: true, branding: false, agent: false },
}

const mockDoctor = {
  id: 'doctor-uuid-1',
  tenant_id: TENANT_ID,
  email: 'dr.silva@example.com',
  name: 'Dr. Silva',
  specialty: 'Cardiologia',
  phone: null,
  crm: '12345',
  crm_state: 'SP',
  working_hours: null,
  timezone: 'America/Sao_Paulo',
  appointment_duration: 30,
  onboarding_completed: false,
  status: 'active',
}

const mockTenant = {
  id: TENANT_ID,
  slug: 'dr-silva',
  name: 'Dr. Silva',
  primary_color: '#FF5500',
  logo_url: null,
}

const mockAgentSettings = {
  id: 'agent-uuid-1',
  tenant_id: TENANT_ID,
  welcome_message: 'Olá!',
  personality: null,
  faq: null,
  enabled: false,
  booking_mode: 'both',
  appointment_rules: null,
}

// ---------------------------------------------------------------------------
// Guard passthrough mock (desabilita guards nas specs de controller)
// ---------------------------------------------------------------------------

const allowAllGuard = {
  canActivate: (_ctx: ExecutionContext) => true,
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('OnboardingController', () => {
  let controller: OnboardingController
  let service: jest.Mocked<OnboardingService>

  beforeEach(async () => {
    const mockService: jest.Mocked<Partial<OnboardingService>> = {
      getOnboardingStatus: jest.fn(),
      updateProfile: jest.fn(),
      updateSchedule: jest.fn(),
      updateBranding: jest.fn(),
      updateAgentSettings: jest.fn(),
      completeOnboarding: jest.fn(),
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        { provide: OnboardingService, useValue: mockService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(TenantGuard)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .compile()

    controller = moduleRef.get<OnboardingController>(OnboardingController)
    service = moduleRef.get(OnboardingService)
  })

  // -------------------------------------------------------------------------
  // GET /status
  // -------------------------------------------------------------------------

  describe('getStatus', () => {
    it('should call onboardingService.getOnboardingStatus with tenantId', async () => {
      service.getOnboardingStatus.mockResolvedValue(mockOnboardingStatus)

      const result = await controller.getStatus(TENANT_ID)

      expect(service.getOnboardingStatus).toHaveBeenCalledWith(TENANT_ID)
      expect(result).toEqual(mockOnboardingStatus)
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /profile
  // -------------------------------------------------------------------------

  describe('updateProfile', () => {
    const dto = {
      name: 'Dr. Carlos Silva',
      specialty: 'Cardiologia',
      phone: '11999990000',
      crm: '54321',
      crmState: 'RJ',
    }

    it('should delegate to onboardingService.updateProfile with tenantId and dto', async () => {
      service.updateProfile.mockResolvedValue(mockDoctor as any)

      const result = await controller.updateProfile(TENANT_ID, dto)

      expect(service.updateProfile).toHaveBeenCalledWith(TENANT_ID, dto)
      expect(result).toEqual(mockDoctor)
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /schedule
  // -------------------------------------------------------------------------

  describe('updateSchedule', () => {
    const dto = {
      workingHours: { monday: [{ start: '08:00', end: '12:00' }] },
      timezone: 'America/Recife',
      appointmentDuration: 45,
    }

    it('should delegate to onboardingService.updateSchedule with tenantId and dto', async () => {
      service.updateSchedule.mockResolvedValue(mockDoctor as any)

      const result = await controller.updateSchedule(TENANT_ID, dto)

      expect(service.updateSchedule).toHaveBeenCalledWith(TENANT_ID, dto)
      expect(result).toEqual(mockDoctor)
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /branding
  // -------------------------------------------------------------------------

  describe('updateBranding', () => {
    const dto = { primaryColor: '#FF5500', logoUrl: 'https://example.com/logo.png' }

    it('should delegate to onboardingService.updateBranding with tenantId and dto', async () => {
      service.updateBranding.mockResolvedValue(mockTenant)

      const result = await controller.updateBranding(TENANT_ID, dto)

      expect(service.updateBranding).toHaveBeenCalledWith(TENANT_ID, dto)
      expect(result).toEqual(mockTenant)
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /agent
  // -------------------------------------------------------------------------

  describe('updateAgentSettings', () => {
    const dto = {
      welcomeMessage: 'Bem-vindo!',
      personality: 'Profissional',
      faq: 'Pergunta frequente...',
    }

    it('should delegate to onboardingService.updateAgentSettings with tenantId and dto', async () => {
      service.updateAgentSettings.mockResolvedValue(mockAgentSettings as any)

      const result = await controller.updateAgentSettings(TENANT_ID, dto)

      expect(service.updateAgentSettings).toHaveBeenCalledWith(TENANT_ID, dto)
      expect(result).toEqual(mockAgentSettings)
    })
  })

  // -------------------------------------------------------------------------
  // POST /complete
  // -------------------------------------------------------------------------

  describe('completeOnboarding', () => {
    const completeResult = {
      success: true as const,
      doctor: {
        id: 'doctor-uuid-1',
        name: 'Dr. Silva',
        email: 'dr.silva@example.com',
        tenantId: TENANT_ID,
      },
    }

    it('should delegate to onboardingService.completeOnboarding with tenantId', async () => {
      service.completeOnboarding.mockResolvedValue(completeResult)

      const result = await controller.completeOnboarding(TENANT_ID)

      expect(service.completeOnboarding).toHaveBeenCalledWith(TENANT_ID)
      expect(result).toEqual(completeResult)
    })
  })
})
