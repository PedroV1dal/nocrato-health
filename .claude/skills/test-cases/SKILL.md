# Skill: Casos de Teste

Gera casos de teste manuais executáveis para uma User Story ou fluxo,
e os registra na seção `## Casos de Teste` do epic correspondente.

---

## Quando usar

- Antes da etapa de QA de qualquer US com fluxo complexo ou interface
- Quando uma US envolve dados tenant-scoped (obrigatório incluir CT de isolamento)
- Quando o usuário invocar `/test-cases` explicitamente
- Antes de fechar um Epic sem cobertura E2E automatizada

---

## Protocolo de execução

### 1. Coletar contexto

Leia, nesta ordem:

1. O epic doc da US em `docs/roadmap/epic-N-*.md` → critérios de aceitação e notas de implementação
2. O flow doc relevante em `docs/flows/` (se existir para o domínio)
3. O schema das tabelas envolvidas em `docs/database/schema.sql`
4. O módulo backend em `apps/api/src/modules/{dominio}/` → entender endpoints, guards e regras de negócio

### 2. Identificar o escopo dos casos de teste

Para cada US, determinar quais categorias se aplicam:

| Categoria | Aplicar quando |
|---|---|
| **Happy path** | Sempre — é o fluxo principal funcionando |
| **Isolamento de tenant** | Sempre que a US acessa tabela tenant-scoped |
| **Acesso negado** | Sempre que há guard de autenticação ou autorização |
| **Validação de entrada** | Quando há formulário ou body com campos obrigatórios |
| **Edge cases do fluxo** | Quando há estado (token, step de wizard, lifecycle de consulta) |
| **Segurança** | Quando há endpoint público, token temporário ou dado sensível |

### 3. Gerar os casos de teste

Use o formato abaixo para cada caso. Numere sequencialmente como `CT-{epic}{us}-{NN}`:
- US-2.3 → `CT-23-01`, `CT-23-02`...
- US-3.1 → `CT-31-01`, `CT-31-02`...

```markdown
### CT-XX-NN — [descrição curta e objetiva]

**Categoria:** Happy path | Isolamento | Acesso negado | Validação | Edge case | Segurança
**Pré-condição:** [estado do sistema antes de executar]

**Passos:**
1. [ação concreta — verbo no imperativo]
2. [próxima ação]
3. ...

**Resultado esperado:** [o que deve acontecer — comportamento observável]
**Resultado atual:** [ ] ok  [ ] falhou — [data se executado]
```

**Regras de geração:**

- Mínimo 1 happy path por endpoint ou fluxo principal
- Mínimo 1 CT de isolamento de tenant para toda US com tabela tenant-scoped
- Máximo 8 CTs por US — priorizar risco sobre completude
- Passos devem ser reproduzíveis por alguém sem conhecer o código
- Usar dados realistas: nomes brasileiros, CRMs válidos, telefones no formato `(11) 99999-9999`
- Nunca escrever CTs para o que os unit tests já cobrem exaustivamente (ex: validação de campos isolada)

### 4. Registrar no epic doc

Adicionar os casos de teste ao final da US correspondente no epic doc,
sob uma seção `#### Casos de Teste`:

```markdown
## US-X.Y: [título da US]

[conteúdo existente da US...]

#### Casos de Teste

> Gerados em: YYYY-MM-DD

### CT-XY-01 — ...
...
```

Se a seção já existir, acrescentar os novos casos sem remover os anteriores.

### 5. Apresentar resumo

Após registrar no doc, apresentar no chat:

```
## Casos de Teste — US-X.Y

| ID | Descrição | Categoria | Status |
|----|-----------|-----------|--------|
| CT-XY-01 | ... | Happy path | [ ] |
| CT-XY-02 | ... | Isolamento | [ ] |
...

**Total:** N casos gerados
**Cobertura:** [fluxos cobertos] / [fluxos identificados]

> Registrado em: docs/roadmap/epic-X-*.md
```

---

## Cenários obrigatórios por domínio

### Toda US com autenticação

