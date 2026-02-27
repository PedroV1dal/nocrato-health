# EPIC 5: Gestao de Consultas

| Field | Value |
|-------|-------|
| **Epic** | 5 |
| **Name** | Gestao de Consultas |
| **Description** | CRUD de consultas com lifecycle de status |
| **Dependencies** | EPIC 3 (Onboarding do Doutor) |
| **User Stories** | 6 |

---

## US-5.1: Como doutor, quero ver minhas consultas (com filtros)

**Agentes:** `backend` → `tech-lead` → `qa`

- [ ] GET /api/v1/doctor/appointments?status=scheduled&date=2024-01-15&page=1
- [ ] Filtros: status, data, paciente
- [ ] **Criterio:** Listagem com filtros funcionais

---

## US-5.2: Como doutor, quero criar uma consulta manualmente

**Agentes:** `backend` + `dba` → `tech-lead` → `qa`

- [ ] POST /api/v1/doctor/appointments { patientId, dateTime, durationMinutes? }
- [ ] created_by = 'doctor', status = 'scheduled'
- [ ] Verifica conflito de horario (SELECT FOR UPDATE)
- [ ] **Criterio:** Consulta criada, conflito detectado se horario ocupado

---

## US-5.3: Como doutor, quero alterar o status de uma consulta

**Agentes:** `backend` → `tech-lead` → `qa`

- [ ] PATCH /api/v1/doctor/appointments/:id/status { status }
- [ ] Transicoes validas:
  - scheduled → waiting (auto ou manual)
  - waiting → in_progress (doutor inicia)
  - in_progress → completed (doutor finaliza)
  - scheduled|waiting → cancelled (com motivo)
  - scheduled|waiting → no_show
  - scheduled → rescheduled (cria nova consulta)
- [ ] started_at e completed_at preenchidos automaticamente
- [ ] Se completed: gera portal_access_code pro paciente (se primeiro atendimento)
- [ ] Emite evento no event_log
- [ ] **Criterio:** Todas transicoes validas funcionam, invalidas retornam 400

---

## US-5.4: Como doutor, quero ver o detalhe de uma consulta

**Agentes:** `backend` → `tech-lead` → `qa`

- [ ] GET /api/v1/doctor/appointments/:id → appointment + patient + notes
- [ ] **Criterio:** Retorna dados completos

---

## US-5.5: Como doutor, quero ver meu dashboard com consultas de hoje

**Agentes:** `backend` → `tech-lead` → `qa`

- [ ] GET /api/v1/doctor/dashboard → { todayAppointments, totalPatients, pendingFollowUps }
- [ ] **Criterio:** Stats corretos

---

## US-5.6: [FRONTEND] Paginas de consultas + dashboard

**Agentes:** `frontend` → `designer` → `qa`

- [ ] routes/doctor/_layout/index.tsx (dashboard: cards + lista consultas de hoje)
- [ ] routes/doctor/_layout/appointments/index.tsx (lista + filtros + status badges)
- [ ] routes/doctor/_layout/appointments/$appointmentId.tsx (detalhe + botoes de acao)
  - [ ] Botoes contextuais: "Iniciar Atendimento", "Finalizar", "Cancelar", "No-Show"
  - [ ] Link para criar nota clinica
  - [ ] Resumo do agente (agent_summary) se existir
- [ ] Dialog para criar consulta manual (selecionar paciente + data/hora)
- [ ] **Criterio:** Fluxo completo de consulta no browser
