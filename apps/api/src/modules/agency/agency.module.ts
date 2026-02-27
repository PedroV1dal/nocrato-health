import { Module } from '@nestjs/common'
import { AgencyController } from './agency.controller'
import { AgencyService } from './agency.service'

// DatabaseModule é @Global() — o provider KNEX já está disponível globalmente
// sem precisar reimportar aqui.
@Module({
  controllers: [AgencyController],
  providers: [AgencyService],
})
export class AgencyModule {}
