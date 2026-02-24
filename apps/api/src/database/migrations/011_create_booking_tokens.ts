import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE booking_tokens (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      token           VARCHAR(64)  NOT NULL,
      phone           VARCHAR(20),
      expires_at      TIMESTAMPTZ  NOT NULL,
      used            BOOLEAN      NOT NULL DEFAULT false,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT booking_tokens_token_unique UNIQUE (token)
    );

    CREATE INDEX idx_booking_tokens_token ON booking_tokens (token) WHERE used = false;
    CREATE INDEX idx_booking_tokens_expires_at ON booking_tokens (expires_at);

    COMMENT ON TABLE booking_tokens IS 'Temporary tokens for public booking page. Expire in 24h, single-use.';
    COMMENT ON COLUMN booking_tokens.token IS 'Cryptographically random token for booking URL. Unique, single-use.';
    COMMENT ON COLUMN booking_tokens.phone IS 'Optional patient phone. Used to pre-fill the booking form.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS booking_tokens CASCADE;')
}
