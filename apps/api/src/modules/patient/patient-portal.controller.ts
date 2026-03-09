import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { join } from 'path'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { PatientService } from './patient.service'
import { GetPortalAccessSchema, type GetPortalAccessDto } from './dto/get-portal-access.dto'

/**
 * Portal do paciente — rotas públicas autenticadas via código de acesso.
 * Sem JwtAuthGuard / TenantGuard: a autenticação é feita pelo portal_access_code.
 */
@Controller('patient/portal')
export class PatientPortalController {
  constructor(private readonly patientService: PatientService) {}

  /**
   * POST /api/v1/patient/portal/access
   *
   * Autentica o paciente pelo código de acesso e retorna os dados do portal:
   * patient, doctor, tenant, appointments e documents.
   * clinical_notes NUNCA são retornadas.
   */
  @Post('access')
  access(@Body(new ZodValidationPipe(GetPortalAccessSchema)) dto: GetPortalAccessDto) {
    return this.patientService.getPatientPortalData(dto.code)
  }

  /**
   * GET /api/v1/patient/portal/documents/:id?code=<code>
   *
   * Faz o download de um documento do paciente. Autenticado via query param `code`.
   * O file_url armazenado é relativo ao cwd (ex: /uploads/{tenantId}/{filename}).
   */
  @Get('documents/:id')
  async downloadDocument(
    @Param('id') id: string,
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    const doc = await this.patientService.getPatientDocument(code, id)
    const filePath = join(process.cwd(), doc.file_url as string)
    res.download(filePath, doc.file_name as string)
  }
}
