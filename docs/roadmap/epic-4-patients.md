# EPIC 4: Gestao de Pacientes

| Field | Value |
|-------|-------|
| **Epic** | 4 |
| **Name** | Gestao de Pacientes |
| **Description** | CRUD de pacientes no portal do doutor |
| **Dependencies** | EPIC 3 (Onboarding do Doutor) |
| **User Stories** | 5 |

> **Casos de teste:** [docs/test-cases/epic-4.md](../test-cases/epic-4.md)

---

## US-4.1: Como doutor, quero ver a lista dos meus pacientes ✅

**Agentes:** `backend` → `tech-lead` → `qa`

- [x] GET /api/v1/doctor/patients?page=1&search=Maria&status=active
- [x] Retorna: name, phone, email, source, status, created_at
- [x] **Criterio:** Listagem paginada com busca por nome/telefone
- [x] 21 testes (284/284 suite completa), cobertura 87.87%
- [x] Sanitização de `%`/`_` no search implementada e testada

---

## US-4.2: Como doutor, quero ver o perfil completo de um paciente ✅

**Agentes:** `backend` → `tech-lead` → `qa`

- [x] GET /api/v1/doctor/patients/:id → patient + appointments + notes + documents
- [x] Retorna: `{ patient, appointments, clinicalNotes, documents }` com ordering por data DESC
- [x] NotFoundException para patient inexistente ou de outro tenant (sem vazar existência)
- [x] `cpf` e `portal_access_code` nunca selecionados; `portal_active` incluído
- [x] 17 testes novos (305/305 suite completa), cobertura 100%
- [x] **Criterio:** Retorna perfil completo com historico

---

## US-4.3: Como doutor, quero criar um paciente manualmente ✅

**Agentes:** `backend` → `tech-lead` → `qa`

- [x] POST /api/v1/doctor/patients { name, phone, cpf?, email?, dateOfBirth? }
- [x] source = 'manual' fixo, status = 'active' padrão
- [x] Phone único por tenant (UNIQUE INDEX idx_patients_tenant_phone) → 409 ConflictException
- [x] cpf e portal_access_code nunca expostos na resposta (.returning(PUBLIC_PATIENT_FIELDS))
- [x] 61 testes (366/366 suite completa), cobertura 100%
- [x] **Criterio:** Paciente criado, phone unico enforced

---

## US-4.4: Como doutor, quero editar dados de um paciente

**Agentes:** `backend` → `tech-lead` → `qa`

- [ ] PATCH /api/v1/doctor/patients/:id { name?, phone?, cpf?, email?, status? }
- [ ] **Criterio:** Update funcional

---

## US-4.5: [FRONTEND] Paginas de pacientes

**Agentes:** `frontend` → `designer` → `qa`

- [ ] routes/doctor/_layout/patients/index.tsx (lista com cards + busca + filtro status)
- [ ] routes/doctor/_layout/patients/$patientId.tsx (perfil com tabs)
  - [ ] Tab Info: dados editaveis
  - [ ] Tab Consultas: historico de appointments
  - [ ] Tab Notas: notas clinicas
  - [ ] Tab Documentos: lista + upload
- [ ] **Criterio:** CRUD completo no browser
