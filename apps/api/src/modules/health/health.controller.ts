import { Controller, Get, Inject } from '@nestjs/common'
import type { Knex } from 'knex'
import { KNEX } from '../../database/knex.provider'

@Controller('health')
export class HealthController {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  @Get()
  async check() {
    await this.knex.raw('SELECT 1')
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
