import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE clinical_notes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      appointment_id  UUID         NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      content         TEXT         NOT NULL,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_clinical_notes_appointment_id ON clinical_notes (appointment_id);
    CREATE INDEX idx_clinical_notes_patient_id ON clinical_notes (patient_id);
    CREATE INDEX idx_clinical_notes_tenant_id ON clinical_notes (tenant_id);

    COMMENT ON TABLE clinical_notes IS 'Doctor clinical notes per appointment. Medical data — ensure encryption at rest.';
    COMMENT ON COLUMN clinical_notes.content IS 'Free-form clinical note. Always authored by the doctor.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS clinical_notes CASCADE;')
}
