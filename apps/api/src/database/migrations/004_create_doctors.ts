import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE doctors (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id               UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email                   VARCHAR(255) NOT NULL,
      password_hash           VARCHAR(255) NOT NULL,
      name                    VARCHAR(255) NOT NULL,
      crm                     VARCHAR(15)  NOT NULL,
      crm_state               CHAR(2)      NOT NULL,
      specialty               VARCHAR(255),
      phone                   VARCHAR(20),
      working_hours           JSONB        DEFAULT '{}',
      timezone                VARCHAR(50)  NOT NULL DEFAULT 'America/Sao_Paulo',
      appointment_duration    INTEGER      NOT NULL DEFAULT 30,
      onboarding_completed    BOOLEAN      NOT NULL DEFAULT false,
      status                  VARCHAR(50)  NOT NULL DEFAULT 'active',
      last_login_at           TIMESTAMPTZ,
      created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT doctors_email_unique UNIQUE (email),
      CONSTRAINT doctors_tenant_unique UNIQUE (tenant_id),
      CONSTRAINT doctors_status_check CHECK (status IN ('active', 'inactive')),
      CONSTRAINT doctors_crm_state_check CHECK (crm_state ~ '^[A-Z]{2}$'),
      CONSTRAINT doctors_appointment_duration_check CHECK (appointment_duration > 0 AND appointment_duration <= 480)
    );

    CREATE INDEX idx_doctors_email ON doctors (email);
    CREATE INDEX idx_doctors_tenant_id ON doctors (tenant_id);

    COMMENT ON TABLE doctors IS 'Doctor profile and credentials. 1:1 with tenants in MVP.';
    COMMENT ON COLUMN doctors.crm IS 'Brazilian medical registration number (4-10 digits).';
    COMMENT ON COLUMN doctors.crm_state IS 'Brazilian state abbreviation (UF) for CRM. e.g., SP, RJ, MG.';
    COMMENT ON COLUMN doctors.working_hours IS 'JSONB schedule: {"monday": [{"start":"08:00","end":"12:00"}], ...}';
    COMMENT ON COLUMN doctors.onboarding_completed IS 'True after doctor finishes all onboarding steps.';
    COMMENT ON COLUMN doctors.timezone IS 'IANA timezone identifier. Default: America/Sao_Paulo.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS doctors CASCADE;')
}
