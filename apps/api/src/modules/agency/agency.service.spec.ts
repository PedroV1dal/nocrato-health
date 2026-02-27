/**
 * US-2.1 — Dashboard da agência (getDashboardStats)
 *
 * Estratégia de mock:
 *  - KNEX: mock via Symbol token, simulando o query builder encadeável do Knex
 *  - @/config/env: mock de módulo para evitar process.exit(1) na ausência de .env
 *  - Knex.count() retorna string do PostgreSQL — verificamos que o service converte com Number()
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
import { AgencyService } from './agency.service'
import { KNEX } from '@/database/knex.provider'

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

interface MockCountBuilder {
  where: jest.Mock
  whereIn: jest.Mock
  count: jest.Mock
}

// ---------------------------------------------------------------------------
// Tipos auxiliares do Knex mock
// ---------------------------------------------------------------------------

type KnexMockFn = jest.Mock & { fn: { now: jest.Mock } }

// ---------------------------------------------------------------------------
// Factories de mock do Knex
// ---------------------------------------------------------------------------

/**
 * Constrói um builder encadeável para queries de COUNT.
 * where() e whereIn() retornam this; count() retorna uma Promise com [{count: string}].
 */
function buildCountBuilder(countValue: string): MockCountBuilder {
  const builder: MockCountBuilder = {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: countValue }]),
  }
  return builder
}

/**
 * Constrói o mock do Knex para getDashboardStats.
 *
 * Ordem de chamadas ao knex() em getDashboardStats:
 *  1. knex('doctors').count('id as count')                                    → totalDoctors
 *  2. knex('doctors').where({ status: 'active' }).count('id as count')        → activeDoctors
 *  3. knex('patients').count('id as count')                                   → totalPatients
 *  4. knex('appointments').count('id as count')                               → totalAppointments
 *  5. knex('appointments').where(...).whereIn(...).count('id as count')       → upcomingAppointments
 */
function buildDashboardKnex({
  totalDoctors = '5',
  activeDoctors = '3',
  totalPatients = '120',
  totalAppointments = '450',
  upcomingAppointments = '12',
} = {}) {
  const totalDoctorsBuilder = buildCountBuilder(totalDoctors)
  const activeDoctorsBuilder = buildCountBuilder(activeDoctors)
  const totalPatientsBuilder = buildCountBuilder(totalPatients)
  const totalAppointmentsBuilder = buildCountBuilder(totalAppointments)
  const upcomingAppointmentsBuilder = buildCountBuilder(upcomingAppointments)

  const mockKnexFn = (
    jest.fn()
      .mockReturnValueOnce(totalDoctorsBuilder)         // call 1: doctors (total)
      .mockReturnValueOnce(activeDoctorsBuilder)        // call 2: doctors (active)
      .mockReturnValueOnce(totalPatientsBuilder)        // call 3: patients (total)
      .mockReturnValueOnce(totalAppointmentsBuilder)    // call 4: appointments (total)
      .mockReturnValueOnce(upcomingAppointmentsBuilder) // call 5: appointments (upcoming)
  ) as KnexMockFn

  mockKnexFn.fn = { now: jest.fn().mockReturnValue('NOW()') }

  return {
    mockKnexFn,
    totalDoctorsBuilder,
    activeDoctorsBuilder,
    totalPatientsBuilder,
    totalAppointmentsBuilder,
    upcomingAppointmentsBuilder,
  }
}

// ---------------------------------------------------------------------------
// Helper para criar o módulo de testes
// ---------------------------------------------------------------------------

async function buildModule(knexFn: KnexMockFn): Promise<AgencyService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AgencyService,
      { provide: KNEX, useValue: knexFn },
    ],
  }).compile()

  return module.get<AgencyService>(AgencyService)
}

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

