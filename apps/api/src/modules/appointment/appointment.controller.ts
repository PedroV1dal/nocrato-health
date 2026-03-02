import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AppointmentService } from './appointment.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { TenantId } from '@/common/decorators/tenant.decorator'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { ListAppointmentsQuerySchema, ListAppointmentsDto } from './dto/list-appointments.dto'

@Controller('doctor/appointments')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('doctor')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // US-5.1: Listagem paginada de consultas do doutor autenticado com filtros opcionais
  @Get()
  listAppointments(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(ListAppointmentsQuerySchema)) query: ListAppointmentsDto,
  ) {
    return this.appointmentService.listAppointments(tenantId, query)
  }
}
