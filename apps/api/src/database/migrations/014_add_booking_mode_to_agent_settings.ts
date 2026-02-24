import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE agent_settings
      ADD COLUMN booking_mode VARCHAR(10) NOT NULL DEFAULT 'both'
        CONSTRAINT agent_settings_booking_mode_check CHECK (booking_mode IN ('link', 'chat', 'both'));

    COMMENT ON COLUMN agent_settings.booking_mode IS 'link: agent sends booking link only; chat: books in-chat; both: agent decides.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE agent_settings DROP COLUMN IF EXISTS booking_mode;
  `)
}
