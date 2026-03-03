import { Module } from '@nestjs/common'
import { ClinicalNoteController } from './clinical-note.controller'
import { ClinicalNoteService } from './clinical-note.service'

// DatabaseModule é @Global() — não reimportar aqui
@Module({
  controllers: [ClinicalNoteController],
  providers: [ClinicalNoteService],
  exports: [ClinicalNoteService],
})
export class ClinicalNoteModule {}
