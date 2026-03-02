# Appointment Module

## Responsabilidade

Gestão do ciclo de vida de consultas no portal do doutor. Permite listar e filtrar
consultas vinculadas ao tenant do doutor autenticado. A máquina de estados de uma
consulta segue: `scheduled → waiting → in_progress → completed` (com derivações
`cancelled`, `no_show`, `rescheduled`).

## Endpoints expostos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/doctor/appointments` | Listagem paginada com filtros por status, data e paciente |

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `appointment.module.ts` | Registra controller e service; não reimporta DatabaseModule (é `@Global()`) |
| `appointment.controller.ts` | Handlers HTTP; extrai tenantId do JWT via `@TenantId()` |
| `appointment.service.ts` | Queries Knex para listagem paginada com filtros opcionais |
| `dto/list-appointments.dto.ts` | Zod schema para query params de listagem (page, limit, status, date, patientId) |
| `appointment.service.spec.ts` | Testes unitários do AppointmentService — mock manual do Knex |
| `appointment.controller.spec.ts` | Testes unitários do AppointmentController |

## Tabelas envolvidas

- `appointments` — scoped por `tenant_id`

## Campos retornados na listagem (US-5.1)

`id`, `tenant_id`, `patient_id`, `date_time`, `duration_minutes`, `status`,
`cancellation_reason`, `rescheduled_to_id`, `created_by`, `started_at`,
`completed_at`, `created_at`

## Status válidos (`AppointmentStatus`)

`scheduled`, `waiting`, `in_progress`, `completed`, `cancelled`, `no_show`, `rescheduled`

## Regras de negócio

- **Isolamento por tenantId**: toda query usa `WHERE tenant_id = tenantId`. Nunca aceitar tenantId do body.
- **tenantId extraído do JWT** via `@TenantId()` decorator.
- **Filtro por status**: enum dos 7 valores válidos. Se omitido, retorna todos.
- **Filtro por date (YYYY-MM-DD)**: converte para range UTC [início do dia, fim do dia] usando `BETWEEN`.
- **Filtro por patientId**: UUID do paciente. Se omitido, retorna consultas de todos os pacientes.
- **Paginação padrão**: page=1, limit=20 (máx 100). Parâmetros HTTP são strings — usar `z.coerce.number()`.
- **Ordenação**: `date_time DESC` (mais recentes primeiro).
- **count e data em paralelo**: executar `Promise.all([count clone, data clone])` para eficiência.
- **Knex count retorna string do PostgreSQL**: converter com `Number()`.
- **Filtros antes dos terminais**: aplicar `.where()` antes de `limit/offset/count` (mutação in-place do builder).

## Guards obrigatórios

Todos os endpoints deste módulo requerem:

```typescript
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('doctor')
```

## O que NÃO pertence a este módulo

- Auth do doutor (login, refresh, invite) → `modules/auth/`
- Gestão de pacientes → `modules/patient/`
- Notas clínicas → `modules/clinical-note/`
- Documentos → `modules/document/`
- Booking público (geração de tokens) → `modules/booking/`
- Agendamento via WhatsApp → `modules/agent/`
- Mudanças de status de consulta (transições do lifecycle) → futuras US do Epic 5

## Como rodar / testar isoladamente

```bash
pnpm --filter @nocrato/api test -- --testPathPattern=appointment
```
