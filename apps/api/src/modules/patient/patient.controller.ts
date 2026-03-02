import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { PatientService } from './patient.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { TenantId } from '@/common/decorators/tenant.decorator'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { ListPatientsQuerySchema, ListPatientsQueryDto } from './dto/list-patients.dto'
import { createPatientSchema, CreatePatientDto } from './dto/create-patient.dto'
import { UpdatePatientSchema, UpdatePatientDto } from './dto/update-patient.dto'

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

  // US-4.3: Criar paciente manualmente pelo doutor autenticado
  @Post()
  createPatient(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createPatientSchema)) dto: CreatePatientDto,
  ) {
    return this.patientService.createPatient(tenantId, dto)
  }

  // US-4.4: Edição parcial de paciente pelo doutor autenticado
  @Patch(':id')
  updatePatient(
    @TenantId() tenantId: string,
    @Param('id', new ZodValidationPipe(z.string().uuid())) patientId: string,
    @Body(new ZodValidationPipe(UpdatePatientSchema)) dto: UpdatePatientDto,
  ) {
    return this.patientService.updatePatient(tenantId, patientId, dto)
  }
}
