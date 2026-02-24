import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE invites (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type            VARCHAR(50)  NOT NULL,
      email           VARCHAR(255) NOT NULL,
      invited_by      UUID         NOT NULL REFERENCES agency_members(id),
      token           VARCHAR(255) NOT NULL,
      status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
      expires_at      TIMESTAMPTZ  NOT NULL,
      accepted_at     TIMESTAMPTZ,
      metadata        JSONB        DEFAULT '{}',
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT invites_type_check CHECK (type IN ('agency_member', 'doctor')),
      CONSTRAINT invites_status_check CHECK (status IN ('pending', 'accepted', 'expired')),
      CONSTRAINT invites_token_unique UNIQUE (token)
    );

    CREATE INDEX idx_invites_token ON invites (token);
    CREATE INDEX idx_invites_email_status ON invites (email, status);
    CREATE INDEX idx_invites_type_status ON invites (type, status);

    COMMENT ON TABLE invites IS 'Polymorphic invite table for agency members and doctors. Token-based email flow.';
    COMMENT ON COLUMN invites.metadata IS 'Flexible JSONB for invite context (e.g., intended role, suggested specialty).';
    COMMENT ON COLUMN invites.expires_at IS 'Invites expire after a configurable period (default: 7 days).';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS invites CASCADE;')
}
