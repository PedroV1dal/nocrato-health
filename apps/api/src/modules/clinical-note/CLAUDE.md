# Clinical Note Module

## Responsabilidade

Gestão de notas clínicas vinculadas a consultas no portal do doutor. Permite criar notas
clínicas associadas a uma consulta e paciente específicos, com isolamento por tenant.
Notas clínicas são registros internos do médico — nunca expostas ao portal do paciente.

## Endpoints expostos

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/doctor/clinical-notes` | Cria nota clínica vinculada a consulta e paciente |

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `clinical-note.module.ts` | Registra controller e service; não reimporta DatabaseModule (é `@Global()`) |
| `clinical-note.controller.ts` | Handler HTTP POST; extrai tenantId via `@TenantId()`, actorId via `@CurrentUser().sub` |
| `clinical-note.service.ts` | Queries Knex: validação de appointment/patient + insert na transação + event_log |
| `dto/create-clinical-note.dto.ts` | Zod schema para body de criação (appointmentId, patientId, content) |
| `clinical-note.service.spec.ts` | Testes unitários do ClinicalNoteService — mock manual do Knex com transaction |

## Tabelas envolvidas

- `clinical_notes` — scoped por `tenant_id`; insert principal
- `appointments` — validação: deve existir e pertencer ao tenant (WHERE { id, tenant_id })
- `patients` — validação: deve existir e pertencer ao tenant (WHERE { id, tenant_id })
- `event_log` — escrita de `note.created` dentro da mesma transação

## Campos retornados (US-6.1)

`id`, `appointment_id`, `patient_id`, `content`, `created_at`

## Regras de negócio

### Criação de nota clínica (US-6.1)

- **Endpoint:** `POST /api/v1/doctor/clinical-notes`
- **Body:** `{ appointmentId: UUID, patientId: UUID, content: string (não vazio) }`
- **Response 201:** `{ id, appointmentId, patientId, content, createdAt }`
- **content não pode estar vazio:** validado pelo Zod (400 se vazio)
- **Appointment deve existir no tenant:** `WHERE { id: appointmentId, tenant_id }` → 404 `'Consulta não encontrada'`
- **Patient deve existir no tenant:** `WHERE { id: patientId, tenant_id }` → 404 `'Paciente não encontrado'`
- **Atomicidade:** validações + insert + event_log dentro de `knex.transaction()`
- **Evento de audit trail:** INSERT em `event_log` com `event_type='note.created'`, `actor_type='doctor'`, `actor_id`, `payload: { noteId, appointmentId, patientId }` — feito dentro da mesma transação
- **Colunas event_log corretas:** `tenant_id`, `event_type`, `actor_type`, `actor_id`, `payload` — sem `entity_type`/`entity_id` (não existem no schema)
- **Notas clínicas NUNCA expostas ao portal do paciente** — dado interno do médico

## Guards obrigatórios

Todos os endpoints deste módulo requerem:

```typescript
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('doctor')
```

Os guards são declarados na CLASS (não no método individual).

## Mensagens de exceção (português obrigatório)

- `'Consulta não encontrada'` — NotFoundException quando appointment não existe no tenant
- `'Paciente não encontrado'` — NotFoundException quando patient não existe no tenant

## O que NÃO pertence a este módulo

- Auth do doutor (login, refresh, invite) → `modules/auth/`
- Gestão de pacientes → `modules/patient/`
- Lifecycle de consultas → `modules/appointment/`
- Documentos (upload de arquivos) → `modules/document/`
- Booking público → `modules/booking/`
- Portal do paciente (leitura) → `modules/patient/` (nunca expor clinical_notes)

## Como rodar / testar isoladamente

```bash
pnpm --filter @nocrato/api test -- --testPathPattern=clinical-note
```
