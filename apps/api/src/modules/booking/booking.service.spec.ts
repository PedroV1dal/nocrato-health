/**
 * US-7.1 — Gerar token de booking (BookingService.generateToken)
 *
 * Casos de teste cobertos:
 *  CT-71-01: happy path — token 64 chars hex, expiresAt ~24h no futuro, bookingUrl contém slug e token
 *  CT-71-02: token vinculado ao phone — phone passado → persistido no insert
 *  CT-71-03: token sem phone — phone=undefined → insert com phone=null
 *  CT-71-04: isolamento de tenant — tenant_id no insert corresponde ao tenantId chamado
 *  CT-71-05: tenant não encontrado → NotFoundException com mensagem em português
 */

// Mockar env ANTES de qualquer import que o carregue transitivamente.
// env.ts chama process.exit(1) se vars estiverem ausentes — não pode rodar em testes.
jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-at-least-16-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-16',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_NAME: 'nocrato_test',
    DB_USER: 'postgres',
    DB_PASSWORD: 'postgres',
    FRONTEND_URL: 'http://localhost:5173',
  },
}))

import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { BookingService } from './booking.service'
import { KNEX } from '@/database/knex.provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1'
const TENANT_SLUG = 'dr-silva'
const PHONE = '+5511999999999'

// ---------------------------------------------------------------------------
// Mock Knex factory
// ---------------------------------------------------------------------------

/**
 * Cria um mock Knex para generateToken.
 * Roteia chamadas por tabela:
 *  - 'tenants': .where().select().first() → retorna o tenant (ou null)
 *  - 'booking_tokens': .insert() → mockResolvedValue([])
 */
const createMockKnex = (options: { tenant?: { slug: string } | null } = {}) => {
  const { tenant = { slug: TENANT_SLUG } } = options

  const mockFirst = jest.fn().mockResolvedValue(tenant)
  const mockSelect = jest.fn().mockReturnThis()
  const mockWhere = jest.fn().mockReturnThis()

  const tenantsBuilder = {
    where: mockWhere,
    select: mockSelect,
    first: mockFirst,
  }

  const mockInsert = jest.fn().mockResolvedValue([])

  const bookingTokensBuilder = {
    insert: mockInsert,
  }

  const mockKnex = jest.fn().mockImplementation((table: string) => {
    if (table === 'tenants') return tenantsBuilder
    if (table === 'booking_tokens') return bookingTokensBuilder
    throw new Error(`Tabela inesperada no mock: ${table}`)
  })

  return { mockKnex, mockFirst, mockSelect, mockWhere, mockInsert }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BookingService — generateToken', () => {
  let service: BookingService

  afterEach(() => {
    jest.clearAllMocks()
  })

  const buildService = async (mockKnex: jest.Mock) => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: KNEX, useValue: mockKnex },
      ],
    }).compile()

    return moduleRef.get<BookingService>(BookingService)
  }

  // -------------------------------------------------------------------------
  // CT-71-01: Happy path — token gerado com formato e expiração corretos
  // -------------------------------------------------------------------------

  it('CT-71-01: should return a 64-char hex token, expiresAt ~24h ahead, and correct bookingUrl', async () => {
    const { mockKnex } = createMockKnex()
    service = await buildService(mockKnex)

    const before = Date.now()
    const result = await service.generateToken(TENANT_ID)
    const after = Date.now()

    // Token deve ser string hexadecimal de 64 chars
    expect(result.token).toHaveLength(64)
    expect(result.token).toMatch(/^[0-9a-f]{64}$/)

    // expiresAt deve ser aproximadamente 24h no futuro (±5s de tolerância)
    const expectedExpiry = before + 24 * 60 * 60 * 1000
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 5000)
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 5000)

    // bookingUrl deve conter o slug e o token
    expect(result.bookingUrl).toBe(
      `http://localhost:5173/book/${TENANT_SLUG}?token=${result.token}`,
    )
  })

  // -------------------------------------------------------------------------
  // CT-71-02: Token vinculado ao phone — phone passado → persistido no insert
  // -------------------------------------------------------------------------

  it('CT-71-02: should persist phone in booking_tokens when phone is provided', async () => {
    const { mockKnex, mockInsert } = createMockKnex()
    service = await buildService(mockKnex)

    const result = await service.generateToken(TENANT_ID, PHONE)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        token: result.token,
        phone: PHONE,
        used: false,
      }),
    )
  })

  // -------------------------------------------------------------------------
  // CT-71-03: Token sem phone — phone=undefined → insert com phone=null
  // -------------------------------------------------------------------------

  it('CT-71-03: should persist phone as null when phone is not provided', async () => {
    const { mockKnex, mockInsert } = createMockKnex()
    service = await buildService(mockKnex)

    const result = await service.generateToken(TENANT_ID)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        token: result.token,
        phone: null,
        used: false,
      }),
    )
  })

  // -------------------------------------------------------------------------
  // CT-71-04: Isolamento de tenant — tenant_id no insert corresponde ao tenantId chamado
  // -------------------------------------------------------------------------

  it('CT-71-04: should use the correct tenantId in the booking_tokens insert', async () => {
    const OTHER_TENANT_ID = 'tenant-uuid-2'
    const { mockKnex, mockInsert } = createMockKnex({ tenant: { slug: 'dr-costa' } })
    service = await buildService(mockKnex)

    await service.generateToken(OTHER_TENANT_ID, PHONE)

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.tenant_id).toBe(OTHER_TENANT_ID)
    // Garantia de isolamento: nunca confundir tenant IDs
    expect(insertCall.tenant_id).not.toBe(TENANT_ID)
  })

  it('CT-71-04b: should query tenants with the correct tenantId for slug lookup', async () => {
    const { mockKnex, mockWhere } = createMockKnex()
    service = await buildService(mockKnex)

    await service.generateToken(TENANT_ID)

    expect(mockWhere).toHaveBeenCalledWith({ id: TENANT_ID })
  })

  // -------------------------------------------------------------------------
  // CT-71-05: Tenant não encontrado → NotFoundException
  // -------------------------------------------------------------------------

  it('CT-71-05: should throw NotFoundException when tenant does not exist', async () => {
    const { mockKnex } = createMockKnex({ tenant: null })
    service = await buildService(mockKnex)

    await expect(service.generateToken('non-existent-tenant-id')).rejects.toThrow(NotFoundException)
  })

  it('CT-71-05b: should throw with correct Portuguese message when tenant not found', async () => {
    const { mockKnex } = createMockKnex({ tenant: null })
    service = await buildService(mockKnex)

    await expect(service.generateToken('non-existent-tenant-id')).rejects.toThrow(
      'Tenant não encontrado',
    )
  })

  it('CT-71-05c: should not call booking_tokens insert when tenant is not found', async () => {
    const { mockKnex, mockInsert } = createMockKnex({ tenant: null })
    service = await buildService(mockKnex)

    await expect(service.generateToken('non-existent-tenant-id')).rejects.toThrow(NotFoundException)

    expect(mockInsert).not.toHaveBeenCalled()
  })
})
