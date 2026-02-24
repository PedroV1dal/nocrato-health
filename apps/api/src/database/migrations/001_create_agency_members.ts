import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE agency_members (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email           VARCHAR(255) NOT NULL,
      password_hash   VARCHAR(255),
      name            VARCHAR(255) NOT NULL,
      role            VARCHAR(50)  NOT NULL DEFAULT 'agency_member',
      status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
      last_login_at   TIMESTAMPTZ,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT agency_members_email_unique UNIQUE (email),
      CONSTRAINT agency_members_role_check CHECK (role IN ('agency_admin', 'agency_member')),
      CONSTRAINT agency_members_status_check CHECK (status IN ('pending', 'active', 'inactive'))
    );

    CREATE INDEX idx_agency_members_email ON agency_members (email);
    CREATE INDEX idx_agency_members_status ON agency_members (status);

    COMMENT ON TABLE agency_members IS 'Nocrato internal staff. Separate auth domain from doctors.';
    COMMENT ON COLUMN agency_members.password_hash IS 'NULL until member accepts invite and sets password. First admin is seeded directly.';
    COMMENT ON COLUMN agency_members.role IS 'MVP: agency_admin | agency_member. V2 will introduce granular RBAC.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS agency_members CASCADE;')
}
