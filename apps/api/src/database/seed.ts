import knex from 'knex'
import bcrypt from 'bcrypt'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

async function runSeed() {
  const db = knex({
    client: 'pg',
    connection: {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? 'nocrato_health',
      user: process.env.DB_USER ?? 'nocrato',
      password: process.env.DB_PASSWORD ?? 'nocrato_secret',
    },
  })

  try {
    const existing = await db('agency_members')
      .where({ email: 'admin@nocrato.com' })
      .first()

    if (existing) {
      console.log('ℹ️  Seed já aplicado — admin@nocrato.com já existe.')
      return
    }

    const passwordHash = await bcrypt.hash('admin123', 10)

    await db('agency_members').insert({
      email: 'admin@nocrato.com',
      password_hash: passwordHash,
      name: 'Admin Nocrato',
      role: 'agency_admin',
      status: 'active',
    })

    console.log('✅ Seed aplicado — admin@nocrato.com criado com senha admin123.')
  } finally {
    await db.destroy()
  }
}

runSeed().catch((err) => {
  console.error('❌ Erro ao rodar seed:', err)
  process.exit(1)
})