```markdown
### CT-XX-NN — Acesso sem token retorna 401

**Categoria:** Acesso negado
**Pré-condição:** nenhuma

**Passos:**
1. Fazer requisição para o endpoint sem header Authorization

**Resultado esperado:** HTTP 401 Unauthorized
```

### Toda US com dados tenant-scoped

```markdown
### CT-XX-NN — Usuário não acessa dados de outro tenant

**Categoria:** Isolamento
**Pré-condição:** dois tenants criados (ex: dr-silva, dra-carvalho), cada um com dados próprios

**Passos:**
1. Autenticar como dr-silva
2. Tentar acessar o recurso com o slug de dra-carvalho

**Resultado esperado:** HTTP 403 Forbidden ou dados vazios (dependendo do guard configurado)
```

### Toda US com token temporário (booking, invite, reset)

```markdown
### CT-XX-NN — Token expirado é rejeitado

**Categoria:** Segurança
**Pré-condição:** token com expires_at no passado

**Passos:**
1. Usar o token expirado na requisição

**Resultado esperado:** BadRequestException("Convite expirado") ou equivalente

### CT-XX-NN — Token já utilizado não pode ser reutilizado

**Categoria:** Segurança
**Pré-condição:** token com status "accepted"

**Passos:**
1. Usar o token já aceito novamente

**Resultado esperado:** BadRequestException("Este convite já foi utilizado") ou equivalente
```

---

## Exemplos de referência por epic

### Epic 3 — Onboarding (wizard multi-step)

```markdown
### CT-31-01 — Happy path: doutor completa os 4 steps em sequência

**Categoria:** Happy path
**Pré-condição:** doutor com convite aceito, onboarding_completed = false, sem dados de perfil

**Passos:**
1. GET /api/v1/doctor/onboarding/status → verificar currentStep = 1
2. PATCH /api/v1/doctor/onboarding/profile { name: "Dr. Rafael Souza", crm: "SP-123456", crmState: "SP" }
3. GET /api/v1/doctor/onboarding/status → verificar currentStep = 2
4. PATCH /api/v1/doctor/onboarding/schedule { workingHours: {...}, timezone: "America/Sao_Paulo", appointmentDuration: 30 }
5. GET /api/v1/doctor/onboarding/status → verificar currentStep = 3
6. PATCH /api/v1/doctor/onboarding/branding { primaryColor: "#D97706" }
7. GET /api/v1/doctor/onboarding/status → verificar currentStep = 4
8. PATCH /api/v1/doctor/onboarding/agent { welcomeMessage: "Olá! Sou o assistente do Dr. Rafael." }
9. POST /api/v1/doctor/onboarding/complete
10. GET /api/v1/doctor/onboarding/status → verificar completed = true

**Resultado esperado:** cada step avança corretamente, complete retorna 200 e onboarding_completed = true no banco
**Resultado atual:** [ ] ok  [ ] falhou

### CT-31-02 — complete bloqueado com perfil incompleto

**Categoria:** Edge case
**Pré-condição:** doutor autenticado, name = null no banco

**Passos:**
1. POST /api/v1/doctor/onboarding/complete sem ter preenchido o perfil

**Resultado esperado:** BadRequestException — onboarding não pode ser completado
**Resultado atual:** [ ] ok  [ ] falhou

### CT-31-03 — doutor não acessa onboarding de outro tenant

**Categoria:** Isolamento
**Pré-condição:** dois doutores em tenants distintos (dr-silva, dra-carvalho)

**Passos:**
1. Autenticar como dr-silva (JWT com tenantId de dr-silva)
2. PATCH /api/v1/doctor/onboarding/profile com o JWT de dr-silva — verificar que só atualiza o tenant de dr-silva

**Resultado esperado:** dados de dra-carvalho não são alterados
**Resultado atual:** [ ] ok  [ ] falhou
```

---

## O que esta skill não faz

- Não escreve testes automatizados (Jest ou Playwright) — use o agente `qa` para isso
- Não executa os casos de teste — são artefatos manuais
- Não gera CTs para lógica já coberta exaustivamente por unit tests (ex: cada validação de campo individualmente)
