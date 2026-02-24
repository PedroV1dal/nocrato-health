import knex, { type Knex } from 'knex'
import { env } from '../config/env'

export const KNEX = Symbol('KNEX')

export const knexProvider = {
  provide: KNEX,
  useFactory: (): Knex => {
    return knex({
      client: 'pg',
      connection: {
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
      },
      pool: {
        min: 2,
        max: 10,
      },
    })
  },
}
