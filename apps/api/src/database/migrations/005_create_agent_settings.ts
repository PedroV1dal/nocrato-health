import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE agent_settings (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      welcome_message     TEXT         DEFAULT '',
      personality         TEXT         DEFAULT '',
      faq                 TEXT         DEFAULT '',
      appointment_rules   TEXT         DEFAULT '',
      extra_config        JSONB        DEFAULT '{}',
      enabled             BOOLEAN      NOT NULL DEFAULT true,
      created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

      CONSTRAINT agent_settings_tenant_unique UNIQUE (tenant_id)
    );

    CREATE INDEX idx_agent_settings_tenant_id ON agent_settings (tenant_id);

    COMMENT ON TABLE agent_settings IS 'WhatsApp AI agent configuration. 1:1 with tenant.';
    COMMENT ON COLUMN agent_settings.extra_config IS 'Flexible JSONB for agent config that does not warrant its own column yet.';
    COMMENT ON COLUMN agent_settings.appointment_rules IS 'Natural language scheduling rules interpreted by the agent.';
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS agent_settings CASCADE;')
}
