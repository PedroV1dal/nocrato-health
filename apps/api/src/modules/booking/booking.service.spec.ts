/**
 * US-7.1 — Gerar token de booking (BookingService.generateToken)
 *
 * Casos de teste cobertos:
 *  CT-71-01: happy path — token 64 chars hex, expiresAt ~24h no futuro, bookingUrl contém slug e token
 *  CT-71-02: token vinculado ao phone — phone passado → persistido no insert
 *  CT-71-03: token sem phone — phone=undefined → insert com phone=null
 *  CT-71-04: isolamento de tenant — tenant_id no insert corresponde ao tenantId chamado
 *  CT-71-05: tenant não encontrado → NotFoundException com mensagem em português
 *
 * US-7.2 — Validar token + listar slots (BookingService.validateToken, BookingService.getSlots)
 *
 * Casos de teste cobertos:
 *  CT-72-01: validateToken happy path — retorna { valid, doctor, tenant, phone }
 *  CT-72-02: validateToken token expirado → ForbiddenException { valid: false, reason: 'expired' }
 *  CT-72-03: validateToken token já usado → ForbiddenException { valid: false }
 *  CT-72-04: validateToken cross-tenant (token de outro tenant) → ForbiddenException { valid: false }
 *  CT-72-05: getSlots happy path com slot ocupado → slot livre retornado
 *  CT-72-06: getSlots dia sem expediente → { slots: [] }
 *  CT-72-07: getSlots slots passados filtrados quando date=hoje (timezone UTC)
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
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { BookingService } from './booking.service'
import { KNEX } from '@/database/knex.provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1'
const TENANT_SLUG = 'dr-silva'
const PHONE = '+5511999999999'

// ---------------------------------------------------------------------------
// Mock Knex factory (CT-71)
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
// Suite: generateToken (CT-71)
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

// ---------------------------------------------------------------------------
// Helpers de mock para CT-72
// ---------------------------------------------------------------------------

/**
 * Cria um builder Knex encadeável cujo `.first()` ou `.select()` terminal retorna `resolvedValue`.
 * Suporta encadeamento de .where(), .select(), .whereNotIn(), .andWhereBetween(), .raw().
 */
function makeBuilder(resolvedValue: unknown) {
  const builder: Record<string, jest.Mock> = {}
  const chainMethods = ['where', 'select', 'whereNotIn', 'andWhereBetween', 'andWhere']
  for (const m of chainMethods) {
    builder[m] = jest.fn().mockReturnThis()
  }
  // Terminais
  builder['first'] = jest.fn().mockResolvedValue(resolvedValue)
  // Para getSlots → appointments: retorna array diretamente (sem .first())
  builder['then'] = jest.fn()
  return builder
}

/**
 * Cria builder para appointments que retorna array (não usa .first()).
 * O Knex builder com `.select()` usado como Promise retorna o array diretamente.
 */
function makeAppointmentsBuilder(rows: unknown[]) {
  const builder: Record<string, jest.Mock | unknown> = {}
  const chainMethods = ['where', 'select', 'whereNotIn', 'andWhereBetween', 'andWhere']
  for (const m of chainMethods) {
    builder[m] = jest.fn().mockReturnThis()
  }
  // Knex builder é uma Promise — implementar then/catch/finally para await direto
  builder['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve),
  )
  builder['catch'] = jest.fn().mockReturnThis()
  builder['finally'] = jest.fn().mockReturnThis()
  return builder as Record<string, jest.Mock>
}

// ---------------------------------------------------------------------------
// Suite: validateToken (CT-72-01 a CT-72-04)
// ---------------------------------------------------------------------------

