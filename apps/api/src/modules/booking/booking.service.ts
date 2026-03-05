import * as crypto from 'crypto'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Knex } from 'knex'
import { KNEX } from '@/database/knex.provider'
import { env } from '@/config/env'

@Injectable()
export class BookingService {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  async generateToken(
    tenantId: string,
    phone?: string,
  ): Promise<{ token: string; expiresAt: Date; bookingUrl: string }> {
    // 1. Buscar slug do tenant — NotFoundException se não existir
    const tenant = await this.knex('tenants').where({ id: tenantId }).select('slug').first()

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado')
    }

    // 2. Gerar token de 64 chars hexadecimais
    const token = crypto.randomBytes(32).toString('hex')

    // 3. Calcular expiração (24h a partir de agora)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // 4. Persistir em booking_tokens
    await this.knex('booking_tokens').insert({
      tenant_id: tenantId,
      token,
      phone: phone ?? null,
      expires_at: expiresAt,
      used: false,
    })

    // 5. Construir bookingUrl com slug e token
    const bookingUrl = `${env.FRONTEND_URL}/book/${tenant.slug}?token=${token}`

    return { token, expiresAt, bookingUrl }
  }
}
