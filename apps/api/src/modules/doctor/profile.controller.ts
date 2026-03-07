import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { TenantId } from '@/common/decorators/tenant.decorator'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { ProfileService } from './profile.service'
import {
  UpdateProfileSettingsSchema,
  type UpdateProfileSettingsDto,
} from './dto/update-profile-settings.dto'
import {
  UpdateBrandingSettingsSchema,
  type UpdateBrandingSettingsDto,
} from './dto/update-branding-settings.dto'

@Controller('doctor/profile')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('doctor')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // US-8.2: Retorna perfil completo do doutor (sem password_hash) + branding do tenant
  @Get()
  getProfile(@TenantId() tenantId: string) {
    return this.profileService.getProfile(tenantId)
  }

  // US-8.2: Atualiza parcialmente o perfil do doutor (name, specialty, phone, workingHours, timezone)
  @Patch()
  updateProfile(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateProfileSettingsSchema)) dto: UpdateProfileSettingsDto,
  ) {
    return this.profileService.updateProfile(tenantId, dto)
  }

  // US-8.2: Atualiza parcialmente o branding do tenant (primaryColor, logoUrl)
  @Patch('branding')
  updateBranding(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateBrandingSettingsSchema)) dto: UpdateBrandingSettingsDto,
  ) {
    return this.profileService.updateBranding(tenantId, dto)
  }
}
