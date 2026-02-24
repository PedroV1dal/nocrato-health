import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE documents (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      appointment_id  UUID         REFERENCES appointments(id) ON DELETE SET NULL,
      type            VARCHAR(50)  NOT NULL,
      file_url        TEXT         NOT NULL,
      file_name       VARCHAR(255) NOT NULL,
      file_size_bytes BIGINT,
      mime_type       VARCHAR(100),
      description     TEXT,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT documents_type_check CHECK (type IN ('prescription', 'certificate', 'exam', 'other'))
    );

    CREATE INDEX idx_documents_patient_id ON documents (patient_id);
    CREATE INDEX idx_documents_tenant_id ON documents (tenant_id);
    CREATE INDEX idx_documents_appointment_id ON documents (appointment_id)
      WHERE appointment_id IS NOT NULL;
    CREATE INDEX idx_documents_tenant_type ON documents (tenant_id, type);

    COMMENT ON TABLE documents IS 'Doctor-uploaded files for patients. Viewable in patient read-only portal.';
    COMMENT ON COLUMN documents.appointment_id IS 'Optional. Some documents are general and not tied to a specific appointment.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS documents CASCADE;')
}
