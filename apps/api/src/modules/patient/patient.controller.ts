import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { PatientService } from './patient.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { TenantId } from '@/common/decorators/tenant.decorator'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { ListPatientsQuerySchema, ListPatientsQueryDto } from './dto/list-patients.dto'

@Controller('doctor/patients')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('doctor')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // US-4.1: Listagem paginada de pacientes do doutor autenticado
  @Get()
  listPatients(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(ListPatientsQuerySchema)) query: ListPatientsQueryDto,
  ) {
    return this.patientService.listPatients(tenantId, query)
  }

  // US-4.2: Perfil completo do paciente com appointments, notas clínicas e documentos
  @Get(':id')
  getPatientProfile(
    @TenantId() tenantId: string,
    @Param('id', new ZodValidationPipe(z.string().uuid())) patientId: string,
  ) {
    return this.patientService.getPatientProfile(tenantId, patientId)
  }
}
