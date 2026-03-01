import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common'
import { OnboardingService } from './onboarding.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { TenantId } from '@/common/decorators/tenant.decorator'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { UpdateProfileSchema, UpdateProfileDto } from './dto/update-profile.dto'
import { UpdateScheduleSchema, UpdateScheduleDto } from './dto/update-schedule.dto'
import { UpdateBrandingSchema, UpdateBrandingDto } from './dto/update-branding.dto'
import { UpdateAgentSettingsSchema, UpdateAgentSettingsDto } from './dto/update-agent-settings.dto'

@Controller('doctor/onboarding')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('doctor')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // US-3.1: Status do wizard de onboarding
  @Get('status')
  getStatus(@TenantId() tenantId: string) {
    return this.onboardingService.getOnboardingStatus(tenantId)
  }

  // US-3.1: Atualização do perfil do doutor (step 1)
  @Patch('profile')
  updateProfile(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfileDto,
  ) {
    return this.onboardingService.updateProfile(tenantId, body)
  }

  // US-3.1: Atualização da agenda (step 2)
  @Patch('schedule')
  updateSchedule(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateScheduleSchema)) body: UpdateScheduleDto,
  ) {
    return this.onboardingService.updateSchedule(tenantId, body)
  }

  // US-3.1: Atualização de branding do tenant (step 3)
  @Patch('branding')
  updateBranding(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateBrandingSchema)) body: UpdateBrandingDto,
  ) {
    return this.onboardingService.updateBranding(tenantId, body)
  }

  // US-3.1: Upsert das configurações do agente WhatsApp (step 4)
  @Patch('agent')
  updateAgentSettings(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateAgentSettingsSchema)) body: UpdateAgentSettingsDto,
  ) {
    return this.onboardingService.updateAgentSettings(tenantId, body)
  }

  // US-3.1: Conclusão do onboarding (valida steps obrigatórios e marca como completo)
  @Post('complete')
  completeOnboarding(@TenantId() tenantId: string) {
    return this.onboardingService.completeOnboarding(tenantId)
  }
}
