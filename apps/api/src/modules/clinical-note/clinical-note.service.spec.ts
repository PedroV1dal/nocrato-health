/**
 * US-6.1 — Criar nota clínica (ClinicalNoteService)
 *
 * Estratégia de mock:
 *  - KNEX: mock via Symbol token, simulando o query builder encadeável do Knex
 *  - @/config/env: mock de módulo para evitar process.exit(1) na ausência de .env
 *  - knex.transaction(): mockado para invocar o callback com um mock de `trx` por tabela
 *  - Isolamento de tenant: WHERE { id, tenant_id } sempre aplicado
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
import { NotFoundException } from '@nestjs/common'
import { ClinicalNoteService } from './clinical-note.service'
import { KNEX } from '@/database/knex.provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1'
const PATIENT_ID = 'patient-uuid-1'
const APPOINTMENT_ID = 'appt-uuid-1'
const ACTOR_ID = 'doctor-uuid-1'
const NOTE_ID = 'note-uuid-1'

const makeCreatedNote = (overrides: Record<string, unknown> = {}) => ({
  id: NOTE_ID,
  appointment_id: APPOINTMENT_ID,
  patient_id: PATIENT_ID,
  content: 'Paciente apresentou melhora significativa.',
  created_at: new Date('2026-03-02T10:00:00Z'),
  ...overrides,
})

const DEFAULT_DTO = {
  appointmentId: APPOINTMENT_ID,
  patientId: PATIENT_ID,
  content: 'Paciente apresentou melhora significativa.',
}

// ---------------------------------------------------------------------------
// Mock Knex factory (transaction-based)
// ---------------------------------------------------------------------------

/**
 * Cria um mock de `trx` que roteia chamadas por nome de tabela.
 * Cada tabela tem seu próprio builder com respostas configuráveis.
 */
