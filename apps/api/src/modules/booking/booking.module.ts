import { Module } from '@nestjs/common'
import { BookingService } from './booking.service'

// DatabaseModule é @Global() — não reimportar aqui
@Module({
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
