import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE conversations (
      id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      phone           VARCHAR(20)  NOT NULL,
      messages        JSONB        NOT NULL DEFAULT '[]',
      last_message_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT conversations_tenant_phone UNIQUE (tenant_id, phone)
    );

    CREATE INDEX idx_conversations_tenant_phone ON conversations (tenant_id, phone);
    CREATE INDEX idx_conversations_last_message_at ON conversations (last_message_at);

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    COMMENT ON TABLE conversations IS 'WhatsApp agent conversation state. One row per patient phone per tenant. Trimmed to last 20 messages.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_updated_at ON conversations;
    DROP TABLE IF EXISTS conversations CASCADE;
  `)
}
