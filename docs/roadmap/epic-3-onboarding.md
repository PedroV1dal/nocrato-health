# EPIC 3: Onboarding do Doutor

| Field | Value |
|-------|-------|
| **Epic** | 3 |
| **Name** | Onboarding do Doutor |
| **Description** | Wizard pos-convite para configurar o portal do doutor |
| **Dependencies** | EPIC 1 (Autenticacao & Convites) |
| **User Stories** | 2 |

---

## US-3.1: Como doutor recem-convidado, quero completar meu onboarding ✅

**Agentes:** `backend` → `tech-lead` → `qa`

- [x] GET /api/v1/doctor/onboarding/status → { currentStep, completed, steps }
- [x] PATCH /api/v1/doctor/onboarding/profile { name, specialty, phone, CRM, crmState }
- [x] PATCH /api/v1/doctor/onboarding/schedule { workingHours, timezone, appointmentDuration }
- [x] PATCH /api/v1/doctor/onboarding/branding { primaryColor, logoUrl }
- [x] PATCH /api/v1/doctor/onboarding/agent { welcomeMessage, personality, faq }
- [x] POST /api/v1/doctor/onboarding/complete → marca onboarding_completed = true
- [x] **Criterio:** 4 steps, cada um salva dados, ultimo ativa o portal

**Implementado em:** `apps/api/src/modules/doctor/`
**Testes:** 31 testes (26 service + 6 controller) | Cobertura: 93-97% | Suite total: 258/258
**Notas de implementação:**
- `getOnboardingStatus` retorna `{ currentStep: 1-5, completed: bool, steps: { profile, schedule, branding, agent } }`
- `updateBranding` atualiza tabela `tenants` (primary_color, logo_url), não `doctors`
- `updateAgentSettings` faz upsert com default `booking_mode: 'both'` (valor válido do CHECK constraint)
- `completeOnboarding` valida `name`, `crm` e `working_hours` antes de marcar como completo

---

## US-3.2: [FRONTEND] Wizard de onboarding

**Agentes:** `frontend` → `designer` → `qa`

- [ ] routes/doctor/_layout/onboarding.tsx (wizard 4 steps com progress bar)
- [ ] Step 1: Perfil (nome, CRM, especialidade, telefone)
- [ ] Step 2: Horarios (dias da semana, intervalos, timezone, duracao padrao)
- [ ] Step 3: Branding (cor primaria, upload logo)
- [ ] Step 4: Agente (mensagem boas-vindas, personalidade, FAQ)
- [ ] Redirect automatico pro onboarding se nao completou
- [ ] **Criterio:** Wizard funcional, apos completar → dashboard
