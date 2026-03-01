# Doctor Module

## Responsabilidade

Wizard de onboarding do doutor após aceite do convite. Permite ao doutor preencher seu perfil, horários de atendimento, personalização da marca (branding) e configurações do agente WhatsApp passo a passo. Também expõe endpoint para marcar o onboarding como concluído.

## Endpoints expostos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/doctor/onboarding/status` | Retorna progresso do wizard (steps 1-4 + completed) |
| PATCH | `/api/v1/doctor/onboarding/profile` | Atualiza nome, CRM, especialidade e telefone |
| PATCH | `/api/v1/doctor/onboarding/schedule` | Atualiza horários de trabalho e duração de consulta |
| PATCH | `/api/v1/doctor/onboarding/branding` | Atualiza cor primária e logo do tenant |
| PATCH | `/api/v1/doctor/onboarding/agent` | Upsert das configurações do agente WhatsApp |
| POST | `/api/v1/doctor/onboarding/complete` | Marca onboarding como concluído (valida steps obrigatórios) |

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `doctor.module.ts` | Registra controller e service; não reimporta DatabaseModule (é `@Global()`) |
| `onboarding.controller.ts` | Handlers HTTP; extrai tenantId do JWT via `@TenantId()` |
| `onboarding.service.ts` | Lógica de negócio e queries Knex para onboarding |
| `dto/update-profile.dto.ts` | Zod schema para PATCH /profile |
| `dto/update-schedule.dto.ts` | Zod schema para PATCH /schedule |
| `dto/update-branding.dto.ts` | Zod schema para PATCH /branding |
| `dto/update-agent-settings.dto.ts` | Zod schema para PATCH /agent |
| `onboarding.service.spec.ts` | Testes unitários do OnboardingService |
| `onboarding.controller.spec.ts` | Testes unitários do OnboardingController |

## Tabelas envolvidas

- `doctors` — perfil, horários, crm, onboarding_completed (scoped por tenant_id)
- `tenants` — branding: primary_color, logo_url (scoped por id = tenantId)
- `agent_settings` — configurações do agente WhatsApp (scoped por tenant_id)

## Regras de negócio

- **Isolamento por tenantId**: toda query usa `WHERE tenant_id = tenantId` (ou `WHERE id = tenantId` para a tabela `tenants`). Nunca aceitar tenantId do body.
- **tenantId extraído do JWT** via `@TenantId()` decorator — o JWT de doutor sempre contém `tenantId`.
- **Steps de onboarding**:
  - Step 1 (profile): `name` e `crm` não nulos no registro `doctors`
  - Step 2 (schedule): `working_hours` não nulo no registro `doctors`
  - Step 3 (branding): sempre considerado completo se chegou até aqui (logo_url é opcional)
  - Step 4 (agent): `welcome_message` não nulo em `agent_settings`
- **`currentStep`**: retorna o número do primeiro step incompleto (1-4), ou 5 se todos completos.
- **`completed`**: true quando todos os 4 steps estiverem completos.
- **`/complete`**: valida que profile e schedule foram preenchidos antes de marcar `onboarding_completed = true`.
- **Upsert de agent_settings**: se não existir registro, cria com `enabled: false` e `booking_mode: 'both'`. O valor `'off'` não existe — os valores válidos do CHECK constraint são `'link' | 'chat' | 'both'`.
- **PATCH /branding** atualiza a tabela `tenants`, não a tabela `doctors`.

## Guards obrigatórios

Todos os endpoints deste módulo requerem:
```typescript
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('doctor')
```

O `TenantGuard` garante que o JWT contém `tenantId`. O `RolesGuard` garante que o role é `'doctor'`.

## O que NÃO pertence a este módulo

- Auth do doutor (login, refresh, invite) → `modules/auth/`
- Gestão de pacientes → futuro `modules/patient/`
- Lifecycle de consultas → futuro `modules/appointment/`
- Notas clínicas → futuro `modules/clinical-note/`
- Configurações avançadas do agente (habilitar/desabilitar, booking_mode) → futuro `modules/agent-settings/`

## Como rodar / testar isoladamente

```bash
# Rodar testes do módulo doctor
pnpm --filter @nocrato/api test -- --testPathPattern=doctor
```
