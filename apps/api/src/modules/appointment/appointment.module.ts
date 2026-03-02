import { Module } from '@nestjs/common'
import { AppointmentController } from './appointment.controller'
import { AppointmentService } from './appointment.service'

// DatabaseModule é @Global() — não reimportar aqui
@Module({
  controllers: [AppointmentController],
  providers: [AppointmentService],
  exports: [AppointmentService],
})
export class AppointmentModule {}
