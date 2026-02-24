import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE patients (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id               UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name                    VARCHAR(255) NOT NULL,
      phone                   VARCHAR(20)  NOT NULL,
      cpf                     VARCHAR(14),
      email                   VARCHAR(255),
      date_of_birth           DATE,
      source                  VARCHAR(50)  NOT NULL DEFAULT 'whatsapp_agent',
      status                  VARCHAR(50)  NOT NULL DEFAULT 'active',
      portal_access_code      VARCHAR(20),
      portal_active           BOOLEAN      NOT NULL DEFAULT false,
      notes                   TEXT,
      created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT patients_source_check CHECK (source IN ('whatsapp_agent', 'manual')),
      CONSTRAINT patients_status_check CHECK (status IN ('active', 'inactive')),
      CONSTRAINT patients_portal_access_code_unique UNIQUE (portal_access_code)
    );

    CREATE UNIQUE INDEX idx_patients_tenant_phone ON patients (tenant_id, phone);
    CREATE INDEX idx_patients_portal_access_code ON patients (portal_access_code)
      WHERE portal_access_code IS NOT NULL;
    CREATE INDEX idx_patients_tenant_id ON patients (tenant_id);
    CREATE INDEX idx_patients_tenant_cpf ON patients (tenant_id, cpf)
      WHERE cpf IS NOT NULL;

    COMMENT ON TABLE patients IS 'Patient records. Primarily created by WhatsApp agent.';
    COMMENT ON COLUMN patients.phone IS 'Primary identifier for WhatsApp. Unique per tenant.';
    COMMENT ON COLUMN patients.portal_access_code IS 'Globally unique code for patient portal login. NULL until activation.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS patients CASCADE;')
}
