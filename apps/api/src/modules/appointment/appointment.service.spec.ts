/**
 * US-5.1 — Listagem paginada de consultas com filtros (AppointmentService)
 *
 * Estratégia de mock:
 *  - KNEX: mock via Symbol token, simulando o query builder encadeável do Knex
 *  - @/config/env: mock de módulo para evitar process.exit(1) na ausência de .env
 *  - Knex.count() retorna string do PostgreSQL — verificamos que o service converte com Number()
 *  - Filtros opcionais: testados individualmente e em combinação
 *  - Isolamento de tenant: WHERE tenant_id é sempre aplicado
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
  },
}))

import { Test, TestingModule } from '@nestjs/testing'
import { AppointmentService } from './appointment.service'
import { KNEX } from '@/database/knex.provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1'
const PATIENT_ID = 'patient-uuid-1'
const APPOINTMENT_ID = 'appt-uuid-1'

const makeAppointment = (overrides: Record<string, unknown> = {}) => ({
  id: APPOINTMENT_ID,
  tenant_id: TENANT_ID,
  patient_id: PATIENT_ID,
  date_time: new Date('2026-03-10T14:00:00Z'),
  duration_minutes: 30,
  status: 'scheduled',
  cancellation_reason: null,
  rescheduled_to_id: null,
  created_by: 'doctor',
  started_at: null,
  completed_at: null,
  created_at: new Date('2026-03-01T09:00:00Z'),
  ...overrides,
})

// ---------------------------------------------------------------------------
// Mock Knex factory
// ---------------------------------------------------------------------------

/**
 * Cria um mock do Knex builder encadeável.
 * - Métodos intermediários (where, andWhere, andWhereBetween, clone, select, orderBy, limit, offset):
 *   retornam `this` para suportar encadeamento
 * - Terminais (count + first, data select): resolvem valores via mockResolvedValue
 */
