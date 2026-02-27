# Agency Module

## Responsabilidade

Lógica de negócio e endpoints do portal da agência (admins/membros da Nocrato).
Gerencia visão geral da agência: stats de doutores, pacientes, consultas.

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `agency.controller.ts` | Rotas `GET /api/v1/agency/*` e `PATCH /api/v1/agency/*` — aplica `JwtAuthGuard` + `RolesGuard` no nível do controller |
| `agency.service.ts` | Queries Knex para stats, listagens e atualizações da agência |
| `agency.module.ts` | Registra controller e service; não precisa importar `DatabaseModule` pois ele é `@Global()` |
| `agency.service.spec.ts` | Testes unitários do `AgencyService` — mock manual do Knex via Symbol token `KNEX` |

## Regras de negócio

- Todo endpoint requer `JwtAuthGuard` + `RolesGuard` com `'agency_admin'` ou `'agency_member'`
- Stats de dashboard são agregadas para **toda** a agência (sem filtro `tenant_id`)
- Contagens via Knex `.count()` retornam `string` do PostgreSQL — converter com `Number()` antes de retornar
- Nunca aceitar `tenant_id` do body — agency members não têm `tenantId` no JWT

## Padrões adotados

- Knex injetado via `@Inject(KNEX)` onde `KNEX` é o Symbol de `@/database/knex.provider`
- DTOs de query params usam `z.coerce.number()` para page/limit (HTTP entrega strings)
- Guards aplicados no controller class-level — todos os handlers herdam automaticamente
- `@Roles` no método sobrescreve o da class (`getAllAndOverride`): endpoints admin-only usam `@Roles('agency_admin')` no handler

## O que NÃO pertence a este módulo

- Auth (login, refresh, forgot-password) → módulo `auth/`
- Convites → módulo `invite/`
- Lógica de tenant (portal do doutor) → futuro módulo `tenant/`
- Lógica de tenant (portal do doutor) → futuro módulo `tenant/`

## Como rodar / testar isoladamente

```bash
# Rodar testes do módulo agency
pnpm --filter @nocrato/api test -- --testPathPattern=agency
```
