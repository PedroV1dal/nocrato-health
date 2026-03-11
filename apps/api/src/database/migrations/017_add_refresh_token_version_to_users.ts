import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    -- SEC-07: adicionar refresh_token_version para invalidar refresh tokens antigos na rotação.
    -- Ao fazer refresh, o service incrementa a versão e o JWT antigo (com versão menor) é rejeitado.
    -- DEFAULT 0 garante retrocompatibilidade com registros existentes.
    ALTER TABLE agency_members
      ADD COLUMN refresh_token_version INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE doctors
      ADD COLUMN refresh_token_version INTEGER NOT NULL DEFAULT 0;
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE agency_members DROP COLUMN IF EXISTS refresh_token_version;
    ALTER TABLE doctors DROP COLUMN IF EXISTS refresh_token_version;
  `)
}
