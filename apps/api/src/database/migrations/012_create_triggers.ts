import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON agency_members
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON invites
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON doctors
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON patients
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON appointments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON clinical_notes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_updated_at ON documents;
    DROP TRIGGER IF EXISTS set_updated_at ON clinical_notes;
    DROP TRIGGER IF EXISTS set_updated_at ON appointments;
    DROP TRIGGER IF EXISTS set_updated_at ON patients;
    DROP TRIGGER IF EXISTS set_updated_at ON agent_settings;
    DROP TRIGGER IF EXISTS set_updated_at ON doctors;
    DROP TRIGGER IF EXISTS set_updated_at ON tenants;
    DROP TRIGGER IF EXISTS set_updated_at ON invites;
    DROP TRIGGER IF EXISTS set_updated_at ON agency_members;
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `)
}