const createMockTrx = (options: {
  appointment?: { id: string } | null
  patient?: { id: string } | null
  insertedNote?: Record<string, unknown>
}) => {
  const {
    appointment = { id: APPOINTMENT_ID },
    patient = { id: PATIENT_ID },
    insertedNote = makeCreatedNote(),
  } = options

  // Builder para tabela appointments (select .first())
  const appointmentBuilder = {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(appointment),
  }

  // Builder para tabela patients (select .first())
  const patientBuilder = {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(patient),
  }

  // Builder para insert de clinical_notes (insert + returning)
  const mockReturning = jest.fn().mockResolvedValue([insertedNote])
  const noteInsertBuilder = {
    insert: jest.fn().mockReturnThis(),
    returning: mockReturning,
  }

  // Builder para insert de event_log
  const eventLogBuilder = {
    insert: jest.fn().mockResolvedValue([{ id: 'event-uuid-1' }]),
  }

  const trx = jest.fn().mockImplementation((table: string) => {
    if (table === 'appointments') return appointmentBuilder
    if (table === 'patients') return patientBuilder
    if (table === 'clinical_notes') return noteInsertBuilder
    if (table === 'event_log') return eventLogBuilder
    throw new Error(`Tabela inesperada no mock: ${table}`)
  })

  return { trx, appointmentBuilder, patientBuilder, noteInsertBuilder, eventLogBuilder }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ClinicalNoteService — createClinicalNote', () => {
  let service: ClinicalNoteService
  let mockKnex: jest.Mock & { transaction: jest.Mock; fn: { now: jest.Mock } }

  beforeEach(async () => {
    const transactionMock = jest.fn()
    mockKnex = Object.assign(jest.fn(), {
      transaction: transactionMock,
      fn: { now: jest.fn().mockReturnValue('now()') },
    }) as jest.Mock & { transaction: jest.Mock; fn: { now: jest.Mock } }

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalNoteService,
        { provide: KNEX, useValue: mockKnex },
      ],
    }).compile()

    service = moduleRef.get<ClinicalNoteService>(ClinicalNoteService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // CT-61-01: Happy path — nota criada com sucesso
  // -------------------------------------------------------------------------

  it('CT-61-01: should create and return the clinical note on success', async () => {
    const { trx } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    const result = await service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO)

    expect(result).toMatchObject({
      id: NOTE_ID,
      appointment_id: APPOINTMENT_ID,
      patient_id: PATIENT_ID,
      content: DEFAULT_DTO.content,
    })
  })

  it('CT-61-01b: should insert clinical note with correct fields', async () => {
    const { trx, noteInsertBuilder } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO)

    expect(noteInsertBuilder.insert).toHaveBeenCalledWith({
      tenant_id: TENANT_ID,
      appointment_id: APPOINTMENT_ID,
      patient_id: PATIENT_ID,
      content: DEFAULT_DTO.content,
    })
  })

  it('CT-61-01c: should validate appointment with tenant isolation', async () => {
    const { trx, appointmentBuilder } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO)

    expect(appointmentBuilder.where).toHaveBeenCalledWith({
      id: APPOINTMENT_ID,
      tenant_id: TENANT_ID,
    })
  })

  it('CT-61-01d: should validate patient with tenant isolation', async () => {
    const { trx, patientBuilder } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO)

    expect(patientBuilder.where).toHaveBeenCalledWith({
      id: PATIENT_ID,
      tenant_id: TENANT_ID,
    })
  })

  // -------------------------------------------------------------------------
  // CT-61-02: Appointment não encontrado → 404
  // -------------------------------------------------------------------------

  it('CT-61-02: should throw NotFoundException when appointment does not exist in tenant', async () => {
    const { trx } = createMockTrx({ appointment: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await expect(
      service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO),
    ).rejects.toThrow(NotFoundException)
  })

  it('CT-61-02b: should throw with correct message when appointment not found', async () => {
    const { trx } = createMockTrx({ appointment: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await expect(
      service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO),
    ).rejects.toThrow('Consulta não encontrada')
  })

  // -------------------------------------------------------------------------
  // CT-61-03: Paciente não encontrado → 404
  // -------------------------------------------------------------------------

  it('CT-61-03: should throw NotFoundException when patient does not exist in tenant', async () => {
    const { trx } = createMockTrx({ patient: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await expect(
      service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO),
    ).rejects.toThrow(NotFoundException)
  })

  it('CT-61-03b: should throw with correct message when patient not found', async () => {
    const { trx } = createMockTrx({ patient: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await expect(
      service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO),
    ).rejects.toThrow('Paciente não encontrado')
  })

  // -------------------------------------------------------------------------
  // CT-61-04: Event log inserido corretamente no happy path
  // -------------------------------------------------------------------------

  it('CT-61-04: should insert event_log with correct fields on success', async () => {
    const { trx, eventLogBuilder } = createMockTrx({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO)

    expect(eventLogBuilder.insert).toHaveBeenCalledWith({
      tenant_id: TENANT_ID,
      event_type: 'note.created',
      actor_type: 'doctor',
      actor_id: ACTOR_ID,
      payload: {
        noteId: NOTE_ID,
        appointmentId: APPOINTMENT_ID,
        patientId: PATIENT_ID,
      },
    })
  })

  it('CT-61-04b: should not insert event_log when appointment is not found', async () => {
    const { trx, eventLogBuilder } = createMockTrx({ appointment: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await expect(
      service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO),
    ).rejects.toThrow(NotFoundException)

    expect(eventLogBuilder.insert).not.toHaveBeenCalled()
  })

  it('CT-61-04c: should not insert event_log when patient is not found', async () => {
    const { trx, eventLogBuilder } = createMockTrx({ patient: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKnex.transaction.mockImplementation((cb: (t: any) => unknown) => cb(trx))

    await expect(
      service.createClinicalNote(TENANT_ID, ACTOR_ID, DEFAULT_DTO),
    ).rejects.toThrow(NotFoundException)

    expect(eventLogBuilder.insert).not.toHaveBeenCalled()
  })
})
