import { Module } from '@nestjs/common'
import { DatabaseModule } from './database/database.module'
import { AuthModule } from './modules/auth/auth.module'
import { InviteModule } from './modules/invite/invite.module'
import { AgencyModule } from './modules/agency/agency.module'
import { HealthController } from './modules/health/health.controller'

@Module({
  imports: [DatabaseModule, AuthModule, InviteModule, AgencyModule],
  controllers: [HealthController],
})
export class AppModule {}