const createMockBuilder = (
  countResult: { count: string },
  dataResult: ReturnType<typeof makeAppointment>[],
) => {
  // Builder compartilhado entre clone original e clone de count
  const builder: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    andWhereBetween: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue(dataResult),
    count: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(countResult),
    clone: jest.fn(),
  }

  // clone() retorna o mesmo builder (os terminais são independentes por Promise)
  builder.clone.mockReturnValue(builder)

  return builder
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AppointmentService', () => {
  let service: AppointmentService
  let mockKnex: jest.Mock

  beforeEach(async () => {
    mockKnex = jest.fn()

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: KNEX, useValue: mockKnex },
      ],
    }).compile()

    service = moduleRef.get<AppointmentService>(AppointmentService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Listagem sem filtros
  // -------------------------------------------------------------------------

  describe('listAppointments — sem filtros', () => {
    it('should return paginated appointments for the tenant', async () => {
      const appointments = [makeAppointment()]
      const builder = createMockBuilder({ count: '1' }, appointments)
      mockKnex.mockReturnValue(builder)

      const result = await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      expect(result.data).toEqual(appointments)
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      })
    })

    it('should always apply WHERE tenant_id for isolation', async () => {
      const builder = createMockBuilder({ count: '0' }, [])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      expect(builder.where).toHaveBeenCalledWith({ tenant_id: TENANT_ID })
    })

    it('should call listAppointments with appointments table', async () => {
      const builder = createMockBuilder({ count: '0' }, [])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      expect(mockKnex).toHaveBeenCalledWith('appointments')
    })

    it('should return empty list when no appointments exist', async () => {
      const builder = createMockBuilder({ count: '0' }, [])
      mockKnex.mockReturnValue(builder)

      const result = await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
    })

    it('should convert PostgreSQL count string to number', async () => {
      const builder = createMockBuilder({ count: '42' }, [])
      mockKnex.mockReturnValue(builder)

      const result = await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      // count '42' (string do PostgreSQL) deve ser convertido com Number()
      expect(result.pagination.total).toBe(42)
      expect(typeof result.pagination.total).toBe('number')
    })

    it('should order by date_time DESC', async () => {
      const builder = createMockBuilder({ count: '0' }, [])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      expect(builder.orderBy).toHaveBeenCalledWith('date_time', 'desc')
    })
  })

  // -------------------------------------------------------------------------
  // Filtro por status
  // -------------------------------------------------------------------------

  describe('listAppointments — filtro por status', () => {
    it('should apply status filter when provided', async () => {
      const appointments = [makeAppointment({ status: 'scheduled' })]
      const builder = createMockBuilder({ count: '1' }, appointments)
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20, status: 'scheduled' })

      expect(builder.andWhere).toHaveBeenCalledWith({ status: 'scheduled' })
    })

    it('should not apply status filter when omitted', async () => {
      const builder = createMockBuilder({ count: '3' }, [
        makeAppointment({ status: 'scheduled' }),
        makeAppointment({ status: 'completed' }),
        makeAppointment({ status: 'cancelled' }),
      ])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      // andWhere NÃO deve ter sido chamado com status quando o filtro é omitido
      const statusCalls = builder.andWhere.mock.calls.filter(
        (call) => call[0] && typeof call[0] === 'object' && 'status' in call[0],
      )
      expect(statusCalls).toHaveLength(0)
    })

    it('should filter by completed status', async () => {
      const appointments = [makeAppointment({ status: 'completed' })]
      const builder = createMockBuilder({ count: '1' }, appointments)
      mockKnex.mockReturnValue(builder)

      const result = await service.listAppointments(TENANT_ID, { page: 1, limit: 20, status: 'completed' })

      expect(result.data[0].status).toBe('completed')
      expect(builder.andWhere).toHaveBeenCalledWith({ status: 'completed' })
    })

    it('should filter by cancelled status', async () => {
      const builder = createMockBuilder({ count: '0' }, [])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20, status: 'cancelled' })

      expect(builder.andWhere).toHaveBeenCalledWith({ status: 'cancelled' })
    })
  })

  // -------------------------------------------------------------------------
  // Filtro por data
  // -------------------------------------------------------------------------

  describe('listAppointments — filtro por date', () => {
    it('should apply date range filter for the given day in UTC', async () => {
      const appointments = [makeAppointment()]
      const builder = createMockBuilder({ count: '1' }, appointments)
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20, date: '2026-03-10' })

      expect(builder.andWhereBetween).toHaveBeenCalledWith('date_time', [
        '2026-03-10T00:00:00.000Z',
        '2026-03-10T23:59:59.999Z',
      ])
    })

    it('should not apply date filter when date is omitted', async () => {
      const builder = createMockBuilder({ count: '1' }, [makeAppointment()])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      expect(builder.andWhereBetween).not.toHaveBeenCalled()
    })

    it('should correctly compute start and end of day for the given date', async () => {
      const builder = createMockBuilder({ count: '2' }, [makeAppointment(), makeAppointment()])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20, date: '2026-01-15' })

      expect(builder.andWhereBetween).toHaveBeenCalledWith('date_time', [
        '2026-01-15T00:00:00.000Z',
        '2026-01-15T23:59:59.999Z',
      ])
    })
  })

  // -------------------------------------------------------------------------
  // Filtro por patientId
  // -------------------------------------------------------------------------

  describe('listAppointments — filtro por patientId', () => {
    it('should apply patient_id filter when patientId is provided', async () => {
      const appointments = [makeAppointment()]
      const builder = createMockBuilder({ count: '1' }, appointments)
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20, patientId: PATIENT_ID })

      expect(builder.andWhere).toHaveBeenCalledWith({ patient_id: PATIENT_ID })
    })

    it('should not apply patient_id filter when patientId is omitted', async () => {
      const builder = createMockBuilder({ count: '2' }, [makeAppointment(), makeAppointment()])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      const patientCalls = builder.andWhere.mock.calls.filter(
        (call) => call[0] && typeof call[0] === 'object' && 'patient_id' in call[0],
      )
      expect(patientCalls).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // Combinação de filtros
  // -------------------------------------------------------------------------

  describe('listAppointments — combinação de filtros', () => {
    it('should apply all filters simultaneously when all are provided', async () => {
      const appointments = [makeAppointment({ status: 'scheduled' })]
      const builder = createMockBuilder({ count: '1' }, appointments)
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, {
        page: 1,
        limit: 20,
        status: 'scheduled',
        date: '2026-03-10',
        patientId: PATIENT_ID,
      })

      expect(builder.where).toHaveBeenCalledWith({ tenant_id: TENANT_ID })
      expect(builder.andWhere).toHaveBeenCalledWith({ status: 'scheduled' })
      expect(builder.andWhere).toHaveBeenCalledWith({ patient_id: PATIENT_ID })
      expect(builder.andWhereBetween).toHaveBeenCalledWith('date_time', [
        '2026-03-10T00:00:00.000Z',
        '2026-03-10T23:59:59.999Z',
      ])
    })

    it('should apply status + patientId without date', async () => {
      const builder = createMockBuilder({ count: '1' }, [makeAppointment()])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, {
        page: 1,
        limit: 20,
        status: 'in_progress',
        patientId: PATIENT_ID,
      })

      expect(builder.andWhere).toHaveBeenCalledWith({ status: 'in_progress' })
      expect(builder.andWhere).toHaveBeenCalledWith({ patient_id: PATIENT_ID })
      expect(builder.andWhereBetween).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Isolamento de tenant
  // -------------------------------------------------------------------------

  describe('isolamento de tenant', () => {
    it('should always scope queries to the authenticated tenant', async () => {
      const OTHER_TENANT = 'other-tenant-uuid'
      const builder = createMockBuilder({ count: '0' }, [])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(OTHER_TENANT, { page: 1, limit: 20 })

      // WHERE deve ser chamado com o tenant correto
      expect(builder.where).toHaveBeenCalledWith({ tenant_id: OTHER_TENANT })
      // e NÃO com o tenant errado
      expect(builder.where).not.toHaveBeenCalledWith({ tenant_id: TENANT_ID })
    })

    it('should apply tenant filter regardless of other filters', async () => {
      const builder = createMockBuilder({ count: '5' }, [makeAppointment()])
      mockKnex.mockReturnValue(builder)

      await service.listAppointments(TENANT_ID, {
        page: 2,
        limit: 10,
        status: 'waiting',
        patientId: PATIENT_ID,
        date: '2026-03-10',
      })

      // tenant_id sempre presente independente dos outros filtros
      expect(builder.where).toHaveBeenCalledWith({ tenant_id: TENANT_ID })
    })
  })

  // -------------------------------------------------------------------------
  // Paginação
  // -------------------------------------------------------------------------

  describe('paginação', () => {
    it('should calculate correct offset for page 2', async () => {
      const builder = createMockBuilder({ count: '25' }, [makeAppointment()])
      mockKnex.mockReturnValue(builder)

      const result = await service.listAppointments(TENANT_ID, { page: 2, limit: 10 })

      // offset = (2 - 1) * 10 = 10
      expect(builder.offset).toHaveBeenCalledWith(10)
      expect(builder.limit).toHaveBeenCalledWith(10)
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(10)
    })

    it('should calculate totalPages correctly with remainder', async () => {
      const builder = createMockBuilder({ count: '25' }, [makeAppointment()])
      mockKnex.mockReturnValue(builder)

      const result = await service.listAppointments(TENANT_ID, { page: 1, limit: 10 })

      // totalPages = ceil(25 / 10) = 3
      expect(result.pagination.total).toBe(25)
      expect(result.pagination.totalPages).toBe(3)
    })

    it('should calculate totalPages = 0 when total is 0', async () => {
      const builder = createMockBuilder({ count: '0' }, [])
      mockKnex.mockReturnValue(builder)

      const result = await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      expect(result.pagination.totalPages).toBe(0)
    })

    it('should apply default page=1 and limit=20 from DTO defaults', async () => {
      const builder = createMockBuilder({ count: '3' }, [makeAppointment()])
      mockKnex.mockReturnValue(builder)

      const result = await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
      // offset = (1 - 1) * 20 = 0
      expect(builder.offset).toHaveBeenCalledWith(0)
    })

    it('should return correct totalPages for exact division', async () => {
      const builder = createMockBuilder({ count: '40' }, [makeAppointment()])
      mockKnex.mockReturnValue(builder)

      const result = await service.listAppointments(TENANT_ID, { page: 1, limit: 20 })

      // totalPages = ceil(40 / 20) = 2
      expect(result.pagination.totalPages).toBe(2)
    })
  })
})

// ---------------------------------------------------------------------------
// Suite: createAppointment (US-5.2)
// ---------------------------------------------------------------------------

describe('AppointmentService — createAppointment', () => {
  let service: AppointmentService
  // O service usa this.knex.transaction(...) — o mock precisa ter `.transaction` como propriedade
  // typed. Usamos `as jest.Mock & { transaction: jest.Mock }` para satisfazer o TypeScript.
  let mockKnex: jest.Mock & { transaction: jest.Mock }

  // Fixtures
  const TENANT_ID = 'tenant-uuid-1'
  const PATIENT_ID = 'patient-uuid-1'
  const APPOINTMENT_ID = 'appt-uuid-new'
  const DATE_TIME = '2026-03-15T10:00:00.000Z'
  const DURATION = 30

  const makeCreatedAppointment = (overrides: Record<string, unknown> = {}) => ({
    id: APPOINTMENT_ID,
    tenant_id: TENANT_ID,
    patient_id: PATIENT_ID,
    date_time: new Date(DATE_TIME),
    duration_minutes: DURATION,
    status: 'scheduled',
    created_by: 'doctor',
    created_at: new Date('2026-03-01T09:00:00Z'),
    ...overrides,
  })

  /**
   * Cria um mock de `trx` que roteia chamadas por nome de tabela.
   * Cada tabela tem seu próprio builder com respostas configuráveis.
   */
  const createMockTrx = (options: {
    patient?: Record<string, unknown> | null
    doctor?: { appointment_duration: number } | null
    conflict?: { id: string } | null
    insertedAppointment?: Record<string, unknown>
  }) => {
    const {
      patient = { id: PATIENT_ID },
      doctor = { appointment_duration: DURATION },
      conflict = null,
      insertedAppointment = makeCreatedAppointment(),
    } = options

    // Builder para tabela patients (select .first())
    const patientBuilder = {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(patient),
    }

    // Builder para tabela doctors (select .first())
    const doctorBuilder = {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(doctor),
    }

    // Builder para conflito de appointments (chain completa + forUpdate + first)
    const conflictBuilder = {
      where: jest.fn().mockReturnThis(),
      whereNotIn: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      andWhereRaw: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(conflict),
    }

    // Builder para insert de appointment (insert + returning)
    const mockReturning = jest.fn().mockResolvedValue([insertedAppointment])
    const appointmentInsertBuilder = {
      insert: jest.fn().mockReturnThis(),
      returning: mockReturning,
    }

    // Builder para insert de event_log
    const eventLogBuilder = {
      insert: jest.fn().mockResolvedValue([{ id: 'event-uuid-1' }]),
    }

    // Contador para diferenciar a primeira chamada a 'appointments' (conflito)
    // da segunda (insert) dentro da transação
    let appointmentsCallCount = 0

    const trx = jest.fn().mockImplementation((table: string) => {
      if (table === 'patients') return patientBuilder
      if (table === 'doctors') return doctorBuilder
      if (table === 'event_log') return eventLogBuilder
      if (table === 'appointments') {
        appointmentsCallCount++
        // 1ª chamada = query de conflito; 2ª chamada = insert
        return appointmentsCallCount === 1 ? conflictBuilder : appointmentInsertBuilder
      }
      throw new Error(`Tabela inesperada no mock: ${table}`)
    })

    return { trx, patientBuilder, doctorBuilder, conflictBuilder, appointmentInsertBuilder, eventLogBuilder }
  }

  beforeEach(async () => {
    // Cria o mock como objeto com `.transaction` já presente para evitar erro TS2339
    const transactionMock = jest.fn()
    mockKnex = Object.assign(jest.fn(), { transaction: transactionMock }) as jest.Mock & {
      transaction: jest.Mock
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: KNEX, useValue: mockKnex },
      ],
    }).compile()

    service = moduleRef.get<AppointmentService>(AppointmentService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // CT-52-01: Sucesso — retorna 201 com appointment
  // -------------------------------------------------------------------------

  it('CT-52-01: should create and return the appointment on success', async () => {
    const { trx } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: DURATION }
    const result = await service.createAppointment(TENANT_ID, dto)

    expect(result).toMatchObject({
      id: APPOINTMENT_ID,
      tenant_id: TENANT_ID,
      patient_id: PATIENT_ID,
      status: 'scheduled',
      created_by: 'doctor',
      duration_minutes: DURATION,
    })
  })

  it('CT-52-01b: should insert appointment with correct fields', async () => {
    const { trx, appointmentInsertBuilder } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: DURATION }
    await service.createAppointment(TENANT_ID, dto)

    expect(appointmentInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        patient_id: PATIENT_ID,
        date_time: DATE_TIME,
        duration_minutes: DURATION,
        status: 'scheduled',
        created_by: 'doctor',
      }),
    )
  })

  it('CT-52-01c: should insert event_log entry on success', async () => {
    const { trx, eventLogBuilder } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: DURATION }
    await service.createAppointment(TENANT_ID, dto)

    expect(eventLogBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        event_type: 'appointment.created',
        actor_type: 'doctor',
        payload: expect.objectContaining({
          appointment_id: APPOINTMENT_ID,
          patient_id: PATIENT_ID,
          created_by: 'doctor',
        }),
      }),
    )
  })

  // -------------------------------------------------------------------------
  // CT-52-02: 404 se paciente não existe
  // -------------------------------------------------------------------------

  it('CT-52-02: should throw NotFoundException when patient does not exist', async () => {
    const { trx } = createMockTrx({ patient: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: DURATION }

    await expect(service.createAppointment(TENANT_ID, dto)).rejects.toThrow('Paciente não encontrado')
  })

  it('CT-52-02b: should not proceed to insert when patient not found', async () => {
    const { trx, appointmentInsertBuilder } = createMockTrx({ patient: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: DURATION }

    await expect(service.createAppointment(TENANT_ID, dto)).rejects.toThrow()
    expect(appointmentInsertBuilder.insert).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // CT-52-03: 409 se conflito de horário
  // -------------------------------------------------------------------------

  it('CT-52-03: should throw ConflictException when schedule conflict exists', async () => {
    const { trx } = createMockTrx({ conflict: { id: 'existing-appt-uuid' } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: DURATION }

    await expect(service.createAppointment(TENANT_ID, dto)).rejects.toThrow(
      'Conflito de horário: paciente já possui consulta no mesmo período',
    )
  })

  it('CT-52-03b: should not insert appointment when conflict is found', async () => {
    const { trx, appointmentInsertBuilder } = createMockTrx({ conflict: { id: 'existing-appt-uuid' } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: DURATION }

    await expect(service.createAppointment(TENANT_ID, dto)).rejects.toThrow()
    expect(appointmentInsertBuilder.insert).not.toHaveBeenCalled()
  })

  it('CT-52-03c: should query conflict with correct tenant and patient scope', async () => {
    const { trx, conflictBuilder } = createMockTrx({ conflict: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: DURATION }
    await service.createAppointment(TENANT_ID, dto)

    expect(conflictBuilder.where).toHaveBeenCalledWith({
      tenant_id: TENANT_ID,
      patient_id: PATIENT_ID,
    })
    expect(conflictBuilder.whereNotIn).toHaveBeenCalledWith('status', ['cancelled', 'completed'])
  })

  // -------------------------------------------------------------------------
  // CT-52-04: durationMinutes ausente → usa doctor.appointment_duration
  // -------------------------------------------------------------------------

  it('CT-52-04: should use doctor appointment_duration when durationMinutes is not provided', async () => {
    const doctorDuration = 45
    const { trx, doctorBuilder, appointmentInsertBuilder } = createMockTrx({
      doctor: { appointment_duration: doctorDuration },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    // Sem durationMinutes no DTO
    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME }
    await service.createAppointment(TENANT_ID, dto)

    // Deve ter consultado a tabela doctors
    expect(doctorBuilder.where).toHaveBeenCalledWith({ tenant_id: TENANT_ID })
    expect(doctorBuilder.select).toHaveBeenCalledWith('appointment_duration')

    // Deve ter inserido com a duração do doutor
    expect(appointmentInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ duration_minutes: doctorDuration }),
    )
  })

  it('CT-52-04b: should fall back to 30 minutes when doctor has no appointment_duration set', async () => {
    const { trx, appointmentInsertBuilder } = createMockTrx({
      doctor: null,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME }
    await service.createAppointment(TENANT_ID, dto)

    expect(appointmentInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ duration_minutes: 30 }),
    )
  })

  // -------------------------------------------------------------------------
  // CT-52-05: durationMinutes fornecido → usa o fornecido (não consulta doctors)
  // -------------------------------------------------------------------------

  it('CT-52-05: should use provided durationMinutes and skip doctor lookup', async () => {
    const { trx, doctorBuilder, appointmentInsertBuilder } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: 60 }
    await service.createAppointment(TENANT_ID, dto)

    // NÃO deve ter consultado a tabela doctors
    expect(doctorBuilder.where).not.toHaveBeenCalled()

    // Deve ter inserido com o durationMinutes fornecido
    expect(appointmentInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ duration_minutes: 60 }),
    )
  })

  it('CT-52-05b: should isolate tenant in patient lookup', async () => {
    const { trx, patientBuilder } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const dto = { patientId: PATIENT_ID, dateTime: DATE_TIME, durationMinutes: DURATION }
    await service.createAppointment(TENANT_ID, dto)

    expect(patientBuilder.where).toHaveBeenCalledWith({
      id: PATIENT_ID,
      tenant_id: TENANT_ID,
    })
  })
})
