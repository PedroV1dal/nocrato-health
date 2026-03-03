import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import { ClinicalNoteService } from './clinical-note.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { TenantId } from '@/common/decorators/tenant.decorator'
import { CurrentUser } from '@/common/decorators/current-user.decorator'
import type { JwtPayload } from '@/modules/auth/strategies/jwt.strategy'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { CreateClinicalNoteSchema, CreateClinicalNoteDto } from './dto/create-clinical-note.dto'

@Controller('doctor/clinical-notes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('doctor')
export class ClinicalNoteController {
  constructor(private readonly clinicalNoteService: ClinicalNoteService) {}

  // US-6.1: Criar nota clínica vinculada a consulta e paciente do tenant autenticado
  @Post()
  @HttpCode(201)
  createClinicalNote(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateClinicalNoteSchema)) dto: CreateClinicalNoteDto,
  ) {
    return this.clinicalNoteService.createClinicalNote(tenantId, user.sub, dto)
  }
}
