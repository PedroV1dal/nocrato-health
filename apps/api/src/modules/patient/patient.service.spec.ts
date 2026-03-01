/**
 * US-4.1 — Listagem paginada de pacientes (PatientService)
 * US-4.2 — Perfil completo do paciente (PatientService)
 *
 * Estratégia de mock:
 *  - KNEX: mock via Symbol token, simulando o query builder encadeável do Knex
 *  - @/config/env: mock de módulo para evitar process.exit(1) na ausência de .env
 *  - Knex.count() retorna string do PostgreSQL — verificamos que o service converte com Number()
 *  - cpf e portal_access_code NÃO devem aparecer na resposta (campos sensíveis)
 *  - US-4.2: mockKnex como jest.fn() que diferencia por tabela via mockImplementation
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
import { PatientService } from './patient.service'
import { KNEX } from '@/database/knex.provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1'

const makePatient = (overrides: Record<string, unknown> = {}) => ({
  id: 'patient-uuid-1',
  name: 'Maria Silva',
  phone: '11999990000',
  email: 'maria@example.com',
  source: 'manual',
  status: 'active',
  created_at: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
})

// ---------------------------------------------------------------------------
// Mock Knex encadeável
// ---------------------------------------------------------------------------

// Cada teste pode sobrescrever os valores retornados pelos mocks de terminal
// chamando mockResolvedValue() dentro do bloco it().
const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  clone: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue({ count: '3' }),
}

const mockKnex = jest.fn().mockReturnValue(mockQueryBuilder)

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PatientService', () => {
  let service: PatientService

  beforeEach(async () => {
    // Limpar mocks entre testes para evitar contaminação de estado
    jest.clearAllMocks()

    // Restaurar comportamentos padrão após clearAllMocks
    mockQueryBuilder.where.mockReturnThis()
    mockQueryBuilder.andWhere.mockReturnThis()
    mockQueryBuilder.clone.mockReturnThis()
    mockQueryBuilder.count.mockReturnThis()
    mockQueryBuilder.select.mockReturnThis()
    mockQueryBuilder.limit.mockReturnThis()
    mockQueryBuilder.offset.mockReturnThis()
    mockQueryBuilder.orderBy.mockReturnThis()
    mockQueryBuilder.first.mockResolvedValue({ count: '3' })
    // offset é terminal — retorna os dados
    mockQueryBuilder.offset.mockResolvedValue([makePatient()])
    mockKnex.mockReturnValue(mockQueryBuilder)

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PatientService,
        { provide: KNEX, useValue: mockKnex },
      ],
    }).compile()

    service = moduleRef.get<PatientService>(PatientService)
  })

  // -------------------------------------------------------------------------
  // Listagem sem filtros
  // -------------------------------------------------------------------------

  describe('listPatients — sem filtros', () => {
    it('should return paginated list with default pagination', async () => {
      const patients = [makePatient(), makePatient({ id: 'patient-uuid-2', name: 'João Costa' })]
      mockQueryBuilder.first.mockResolvedValue({ count: '2' })
      mockQueryBuilder.offset.mockResolvedValue(patients)

      const result = await service.listPatients(TENANT_ID, { page: 1, limit: 20 })

      expect(result.data).toEqual(patients)
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      })
    })

    it('should scope query to tenant_id', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20 })

      expect(mockKnex).toHaveBeenCalledWith('patients')
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ tenant_id: TENANT_ID })
    })

    it('should not call andWhere when no search or status filter provided', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20 })

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Busca por nome
  // -------------------------------------------------------------------------

  describe('listPatients — busca por nome (ilike)', () => {
    it('should apply andWhere with ilike on name when search is provided', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20, search: 'Maria' })

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(1)
      // andWhere recebe uma função de callback — verificamos que foi chamado
      const [callbackArg] = mockQueryBuilder.andWhere.mock.calls[0]
      expect(typeof callbackArg).toBe('function')
    })

    it('should use ilike pattern with wildcards for search', async () => {
      // Captura o callback passado ao andWhere para inspecionar as sub-queries
      const mockQb = {
        whereILike: jest.fn().mockReturnThis(),
        orWhereILike: jest.fn().mockReturnThis(),
      }
      mockQueryBuilder.andWhere.mockImplementation((cb: (qb: typeof mockQb) => void) => {
        cb(mockQb)
        return mockQueryBuilder
      })
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20, search: 'Maria' })

      expect(mockQb.whereILike).toHaveBeenCalledWith('name', '%Maria%')
      expect(mockQb.orWhereILike).toHaveBeenCalledWith('phone', '%Maria%')
    })
  })

  // -------------------------------------------------------------------------
  // Busca por telefone
  // -------------------------------------------------------------------------

  describe('listPatients — busca por telefone (ilike)', () => {
    it('should search phone using ilike with wildcards', async () => {
      const mockQb = {
        whereILike: jest.fn().mockReturnThis(),
        orWhereILike: jest.fn().mockReturnThis(),
      }
      mockQueryBuilder.andWhere.mockImplementation((cb: (qb: typeof mockQb) => void) => {
        cb(mockQb)
        return mockQueryBuilder
      })
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20, search: '11999' })

      expect(mockQb.orWhereILike).toHaveBeenCalledWith('phone', '%11999%')
    })
  })

  // -------------------------------------------------------------------------
  // Sanitização de caracteres especiais no search
  // -------------------------------------------------------------------------

  describe('listPatients — sanitização de search', () => {
    it('should escape % in search to prevent wildcard bypass', async () => {
      const mockQb = {
        whereILike: jest.fn().mockReturnThis(),
        orWhereILike: jest.fn().mockReturnThis(),
      }
      mockQueryBuilder.andWhere.mockImplementation((cb: (qb: typeof mockQb) => void) => {
        cb(mockQb)
        return mockQueryBuilder
      })
      mockQueryBuilder.first.mockResolvedValue({ count: '0' })
      mockQueryBuilder.offset.mockResolvedValue([])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20, search: '%' })

      expect(mockQb.whereILike).toHaveBeenCalledWith('name', String.raw`%\%%`)
      expect(mockQb.orWhereILike).toHaveBeenCalledWith('phone', String.raw`%\%%`)
    })

    it('should escape _ in search to prevent single-char wildcard', async () => {
      const mockQb = {
        whereILike: jest.fn().mockReturnThis(),
        orWhereILike: jest.fn().mockReturnThis(),
      }
      mockQueryBuilder.andWhere.mockImplementation((cb: (qb: typeof mockQb) => void) => {
        cb(mockQb)
        return mockQueryBuilder
      })
      mockQueryBuilder.first.mockResolvedValue({ count: '0' })
      mockQueryBuilder.offset.mockResolvedValue([])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20, search: 'Maria_Silva' })

      expect(mockQb.whereILike).toHaveBeenCalledWith('name', String.raw`%Maria\_Silva%`)
    })
  })

  // -------------------------------------------------------------------------
  // Filtro por status
  // -------------------------------------------------------------------------

  describe('listPatients — filtro por status active', () => {
    it('should apply andWhere status filter when status=active', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient({ status: 'active' })])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20, status: 'active' })

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith({ status: 'active' })
    })
  })

  describe('listPatients — filtro por status inactive', () => {
    it('should apply andWhere status filter when status=inactive', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient({ status: 'inactive' })])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20, status: 'inactive' })

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith({ status: 'inactive' })
    })
  })

  // -------------------------------------------------------------------------
  // Busca + filtro combinados
  // -------------------------------------------------------------------------

  describe('listPatients — busca + filtro combinados', () => {
    it('should apply both search and status filters together', async () => {
      const mockQb = {
        whereILike: jest.fn().mockReturnThis(),
        orWhereILike: jest.fn().mockReturnThis(),
      }
      mockQueryBuilder.andWhere.mockImplementation((arg: unknown) => {
        if (typeof arg === 'function') {
          ;(arg as (qb: typeof mockQb) => void)(mockQb)
        }
        return mockQueryBuilder
      })
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, {
        page: 1,
        limit: 20,
        search: 'Maria',
        status: 'active',
      })

      // andWhere deve ter sido chamado 2 vezes: uma para search, uma para status
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2)
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith({ status: 'active' })
      expect(mockQb.whereILike).toHaveBeenCalledWith('name', '%Maria%')
    })
  })

  // -------------------------------------------------------------------------
  // Paginação — página 2
  // -------------------------------------------------------------------------

  describe('listPatients — página 2', () => {
    it('should calculate correct offset for page 2', async () => {
      const page = 2
      const limit = 10
      const expectedOffset = (page - 1) * limit // 10

      mockQueryBuilder.first.mockResolvedValue({ count: '25' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page, limit })

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10)
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(expectedOffset)
    })

    it('should return correct pagination metadata for page 2 with 25 total', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '25' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      const result = await service.listPatients(TENANT_ID, { page: 2, limit: 10 })

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      })
    })
  })

  // -------------------------------------------------------------------------
  // Lista vazia
  // -------------------------------------------------------------------------

  describe('listPatients — lista vazia', () => {
    it('should return empty data array and total 0 when no patients found', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '0' })
      mockQueryBuilder.offset.mockResolvedValue([])

      const result = await service.listPatients(TENANT_ID, { page: 1, limit: 20 })

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
    })

    it('should handle null countResult gracefully', async () => {
      mockQueryBuilder.first.mockResolvedValue(null)
      mockQueryBuilder.offset.mockResolvedValue([])

      const result = await service.listPatients(TENANT_ID, { page: 1, limit: 20 })

      expect(result.pagination.total).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Segurança — campos sensíveis não expostos
  // -------------------------------------------------------------------------

  describe('listPatients — campos sensíveis', () => {
    it('should select only public fields — portal_access_code must not be selected', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20 })

      // Verificar que select foi chamado com os campos corretos
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'id',
        'name',
        'phone',
        'email',
        'source',
        'status',
        'created_at',
      ])
    })

    it('should NOT include portal_access_code in selected fields', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20 })

      const selectCall = mockQueryBuilder.select.mock.calls[0][0] as string[]
      expect(selectCall).not.toContain('portal_access_code')
    })

    it('should NOT include cpf in selected fields', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20 })

      const selectCall = mockQueryBuilder.select.mock.calls[0][0] as string[]
      expect(selectCall).not.toContain('cpf')
    })
  })

  // -------------------------------------------------------------------------
  // Ordenação
  // -------------------------------------------------------------------------

  describe('listPatients — ordenação', () => {
    it('should order by created_at descending', async () => {
      mockQueryBuilder.first.mockResolvedValue({ count: '1' })
      mockQueryBuilder.offset.mockResolvedValue([makePatient()])

      await service.listPatients(TENANT_ID, { page: 1, limit: 20 })

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc')
    })
  })
})

// =============================================================================
// US-4.2 — getPatientProfile
// =============================================================================

// ---------------------------------------------------------------------------
// Fixtures para US-4.2
// ---------------------------------------------------------------------------

const PATIENT_ID = 'patient-uuid-1'
const OTHER_TENANT_ID = 'other-tenant-uuid'

const makePatientProfile = (overrides: Record<string, unknown> = {}) => ({
  id: PATIENT_ID,
  name: 'Maria Silva',
  phone: '11999990000',
  email: 'maria@example.com',
  source: 'manual',
  status: 'active',
  portal_active: false,
  created_at: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
})

const makeAppointment = (overrides: Record<string, unknown> = {}) => ({
  id: 'appt-uuid-1',
  date_time: new Date('2024-02-10T14:00:00Z'),
  status: 'completed',
  duration_minutes: 60,
  started_at: new Date('2024-02-10T14:05:00Z'),
  completed_at: new Date('2024-02-10T15:00:00Z'),
  ...overrides,
})

const makeClinicalNote = (overrides: Record<string, unknown> = {}) => ({
  id: 'note-uuid-1',
  appointment_id: 'appt-uuid-1',
  content: 'Paciente apresentou melhora.',
  created_at: new Date('2024-02-10T15:10:00Z'),
  ...overrides,
})

const makeDocument = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-uuid-1',
  file_name: 'receita.pdf',
  type: 'prescription',
  file_url: 'https://storage.example.com/receita.pdf',
  mime_type: 'application/pdf',
  created_at: new Date('2024-02-10T15:20:00Z'),
  ...overrides,
})

// ---------------------------------------------------------------------------
// Suite US-4.2
// ---------------------------------------------------------------------------

describe('PatientService — getPatientProfile', () => {
  let service: PatientService

  // Query builder base — reutilizado e reconfigurado por tabela em cada teste
  const makeQueryBuilder = () => ({
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue([]),
    first: jest.fn().mockResolvedValue(null),
  })

  // mockKnex diferencia retornos por tabela via mockImplementation
  let mockKnexProfile: jest.Mock

  beforeEach(async () => {
    jest.clearAllMocks()

    // Por padrão: patient encontrado, listas vazias
    const patientBuilder = makeQueryBuilder()
    patientBuilder.first.mockResolvedValue(makePatientProfile())

    const appointmentsBuilder = makeQueryBuilder()
    appointmentsBuilder.orderBy.mockResolvedValue([])

    const notesBuilder = makeQueryBuilder()
    notesBuilder.orderBy.mockResolvedValue([])

    const documentsBuilder = makeQueryBuilder()
    documentsBuilder.orderBy.mockResolvedValue([])

    mockKnexProfile = jest.fn().mockImplementation((table: string) => {
      if (table === 'patients') return patientBuilder
      if (table === 'appointments') return appointmentsBuilder
      if (table === 'clinical_notes') return notesBuilder
      if (table === 'documents') return documentsBuilder
      return makeQueryBuilder()
    })

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PatientService,
        { provide: KNEX, useValue: mockKnexProfile },
      ],
    }).compile()

    service = moduleRef.get<PatientService>(PatientService)
  })

  // -------------------------------------------------------------------------
  // Perfil completo
  // -------------------------------------------------------------------------

  describe('getPatientProfile — perfil completo', () => {
    it('should return patient profile with appointments, clinicalNotes and documents', async () => {
      const appt = makeAppointment()
      const note = makeClinicalNote()
      const doc = makeDocument()

      const patientBuilder = makeQueryBuilder()
      patientBuilder.first.mockResolvedValue(makePatientProfile())

      const appointmentsBuilder = makeQueryBuilder()
      appointmentsBuilder.orderBy.mockResolvedValue([appt])

      const notesBuilder = makeQueryBuilder()
      notesBuilder.orderBy.mockResolvedValue([note])

      const documentsBuilder = makeQueryBuilder()
      documentsBuilder.orderBy.mockResolvedValue([doc])

      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') return patientBuilder
        if (table === 'appointments') return appointmentsBuilder
        if (table === 'clinical_notes') return notesBuilder
        if (table === 'documents') return documentsBuilder
        return makeQueryBuilder()
      })

      const result = await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      expect(result.patient).toEqual(makePatientProfile())
      expect(result.appointments).toEqual([appt])
      expect(result.clinicalNotes).toEqual([note])
      expect(result.documents).toEqual([doc])
    })

    it('should scope patient query to tenant_id and patient id', async () => {
      const patientBuilder = makeQueryBuilder()
      patientBuilder.first.mockResolvedValue(makePatientProfile())
      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') return patientBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      expect(mockKnexProfile).toHaveBeenCalledWith('patients')
      expect(patientBuilder.where).toHaveBeenCalledWith({
        id: PATIENT_ID,
        tenant_id: 'tenant-uuid-1',
      })
    })
  })

  // -------------------------------------------------------------------------
  // NotFoundException — patient não encontrado
  // -------------------------------------------------------------------------

  describe('getPatientProfile — patient não encontrado', () => {
    it('should throw NotFoundException when patient does not exist', async () => {
      const patientBuilder = makeQueryBuilder()
      patientBuilder.first.mockResolvedValue(null)
      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') return patientBuilder
        return makeQueryBuilder()
      })

      await expect(
        service.getPatientProfile('tenant-uuid-1', PATIENT_ID),
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw NotFoundException with message "Paciente não encontrado"', async () => {
      const patientBuilder = makeQueryBuilder()
      patientBuilder.first.mockResolvedValue(null)
      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') return patientBuilder
        return makeQueryBuilder()
      })

      await expect(
        service.getPatientProfile('tenant-uuid-1', PATIENT_ID),
      ).rejects.toThrow('Paciente não encontrado')
    })
  })

  // -------------------------------------------------------------------------
  // Isolamento de tenant
  // -------------------------------------------------------------------------

  describe('getPatientProfile — isolamento de tenant', () => {
    it('should throw NotFoundException when patient belongs to a different tenant', async () => {
      // Simula patient retornado null porque where({ id, tenant_id: OTHER_TENANT_ID }) não encontra nada
      const patientBuilder = makeQueryBuilder()
      patientBuilder.first.mockResolvedValue(null)
      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') return patientBuilder
        return makeQueryBuilder()
      })

      await expect(
        service.getPatientProfile(OTHER_TENANT_ID, PATIENT_ID),
      ).rejects.toThrow(NotFoundException)
    })

    it('should scope appointments query to tenant_id', async () => {
      const appointmentsBuilder = makeQueryBuilder()
      appointmentsBuilder.orderBy.mockResolvedValue([makeAppointment()])

      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') {
          const b = makeQueryBuilder()
          b.first.mockResolvedValue(makePatientProfile())
          return b
        }
        if (table === 'appointments') return appointmentsBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      expect(appointmentsBuilder.where).toHaveBeenCalledWith({
        tenant_id: 'tenant-uuid-1',
        patient_id: PATIENT_ID,
      })
    })

    it('should scope clinical_notes query to tenant_id', async () => {
      const notesBuilder = makeQueryBuilder()
      notesBuilder.orderBy.mockResolvedValue([makeClinicalNote()])

      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') {
          const b = makeQueryBuilder()
          b.first.mockResolvedValue(makePatientProfile())
          return b
        }
        if (table === 'clinical_notes') return notesBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      expect(notesBuilder.where).toHaveBeenCalledWith({
        tenant_id: 'tenant-uuid-1',
        patient_id: PATIENT_ID,
      })
    })

    it('should scope documents query to tenant_id', async () => {
      const documentsBuilder = makeQueryBuilder()
      documentsBuilder.orderBy.mockResolvedValue([makeDocument()])

      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') {
          const b = makeQueryBuilder()
          b.first.mockResolvedValue(makePatientProfile())
          return b
        }
        if (table === 'documents') return documentsBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      expect(documentsBuilder.where).toHaveBeenCalledWith({
        tenant_id: 'tenant-uuid-1',
        patient_id: PATIENT_ID,
      })
    })
  })

  // -------------------------------------------------------------------------
  // Listas vazias
  // -------------------------------------------------------------------------

  describe('getPatientProfile — listas vazias', () => {
    it('should return empty arrays when patient has no appointments, notes or documents', async () => {
      // Defaults do beforeEach: listas vazias, patient encontrado
      const result = await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      expect(result.appointments).toEqual([])
      expect(result.clinicalNotes).toEqual([])
      expect(result.documents).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // Ordenação
  // -------------------------------------------------------------------------

  describe('getPatientProfile — ordenação', () => {
    it('should order appointments by date_time DESC', async () => {
      const appointmentsBuilder = makeQueryBuilder()
      appointmentsBuilder.orderBy.mockResolvedValue([])

      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') {
          const b = makeQueryBuilder()
          b.first.mockResolvedValue(makePatientProfile())
          return b
        }
        if (table === 'appointments') return appointmentsBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      expect(appointmentsBuilder.orderBy).toHaveBeenCalledWith('date_time', 'desc')
    })

    it('should order clinical_notes by created_at DESC', async () => {
      const notesBuilder = makeQueryBuilder()
      notesBuilder.orderBy.mockResolvedValue([])

      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') {
          const b = makeQueryBuilder()
          b.first.mockResolvedValue(makePatientProfile())
          return b
        }
        if (table === 'clinical_notes') return notesBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      expect(notesBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc')
    })

    it('should order documents by created_at DESC', async () => {
      const documentsBuilder = makeQueryBuilder()
      documentsBuilder.orderBy.mockResolvedValue([])

      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') {
          const b = makeQueryBuilder()
          b.first.mockResolvedValue(makePatientProfile())
          return b
        }
        if (table === 'documents') return documentsBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      expect(documentsBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc')
    })
  })

  // -------------------------------------------------------------------------
  // Campos sensíveis
  // -------------------------------------------------------------------------

  describe('getPatientProfile — campos sensíveis', () => {
    it('should NOT include cpf in patient profile fields', async () => {
      const patientBuilder = makeQueryBuilder()
      patientBuilder.first.mockResolvedValue(makePatientProfile())
      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') return patientBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      const selectCall = patientBuilder.select.mock.calls[0][0] as string[]
      expect(selectCall).not.toContain('cpf')
    })

    it('should NOT include portal_access_code in patient profile fields', async () => {
      const patientBuilder = makeQueryBuilder()
      patientBuilder.first.mockResolvedValue(makePatientProfile())
      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') return patientBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      const selectCall = patientBuilder.select.mock.calls[0][0] as string[]
      expect(selectCall).not.toContain('portal_access_code')
    })

    it('should include portal_active in patient profile fields', async () => {
      const patientBuilder = makeQueryBuilder()
      patientBuilder.first.mockResolvedValue(makePatientProfile())
      mockKnexProfile.mockImplementation((table: string) => {
        if (table === 'patients') return patientBuilder
        return makeQueryBuilder()
      })

      await service.getPatientProfile('tenant-uuid-1', PATIENT_ID)

      const selectCall = patientBuilder.select.mock.calls[0][0] as string[]
      expect(selectCall).toContain('portal_active')
    })
  })
})
