# Skill: Casos de Teste

Gera casos de teste manuais executáveis (BDD) para todas as US de um epic
e os registra em `docs/test-cases/epic-N.md`.

---

## Quando usar

**Gatilho primário — uma vez por epic, no início:**
- Ao iniciar um epic novo, antes de implementar a primeira US
- Os CTs são gerados para todas as US do epic de uma só vez, com base nos critérios de aceitação documentados
- Revelam gaps de requisito antes de codar e guiam o QA durante todo o epic

**Gatilho secundário — atualização incremental:**
- Quando uma US diverge do documentado durante implementação → atualizar os CTs junto com a documentação
- Quando o usuário invocar `/test-cases` explicitamente

**Não usar:**
- US por US durante a implementação (overhead sem ganho — o epic inteiro é mais eficiente)
- Após o epic estar concluído (tarde demais para guiar QA)

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

Use o formato BDD híbrido abaixo para cada caso. Numere sequencialmente como `CT-{epic}{us}-{NN}`:
- US-2.3 → `CT-23-01`, `CT-23-02`...
- US-3.1 → `CT-31-01`, `CT-31-02`...

**Formato simples** (ação única ou fluxo linear curto):

```markdown
### CT-XX-NN — [descrição curta e objetiva]

**Categoria:** Happy path | Isolamento | Acesso negado | Validação | Edge case | Segurança

**Given** [estado inicial do sistema e dados de contexto]
**When** [ação executada — verbo no imperativo]
**Then** [comportamento observável esperado]

**Resultado atual:** [ ] ok  [ ] falhou — [data se executado]
```

**Formato detalhado** (fluxos multi-step, wizards, lifecycles):

```markdown
### CT-XX-NN — [descrição curta e objetiva]

**Categoria:** Happy path | Isolamento | Acesso negado | Validação | Edge case | Segurança

**Given** [estado inicial do sistema]
**When** [resumo da sequência de ações]
**Then** [resultado final observável]

**Passos detalhados:**
1. [ação concreta — verbo no imperativo]
2. [próxima ação]
3. ...

**Resultado atual:** [ ] ok  [ ] falhou — [data se executado]
```

**Regras de geração:**

- Mínimo 1 happy path por endpoint ou fluxo principal
- Mínimo 1 CT de isolamento de tenant para toda US com tabela tenant-scoped
- Máximo 8 CTs por US — priorizar risco sobre completude
- Given/When/Then devem ser compreensíveis sem conhecer o código
- Usar dados realistas: nomes brasileiros, CRMs válidos, telefones no formato `(11) 99999-9999`
- Nunca escrever CTs para o que os unit tests já cobrem exaustivamente (ex: validação de campos isolada)

### 4. Registrar em arquivo dedicado por epic

Os casos de teste ficam em **`docs/test-cases/epic-N.md`** (um arquivo por epic),
separados do epic doc para não inflá-lo.

**Estrutura do arquivo `docs/test-cases/epic-N.md`:**

```markdown
# Casos de Teste — Epic N: [Título]

> Epic doc: [docs/roadmap/epic-N-*.md](../roadmap/epic-N-*.md)
> Gerado em: YYYY-MM-DD

---

## US-N.Y — [título da US]

### CT-NY-01 — ...
...
```

**No epic doc**, adicionar um link no topo (logo após a tabela de metadados):

```markdown
> **Casos de teste:** [docs/test-cases/epic-N.md](../test-cases/epic-N.md)
```

Se o arquivo já existir, acrescentar a nova seção de US sem remover as anteriores.

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

**Given** nenhum token de autenticação presente
**When** requisição enviada para o endpoint sem header Authorization
**Then** HTTP 401 Unauthorized

**Resultado atual:** [ ] ok  [ ] falhou
```

### Toda US com dados tenant-scoped

```markdown
### CT-XX-NN — Usuário não acessa dados de outro tenant

**Categoria:** Isolamento

**Given** dois tenants criados (ex: dr-silva, dra-carvalho), cada um com dados próprios
**When** dr-silva autenticado tenta acessar o recurso com slug de dra-carvalho
**Then** HTTP 403 Forbidden ou dados vazios (dependendo do guard configurado)

**Resultado atual:** [ ] ok  [ ] falhou
```

### Toda US com token temporário (booking, invite, reset)

```markdown
### CT-XX-NN — Token expirado é rejeitado

**Categoria:** Segurança

**Given** token com `expires_at` no passado
**When** token expirado é usado na requisição
**Then** BadRequestException("Convite expirado") ou equivalente

**Resultado atual:** [ ] ok  [ ] falhou

### CT-XX-NN — Token já utilizado não pode ser reutilizado

**Categoria:** Segurança

**Given** token com status "accepted"
**When** token já aceito é usado novamente
**Then** BadRequestException("Este convite já foi utilizado") ou equivalente

**Resultado atual:** [ ] ok  [ ] falhou
```

---

## Exemplos de referência por epic

### Epic 3 — Onboarding (wizard multi-step)

```markdown
### CT-31-01 — Happy path: doutor completa os 4 steps em sequência

**Categoria:** Happy path

**Given** doutor com convite aceito, `onboarding_completed = false`, sem dados de perfil
**When** os 4 steps são preenchidos em sequência e `complete` é chamado
**Then** `onboarding_completed = true` no banco e status retorna `completed = true`

**Passos detalhados:**
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

**Resultado atual:** [ ] ok  [ ] falhou

### CT-31-02 — complete bloqueado com perfil incompleto

**Categoria:** Edge case

**Given** doutor autenticado com `name = null` no banco
**When** POST /api/v1/doctor/onboarding/complete é chamado sem ter preenchido o perfil
**Then** BadRequestException — onboarding não pode ser completado

**Resultado atual:** [ ] ok  [ ] falhou

### CT-31-03 — doutor não acessa onboarding de outro tenant

**Categoria:** Isolamento

**Given** dois doutores em tenants distintos (dr-silva, dra-carvalho)
**When** dr-silva envia PATCH /api/v1/doctor/onboarding/profile com seu JWT
**Then** apenas o tenant de dr-silva é atualizado — dados de dra-carvalho não são alterados

**Resultado atual:** [ ] ok  [ ] falhou
```

---

## O que esta skill não faz

- Não escreve testes automatizados (Jest ou Playwright) — use o agente `qa` para isso
- Não executa os casos de teste — são artefatos manuais
- Não gera CTs para lógica já coberta exaustivamente por unit tests (ex: cada validação de campo individualmente)