describe('BookingService — validateToken', () => {
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

  /** Cria mock Knex para validateToken: tenants → booking_tokens → doctors */
  const buildValidateKnex = (options: {
    tenant?: unknown
    bookingToken?: unknown
    doctor?: unknown
  }) => {
    const {
      tenant = { id: TENANT_ID, name: 'Clínica Silva', primaryColor: '#123456', logoUrl: null },
      bookingToken = {
        token: 'abc123',
        phone: PHONE,
        used: false,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h no futuro
      },
      doctor = { name: 'Dr. Silva', specialty: 'Cardiologia' },
    } = options

    const tenantsBuilder = makeBuilder(tenant)
    const bookingTokensBuilder = makeBuilder(bookingToken)
    const doctorsBuilder = makeBuilder(doctor)

    // knex.raw precisa retornar algo chainável — usamos identidade
    const mockRaw = jest.fn().mockImplementation((sql: string) => sql)

    const mockKnex = jest.fn().mockImplementation((table: string) => {
      if (table === 'tenants') return tenantsBuilder
      if (table === 'booking_tokens') return bookingTokensBuilder
      if (table === 'doctors') return doctorsBuilder
      throw new Error(`Tabela inesperada: ${table}`)
    }) as jest.Mock & { raw: jest.Mock }

    mockKnex.raw = mockRaw

    return { mockKnex, tenantsBuilder, bookingTokensBuilder, doctorsBuilder }
  }

  // -------------------------------------------------------------------------
  // CT-72-01: Happy path
  // -------------------------------------------------------------------------

  it('CT-72-01: should return valid=true with doctor, tenant and phone', async () => {
    const { mockKnex } = buildValidateKnex({})
    service = await buildService(mockKnex)

    const result = await service.validateToken(TENANT_SLUG, 'abc123')

    expect(result.valid).toBe(true)
    expect(result.doctor).toEqual({ name: 'Dr. Silva', specialty: 'Cardiologia' })
    expect(result.tenant).toEqual({
      name: 'Clínica Silva',
      primaryColor: '#123456',
      logoUrl: null,
    })
    expect(result.phone).toBe(PHONE)
  })

  // -------------------------------------------------------------------------
  // CT-72-02: Token expirado → ForbiddenException { valid: false, reason: 'expired' }
  // -------------------------------------------------------------------------

  it('CT-72-02: should throw ForbiddenException with reason=expired when token is expired', async () => {
    const expiredToken = {
      token: 'expired-token',
      phone: PHONE,
      used: false,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h atrás
    }
    const { mockKnex } = buildValidateKnex({ bookingToken: expiredToken })
    service = await buildService(mockKnex)

    await expect(service.validateToken(TENANT_SLUG, 'expired-token')).rejects.toThrow(
      ForbiddenException,
    )

    try {
      await service.validateToken(TENANT_SLUG, 'expired-token')
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toEqual({ valid: false, reason: 'expired' })
    }
  })

  // -------------------------------------------------------------------------
  // CT-72-03: Token já usado → ForbiddenException { valid: false }
  // -------------------------------------------------------------------------

  it('CT-72-03: should throw ForbiddenException when token is already used', async () => {
    const usedToken = {
      token: 'used-token',
      phone: PHONE,
      used: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }
    const { mockKnex } = buildValidateKnex({ bookingToken: usedToken })
    service = await buildService(mockKnex)

    await expect(service.validateToken(TENANT_SLUG, 'used-token')).rejects.toThrow(
      ForbiddenException,
    )

    try {
      await service.validateToken(TENANT_SLUG, 'used-token')
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toEqual({ valid: false })
    }
  })

  // -------------------------------------------------------------------------
  // CT-72-04: Cross-tenant — token de outro tenant → ForbiddenException { valid: false }
  // -------------------------------------------------------------------------

  it('CT-72-04: should throw ForbiddenException when token does not belong to tenant', async () => {
    // booking_tokens query retorna null (cross-tenant: WHERE token=? AND tenant_id=? não bate)
    const { mockKnex } = buildValidateKnex({ bookingToken: null })
    service = await buildService(mockKnex)

    await expect(service.validateToken(TENANT_SLUG, 'other-tenant-token')).rejects.toThrow(
      ForbiddenException,
    )

    try {
      await service.validateToken(TENANT_SLUG, 'other-tenant-token')
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toEqual({ valid: false })
    }
  })
})

// ---------------------------------------------------------------------------
// Suite: getSlots (CT-72-05 a CT-72-07)
// ---------------------------------------------------------------------------

