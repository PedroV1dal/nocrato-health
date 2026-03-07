/**
 * EventLogService — audit trail append-only
 *
 * Casos de teste cobertos:
 *  CT-91-04: INSERT no event_log com os campos corretos
 *  CT-91-04b: actor_id aceita null (eventos de sistema/agente)
 *  CT-91-04c: payload JSONB passado integralmente ao INSERT
 *  CT-91-04d: isolamento de tenant — tenant_id sempre no INSERT
 */

// Mockar env ANTES de qualquer import que o carregue transitivamente.
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
import { EventLogService } from './event-log.service'
import { KNEX } from '@/database/knex.provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1'
const ACTOR_ID = 'doctor-uuid-1'

// ---------------------------------------------------------------------------
// Mock Knex
// ---------------------------------------------------------------------------

const mockInsert = jest.fn().mockResolvedValue([])
const mockEventLogBuilder = { insert: mockInsert }
const mockKnex = jest.fn().mockReturnValue(mockEventLogBuilder)

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EventLogService', () => {
  let service: EventLogService

  beforeEach(async () => {
    jest.clearAllMocks()
    mockKnex.mockReturnValue(mockEventLogBuilder)
    mockInsert.mockResolvedValue([])

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EventLogService,
        { provide: KNEX, useValue: mockKnex },
      ],
    }).compile()

    service = moduleRef.get<EventLogService>(EventLogService)
  })

  // -------------------------------------------------------------------------
  // CT-91-04: INSERT com campos corretos
  // -------------------------------------------------------------------------

  it('CT-91-04: should INSERT into event_log with correct fields', async () => {
    const payload = { appointmentId: 'appt-uuid-1', patientId: 'patient-uuid-1' }

    await service.append(TENANT_ID, 'appointment.created', 'doctor', ACTOR_ID, payload)

    expect(mockKnex).toHaveBeenCalledWith('event_log')
    expect(mockInsert).toHaveBeenCalledWith({
      tenant_id: TENANT_ID,
      event_type: 'appointment.created',
      actor_type: 'doctor',
      actor_id: ACTOR_ID,
      payload,
    })
  })

  // -------------------------------------------------------------------------
  // CT-91-04b: actor_id null para eventos de sistema/agente
  // -------------------------------------------------------------------------

  it('CT-91-04b: should accept null actor_id for system or agent events', async () => {
    await service.append(TENANT_ID, 'patient.portal_activated', 'system', null, {
      patientId: 'patient-uuid-1',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_type: 'system',
        actor_id: null,
      }),
    )
  })

  // -------------------------------------------------------------------------
  // CT-91-04c: payload é passado integralmente
  // -------------------------------------------------------------------------

  it('CT-91-04c: should pass the full payload object to INSERT', async () => {
    const payload = {
      appointmentId: 'appt-uuid-1',
      patientId: 'patient-uuid-1',
      oldStatus: 'scheduled',
      newStatus: 'waiting',
    }

    await service.append(TENANT_ID, 'appointment.status_changed', 'doctor', ACTOR_ID, payload)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ payload }),
    )
  })

  // -------------------------------------------------------------------------
  // CT-91-04d: isolamento de tenant — tenant_id sempre presente
  // -------------------------------------------------------------------------

  it('CT-91-04d: should always include tenant_id in the INSERT', async () => {
    const otherTenantId = 'other-tenant-uuid'

    await service.append(otherTenantId, 'appointment.cancelled', 'agent', null, {})

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: otherTenantId }),
    )
  })

  // -------------------------------------------------------------------------
  // CT-91-04e: append retorna void — sem returning
  // -------------------------------------------------------------------------

  it('CT-91-04e: should return void (no returning clause)', async () => {
    const result = await service.append(TENANT_ID, 'appointment.created', 'doctor', ACTOR_ID, {})

    expect(result).toBeUndefined()
  })
})