describe('AgencyService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ==========================================================================
  // US-2.1 — getDashboardStats
  // ==========================================================================

  describe('getDashboardStats', () => {
    // ------------------------------------------------------------------------
    // Happy path — estrutura de retorno
    // ------------------------------------------------------------------------

    describe('Happy path', () => {
      it('retorna objeto com exatamente 5 campos numéricos', async () => {
        const { mockKnexFn } = buildDashboardKnex({
          totalDoctors: '5',
          activeDoctors: '3',
          totalPatients: '120',
          totalAppointments: '450',
          upcomingAppointments: '12',
        })

        const service = await buildModule(mockKnexFn)
        const result = await service.getDashboardStats()

        expect(Object.keys(result).sort()).toEqual([
          'activeDoctors',
          'totalAppointments',
          'totalDoctors',
          'totalPatients',
          'upcomingAppointments',
        ])
      })

      it('retorna os valores corretos mapeados das contagens do banco', async () => {
        const { mockKnexFn } = buildDashboardKnex({
          totalDoctors: '5',
          activeDoctors: '3',
          totalPatients: '120',
          totalAppointments: '450',
          upcomingAppointments: '12',
        })

        const service = await buildModule(mockKnexFn)
        const result = await service.getDashboardStats()

        expect(result).toEqual({
          totalDoctors: 5,
          activeDoctors: 3,
          totalPatients: 120,
          totalAppointments: 450,
          upcomingAppointments: 12,
        })
      })

      it('todos os valores retornados são do tipo Number (não string)', async () => {
        const { mockKnexFn } = buildDashboardKnex({
          totalDoctors: '10',
          activeDoctors: '7',
          totalPatients: '200',
          totalAppointments: '900',
          upcomingAppointments: '25',
        })

        const service = await buildModule(mockKnexFn)
        const result = await service.getDashboardStats()

        expect(typeof result.totalDoctors).toBe('number')
        expect(typeof result.activeDoctors).toBe('number')
        expect(typeof result.totalPatients).toBe('number')
        expect(typeof result.totalAppointments).toBe('number')
        expect(typeof result.upcomingAppointments).toBe('number')
      })

      it('converte string "0" do PostgreSQL para o número 0 quando tabelas estão vazias', async () => {
        const { mockKnexFn } = buildDashboardKnex({
          totalDoctors: '0',
          activeDoctors: '0',
          totalPatients: '0',
          totalAppointments: '0',
          upcomingAppointments: '0',
        })

        const service = await buildModule(mockKnexFn)
        const result = await service.getDashboardStats()

        expect(result.totalDoctors).toBe(0)
        expect(result.activeDoctors).toBe(0)
        expect(result.totalPatients).toBe(0)
        expect(result.totalAppointments).toBe(0)
        expect(result.upcomingAppointments).toBe(0)
        // Garante que são números, não strings
        expect(result.totalDoctors).toStrictEqual(0)
      })
    })

    // ------------------------------------------------------------------------
    // Invariante de negócio: activeDoctors <= totalDoctors
    // ------------------------------------------------------------------------

    describe('Invariante: activeDoctors <= totalDoctors', () => {
      it('activeDoctors é menor que totalDoctors quando há doutores inativos', async () => {
        const { mockKnexFn } = buildDashboardKnex({
          totalDoctors: '10',
          activeDoctors: '7',
          totalPatients: '50',
          totalAppointments: '200',
          upcomingAppointments: '5',
        })

        const service = await buildModule(mockKnexFn)
        const result = await service.getDashboardStats()

        expect(result.activeDoctors).toBeLessThanOrEqual(result.totalDoctors)
      })

      it('activeDoctors pode ser igual a totalDoctors quando todos estão ativos', async () => {
        const { mockKnexFn } = buildDashboardKnex({
          totalDoctors: '5',
          activeDoctors: '5',
          totalPatients: '30',
          totalAppointments: '100',
          upcomingAppointments: '3',
        })

        const service = await buildModule(mockKnexFn)
        const result = await service.getDashboardStats()

        expect(result.activeDoctors).toBe(result.totalDoctors)
      })
    })

    // ------------------------------------------------------------------------
    // Verificação das queries Knex — activeDoctors filtra por status: 'active'
    // ------------------------------------------------------------------------

    describe('Queries Knex', () => {
      it('filtra activeDoctors com where({ status: "active" })', async () => {
        const { mockKnexFn, activeDoctorsBuilder } = buildDashboardKnex()

        const service = await buildModule(mockKnexFn)
        await service.getDashboardStats()

        expect(activeDoctorsBuilder.where).toHaveBeenCalledWith({ status: 'active' })
      })

      it('filtra upcomingAppointments com date_time > NOW() e whereIn status', async () => {
        const { mockKnexFn, upcomingAppointmentsBuilder } = buildDashboardKnex()

        const service = await buildModule(mockKnexFn)
        await service.getDashboardStats()

        expect(upcomingAppointmentsBuilder.where).toHaveBeenCalledWith(
          'date_time',
          '>',
          'NOW()',
        )
        expect(upcomingAppointmentsBuilder.whereIn).toHaveBeenCalledWith('status', [
          'scheduled',
          'waiting',
        ])
      })

      it('faz exatamente 5 chamadas ao knex() (uma por métrica)', async () => {
        const { mockKnexFn } = buildDashboardKnex()

        const service = await buildModule(mockKnexFn)
        await service.getDashboardStats()

        expect(mockKnexFn).toHaveBeenCalledTimes(5)
      })

      it('consulta tabelas corretas na ordem: doctors, doctors, patients, appointments, appointments', async () => {
        const { mockKnexFn } = buildDashboardKnex()

        const service = await buildModule(mockKnexFn)
        await service.getDashboardStats()

        expect(mockKnexFn).toHaveBeenNthCalledWith(1, 'doctors')
        expect(mockKnexFn).toHaveBeenNthCalledWith(2, 'doctors')
        expect(mockKnexFn).toHaveBeenNthCalledWith(3, 'patients')
        expect(mockKnexFn).toHaveBeenNthCalledWith(4, 'appointments')
        expect(mockKnexFn).toHaveBeenNthCalledWith(5, 'appointments')
      })

      it('não aplica filtro de tenant_id em nenhuma das queries (stats globais da agência)', async () => {
        const { mockKnexFn, totalDoctorsBuilder, activeDoctorsBuilder, totalPatientsBuilder, totalAppointmentsBuilder, upcomingAppointmentsBuilder } = buildDashboardKnex()

        const service = await buildModule(mockKnexFn)
        await service.getDashboardStats()

        // totalDoctors não usa where (exceto activeDoctors que filtra por status)
        expect(totalDoctorsBuilder.where).not.toHaveBeenCalled()
        expect(totalPatientsBuilder.where).not.toHaveBeenCalled()
        expect(totalAppointmentsBuilder.where).not.toHaveBeenCalled()

        // Nenhum builder deve receber tenant_id
        for (const builder of [
          activeDoctorsBuilder,
          upcomingAppointmentsBuilder,
        ]) {
          const whereCalls: Array<unknown> = builder.where.mock.calls.flat()
          expect(JSON.stringify(whereCalls)).not.toContain('tenant_id')
        }
      })
    })

    // ------------------------------------------------------------------------
    // upcomingAppointments — filtragem correta por status
    // ------------------------------------------------------------------------

    describe('upcomingAppointments', () => {
      it('retorna 0 quando não há consultas futuras agendadas', async () => {
        const { mockKnexFn } = buildDashboardKnex({
          totalDoctors: '5',
          activeDoctors: '3',
          totalPatients: '120',
          totalAppointments: '450',
          upcomingAppointments: '0',
        })

        const service = await buildModule(mockKnexFn)
        const result = await service.getDashboardStats()

        expect(result.upcomingAppointments).toBe(0)
      })

      it('inclui apenas status "scheduled" e "waiting" no filtro whereIn', async () => {
        const { mockKnexFn, upcomingAppointmentsBuilder } = buildDashboardKnex()

        const service = await buildModule(mockKnexFn)
        await service.getDashboardStats()

        const whereInArgs = upcomingAppointmentsBuilder.whereIn.mock.calls[0]
        expect(whereInArgs[0]).toBe('status')
        expect(whereInArgs[1]).toContain('scheduled')
        expect(whereInArgs[1]).toContain('waiting')
        expect(whereInArgs[1]).not.toContain('completed')
        expect(whereInArgs[1]).not.toContain('cancelled')
        expect(whereInArgs[1]).not.toContain('in_progress')
      })
    })
  })
})
