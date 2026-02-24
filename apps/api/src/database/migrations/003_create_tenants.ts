import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE tenants (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug            VARCHAR(100) NOT NULL,
      name            VARCHAR(255) NOT NULL,
      status          VARCHAR(50)  NOT NULL DEFAULT 'active',
      primary_color   VARCHAR(7)   DEFAULT '#0066CC',
      logo_url        TEXT,
      invite_id       UUID         REFERENCES invites(id),
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT tenants_slug_unique UNIQUE (slug),
      CONSTRAINT tenants_status_check CHECK (status IN ('active', 'inactive')),
      CONSTRAINT tenants_primary_color_check CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$')
    );

    CREATE UNIQUE INDEX idx_tenants_slug ON tenants (slug);
    CREATE INDEX idx_tenants_status ON tenants (status);

    COMMENT ON TABLE tenants IS 'Doctor portal container. All doctor-scoped data references tenant_id. 1:1 with doctors.';
    COMMENT ON COLUMN tenants.slug IS 'URL-friendly identifier set during onboarding. e.g., "dr-silva" -> /dr-silva';
    COMMENT ON COLUMN tenants.primary_color IS 'Hex color for portal branding. Must match #RRGGBB format.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS tenants CASCADE;')
}
