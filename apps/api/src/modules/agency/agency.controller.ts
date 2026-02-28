import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { AgencyService } from './agency.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { ListDoctorsQuerySchema, ListDoctorsQueryDto } from './dto/list-doctors.dto'
import { UpdateDoctorStatusSchema, UpdateDoctorStatusDto } from './dto/update-doctor-status.dto'
import { ListMembersQuerySchema, ListMembersQueryDto } from './dto/list-members.dto'
import { UpdateMemberStatusSchema, UpdateMemberStatusDto } from './dto/update-member-status.dto'

@Controller('agency')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('agency_admin', 'agency_member')
export class AgencyController {
  constructor(private readonly agencyService: AgencyService) {}

  // US-2.1: Dashboard da agência — estatísticas globais
  @Get('dashboard')
  getDashboardStats() {
    return this.agencyService.getDashboardStats()
  }

  // US-2.2: Listagem paginada de doutores
  @Get('doctors')
  listDoctors(@Query(new ZodValidationPipe(ListDoctorsQuerySchema)) query: ListDoctorsQueryDto) {
    return this.agencyService.listDoctors(query.page, query.limit, query.status)
  }

  // US-2.3: Atualização de status de um doutor
  @Patch('doctors/:id/status')
  @Roles('agency_admin')
  updateDoctorStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDoctorStatusSchema)) body: UpdateDoctorStatusDto,
  ) {
    return this.agencyService.updateDoctorStatus(id, body.status)
  }

  // US-2.4: Listagem paginada de membros da agência — agency_admin e agency_member podem listar
  @Get('members')
  listMembers(@Query(new ZodValidationPipe(ListMembersQuerySchema)) query: ListMembersQueryDto) {
    return this.agencyService.listMembers(query.page, query.limit, query.status)
  }

  // US-2.4: Atualização de status de um membro — apenas agency_admin
  @Patch('members/:id/status')
  @Roles('agency_admin')
  updateMemberStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMemberStatusSchema)) body: UpdateMemberStatusDto,
  ) {
    return this.agencyService.updateMemberStatus(id, body.status)
  }
}