describe('BookingService — getSlots', () => {
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

  /**
   * Cria mock Knex para getSlots:
   *   tenants → booking_tokens → doctors → appointments
   *
   * Estratégia: rotear por tabela. 'appointments' usa builder thenable (array).
   */
  const buildSlotsKnex = (options: {
    tenant?: unknown
    bookingToken?: unknown
    doctor?: unknown
    appointments?: unknown[]
  }) => {
    const {
      tenant = { id: TENANT_ID, name: 'Clínica Silva' },
      bookingToken = {
        used: false,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      doctor = {
        workingHours: {
          monday: [{ start: '08:00', end: '10:00' }],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        },
        appointmentDuration: 60,
        timezone: 'UTC',
      },
      appointments = [],
    } = options

    const tenantsBuilder = makeBuilder(tenant)
    const bookingTokensBuilder = makeBuilder(bookingToken)
    const doctorsBuilder = makeBuilder(doctor)
    const appointmentsBuilder = makeAppointmentsBuilder(appointments)

    const mockRaw = jest.fn().mockImplementation((sql: string) => sql)

    const mockKnex = jest.fn().mockImplementation((table: string) => {
      if (table === 'tenants') return tenantsBuilder
      if (table === 'booking_tokens') return bookingTokensBuilder
      if (table === 'doctors') return doctorsBuilder
      if (table === 'appointments') return appointmentsBuilder
      throw new Error(`Tabela inesperada: ${table}`)
    }) as jest.Mock & { raw: jest.Mock }

    mockKnex.raw = mockRaw

    return { mockKnex, tenantsBuilder, bookingTokensBuilder, doctorsBuilder, appointmentsBuilder }
  }

  // -------------------------------------------------------------------------
  // CT-72-05: Happy path — 1 slot ocupado, 1 livre
  //   Doctor: monday 08:00-10:00, duration 60min → slots: 08:00-09:00, 09:00-10:00
  //   Appointment: 08:00-09:00 (UTC, timezone=UTC) → slot 08:00-09:00 ocupado
  //   Esperado: [{ start: '09:00', end: '10:00' }]
  // -------------------------------------------------------------------------

  it('CT-72-05: should return free slots excluding occupied ones', async () => {
    // monday = 2025-01-06 (uma segunda-feira qualquer)
    const date = '2025-01-06'

    const occupiedAppointment = {
      dateTime: '2025-01-06T08:00:00.000Z',
      durationMinutes: 60,
    }

    const { mockKnex } = buildSlotsKnex({ appointments: [occupiedAppointment] })
    service = await buildService(mockKnex)

    const result = await service.getSlots(TENANT_SLUG, 'valid-token', date)

    expect(result.date).toBe(date)
    expect(result.durationMinutes).toBe(60)
    expect(result.timezone).toBe('UTC')
    // Slot 08:00-09:00 está ocupado, slot 09:00-10:00 está livre
    expect(result.slots).toHaveLength(1)
    expect(result.slots[0]).toEqual({ start: '09:00', end: '10:00' })
  })

  // -------------------------------------------------------------------------
  // CT-72-06: Dia sem expediente → slots: []
  //   tuesday = [] → nenhum slot gerado
  // -------------------------------------------------------------------------

  it('CT-72-06: should return empty slots for a day with no working hours', async () => {
    // tuesday = 2025-01-07
    const date = '2025-01-07'

    const { mockKnex } = buildSlotsKnex({})
    service = await buildService(mockKnex)

    const result = await service.getSlots(TENANT_SLUG, 'valid-token', date)

    expect(result.date).toBe(date)
    expect(result.slots).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // CT-72-07: Slots passados filtrados quando date=hoje (timezone UTC)
  //   Testar com timezone UTC para evitar flakiness.
  //   Doctor: monday 08:00-10:00, duration 60min → 2 slots gerados.
  //   "Hoje" no timezone UTC = data atual.
  //   Mock de "agora" não é necessário: usamos uma data passada qualquer (segunda-feira)
  //   onde todos os slots já passaram — resultado deve ser [].
  //   Data: 2020-01-06 (segunda-feira, passada com certeza) — todos os slots estão no passado.
  // -------------------------------------------------------------------------

  it('CT-72-07: should filter out past slots when date is today in doctor timezone', async () => {
    // Usar a data de HOJE no timezone UTC para ativar o filtro de slots passados.
    // Como são apenas as 00:00+ UTC todos os dias, slots de 08:00-09:00 e 09:00-10:00
    // podem ou não ter passado dependendo do horário de execução.
    // Estratégia mais robusta: usar working_hours com slot que já passou com certeza.
    // Obtemos a data de hoje UTC como string YYYY-MM-DD.
    const todayUTC = new Date().toISOString().slice(0, 10)

    // Configurar working_hours com o dia da semana de hoje e slots às 00:01-00:02 (já passou)
    const dayIndex = new Date().getUTCDay() // 0=sunday...6=saturday
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayDayName = dayNames[dayIndex]

    const workingHours: Record<string, Array<{ start: string; end: string }>> = {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    }
    // Slot 00:01-00:02 — já passou em qualquer hora do dia exceto 00:00
    // Para garantir robustez, usar slot às 00:00-00:30 (certamente passado após meia-noite)
    workingHours[todayDayName] = [{ start: '00:00', end: '00:30' }]

    const doctorToday = {
      workingHours,
      appointmentDuration: 30,
      timezone: 'UTC',
    }

    const { mockKnex } = buildSlotsKnex({ doctor: doctorToday })
    service = await buildService(mockKnex)

    const result = await service.getSlots(TENANT_SLUG, 'valid-token', todayUTC)

    expect(result.date).toBe(todayUTC)
    // Slot 00:00-00:30 deve ter sido filtrado (já passou — são mais de 00:30 UTC agora)
    // Em casos raríssimos (execução exata às 00:00 UTC), o teste pode flaky — aceitável.
    expect(result.slots).toHaveLength(0)
  })
})
