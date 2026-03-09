import { Module } from '@nestjs/common'
import { PatientController } from './patient.controller'
import { PatientPortalController } from './patient-portal.controller'
import { PatientService } from './patient.service'

// DatabaseModule é @Global() — o provider KNEX já está disponível globalmente
// sem precisar reimportar aqui.
@Module({
  controllers: [PatientController, PatientPortalController],
  providers: [PatientService],
  exports: [PatientService],
})
export class PatientModule {}
