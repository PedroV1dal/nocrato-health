import { Global, Module } from '@nestjs/common'
import { knexProvider } from './knex.provider'

@Global()
@Module({
  providers: [knexProvider],
  exports: [knexProvider],
})
export class DatabaseModule {}
