# Patient Module

## Responsabilidade

Gestão de pacientes no portal do doutor. Permite listar, buscar e filtrar pacientes
vinculados ao tenant do doutor autenticado. Dados sensíveis (cpf, portal_access_code)
nunca são expostos nas respostas da API.

## Endpoints expostos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/doctor/patients` | Listagem paginada com busca por nome/telefone e filtro por status |
| GET | `/api/v1/doctor/patients/:id` | Perfil completo do paciente com appointments, notas clínicas e documentos |
| POST | `/api/v1/doctor/patients` | Cria paciente manualmente; source='manual', phone único por tenant |
| PATCH | `/api/v1/doctor/patients/:id` | Atualiza campos parciais; body vazio rejeitado; phone único por tenant |

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `patient.module.ts` | Registra controller e service; não reimporta DatabaseModule (é `@Global()`) |
| `patient.controller.ts` | Handlers HTTP; extrai tenantId do JWT via `@TenantId()` |
| `patient.service.ts` | Queries Knex para listagem paginada, perfil completo, criação e edição de paciente |
| `dto/list-patients.dto.ts` | Zod schema para query params de listagem (page, limit, search, status) |
| `dto/create-patient.dto.ts` | Zod schema para body de criação (name, phone, cpf?, email?, dateOfBirth?) |
| `dto/update-patient.dto.ts` | Zod schema para PATCH parcial (name?, phone?, cpf?, email?, status?) |
| `patient.service.spec.ts` | Testes unitários do PatientService — mock manual do Knex |
| `patient.controller.spec.ts` | Testes unitários do PatientController |

## Tabelas envolvidas

- `patients` — scoped por `tenant_id`
- `appointments` — scoped por `tenant_id` e `patient_id` (US-4.2)
- `clinical_notes` — scoped por `tenant_id` e `patient_id` (US-4.2)
- `documents` — scoped por `tenant_id` e `patient_id` (US-4.2)

## Campos públicos (expostos na listagem — US-4.1)

`id`, `name`, `phone`, `email`, `source`, `status`, `created_at`

## Campos públicos (expostos no perfil — US-4.2)

**patient:** `id`, `name`, `phone`, `email`, `source`, `status`, `portal_active`, `created_at`
**appointments:** `id`, `date_time`, `status`, `duration_minutes`, `started_at`, `completed_at`
**clinical_notes:** `id`, `appointment_id`, `content`, `created_at`
**documents:** `id`, `file_name`, `type`, `file_url`, `mime_type`, `created_at`

## Campos NUNCA expostos

- `portal_access_code` — código de acesso do portal do paciente (segredo)
- `cpf` — dado sensível, protegido por LGPD

## Regras de negócio

- **Isolamento por tenantId**: toda query usa `WHERE tenant_id = tenantId`. Nunca aceitar tenantId do body.
- **tenantId extraído do JWT** via `@TenantId()` decorator.
- **Busca full-text parcial**: `search` pesquisa em `name` e `phone` com ILIKE (case-insensitive).
- **Filtro por status**: `status` pode ser `'active'` ou `'inactive'`. Se omitido, retorna todos.
- **Paginação padrão**: page=1, limit=20 (máx 100). Parâmetros HTTP são strings — usar `z.coerce.number()`.
- **Ordenação listagem**: `created_at DESC` (mais recentes primeiro).
- **Perfil — patient não encontrado**: lança `NotFoundException` se o patient não existe OU pertence a outro tenant (não vazar existência).
- **Perfil — queries paralelas**: appointments, clinical_notes e documents são buscados em `Promise.all` após confirmar que o patient existe.
- **Perfil — ordenação**: appointments por `date_time DESC`; clinical_notes e documents por `created_at DESC`.
- **clinical_notes**: visíveis ao doutor no perfil do paciente (diferente do portal do paciente, que não as expõe).
- **Criação manual**: source sempre `'manual'`; status padrão `'active'`. Phone único por tenant via `UNIQUE INDEX idx_patients_tenant_phone (tenant_id, phone)` → erro PostgreSQL `23505` → `ConflictException('Telefone já cadastrado para outro paciente')`.
- **Edição parcial (US-4.4)**: PATCH constrói `updateData` filtrando campos `!== undefined` — campos omitidos não são sobrescrevidos. Body vazio rejeitado pelo schema Zod (`.refine()`). Mesmo tratamento de `23505` da criação. Ambas as queries (verificação e update) usam `{ id, tenant_id }` no `.where()`.

## Guards obrigatórios

Todos os endpoints deste módulo requerem:

```typescript
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('doctor')
```

## O que NÃO pertence a este módulo

- Auth do doutor (login, refresh, invite) → `modules/auth/`
- Portal do paciente (acesso via código) → futuro `modules/patient-portal/`
- Criação de pacientes pelo agente WhatsApp → `modules/agent/`
- Consultas de pacientes → `modules/appointment/`
- Notas clínicas → `modules/clinical-note/`

## Como rodar / testar isoladamente

```bash
pnpm --filter @nocrato/api test -- --testPathPattern=patient
```
