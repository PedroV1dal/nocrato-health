import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE appointments (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id               UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      patient_id              UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      date_time               TIMESTAMPTZ  NOT NULL,
      duration_minutes        INTEGER      NOT NULL DEFAULT 30,
      status                  VARCHAR(50)  NOT NULL DEFAULT 'scheduled',
      cancellation_reason     TEXT,
      rescheduled_to_id       UUID         REFERENCES appointments(id),
      agent_summary           TEXT,
      created_by              VARCHAR(50)  NOT NULL DEFAULT 'agent',
      started_at              TIMESTAMPTZ,
      completed_at            TIMESTAMPTZ,
      created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT appointments_status_check CHECK (
        status IN ('scheduled', 'waiting', 'in_progress', 'completed', 'no_show', 'rescheduled', 'cancelled')
      ),
      CONSTRAINT appointments_created_by_check CHECK (created_by IN ('agent', 'doctor')),
      CONSTRAINT appointments_duration_check CHECK (duration_minutes > 0 AND duration_minutes <= 480)
    );

    CREATE INDEX idx_appointments_tenant_datetime ON appointments (tenant_id, date_time);
    CREATE INDEX idx_appointments_patient_id ON appointments (patient_id);
    CREATE INDEX idx_appointments_tenant_status ON appointments (tenant_id, status);
    CREATE INDEX idx_appointments_status_datetime ON appointments (status, date_time)
      WHERE status = 'scheduled';
    CREATE INDEX idx_appointments_tenant_patient_date ON appointments (tenant_id, patient_id, date_time);

    COMMENT ON TABLE appointments IS 'Core scheduling entity. Status lifecycle: scheduled -> waiting -> in_progress -> completed.';
    COMMENT ON COLUMN appointments.date_time IS 'Scheduled start time in UTC. App converts to doctor timezone for display.';
    COMMENT ON COLUMN appointments.agent_summary IS 'AI-generated WhatsApp conversation summary.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS appointments CASCADE;')
}
