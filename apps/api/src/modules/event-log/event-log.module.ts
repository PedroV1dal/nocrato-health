import { Global, Module } from '@nestjs/common'
import { EventLogService } from './event-log.service'

// @Global(): EventLogService fica disponível em todo o app sem reimportar este módulo.
// DatabaseModule é @Global() — o provider KNEX já está disponível globalmente.
@Global()
@Module({
  providers: [EventLogService],
  exports: [EventLogService],
})
export class EventLogModule {}
