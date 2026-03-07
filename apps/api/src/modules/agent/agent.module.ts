import { Module } from '@nestjs/common'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'
import { WhatsAppService } from './whatsapp.service'
import { ConversationService } from './conversation.service'
import { PatientModule } from '@/modules/patient/patient.module'
import { BookingModule } from '@/modules/booking/booking.module'
import { AppointmentModule } from '@/modules/appointment/appointment.module'

// DatabaseModule e EventLogModule são @Global() — não reimportar aqui
@Module({
  imports: [PatientModule, BookingModule, AppointmentModule],
  controllers: [AgentController],
  providers: [AgentService, WhatsAppService, ConversationService],
  exports: [AgentService, WhatsAppService],
})
export class AgentModule {}
