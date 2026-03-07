import { Inject, Injectable } from '@nestjs/common'
import type { Knex } from 'knex'
import { KNEX } from '@/database/knex.provider'

@Injectable()
export class EventLogService {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  // Append-only: registra um evento no audit trail.
  // Não usa .returning() — fire-and-complete sem necessidade do ID gerado.
  async append(
    tenantId: string,
    eventType: string,
    actorType: 'doctor' | 'patient' | 'agent' | 'system',
    actorId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.knex('event_log').insert({
      tenant_id: tenantId,
      event_type: eventType,
      actor_type: actorType,
      actor_id: actorId,
      payload,
    })
  }
}
