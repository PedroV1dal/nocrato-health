import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE event_log (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      event_type      VARCHAR(100) NOT NULL,
      payload         JSONB        NOT NULL DEFAULT '{}',
      actor_type      VARCHAR(50),
      actor_id        UUID,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_event_log_tenant_created ON event_log (tenant_id, created_at);
    CREATE INDEX idx_event_log_tenant_event_type ON event_log (tenant_id, event_type);
    CREATE INDEX idx_event_log_event_type ON event_log (event_type, created_at);

    COMMENT ON TABLE event_log IS 'Append-only audit trail. Immutable — no updated_at.';
    COMMENT ON COLUMN event_log.event_type IS 'Dot-notation namespace: appointment.created, patient.updated, etc.';
    COMMENT ON COLUMN event_log.payload IS 'Event-specific JSONB data. Structure varies by event_type.';
    COMMENT ON COLUMN event_log.actor_id IS 'Polymorphic: references doctor.id or agency_member.id based on actor_type. Not a FK.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS event_log CASCADE;')
}
