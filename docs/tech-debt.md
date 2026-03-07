# Débitos Técnicos

Registro centralizado de decisões conscientes de simplificação que devem ser revisadas antes de produção ou conforme o projeto escalar.

Formato de prioridade: **P1** (antes do deploy) · **P2** (antes de escalar) · **P3** (conforto/qualidade)

---

## Em aberto

### TD-01 — getSlots: filtro de appointments usa range UTC fixo
**Módulo:** `booking`
**Identificado em:** US-7.2
**Prioridade:** P2

`getSlots` filtra appointments do dia com `date_time >= T00:00:00.000Z AND date_time < T23:59:59.999Z`, tratando a data como se fosse UTC. O correto seria converter os limites do dia para UTC usando o timezone do doutor (`doctors.timezone`).

**Impacto atual:** Nenhum no MVP. Todos os doutores estão em `America/Sao_Paulo` (UTC-3) com horários entre 08:00–18:00. Um appointment das 08:00 local é armazenado como T11:00Z — dentro do range. Só se manifestaria com horários após 21:00 local (T00:00Z do dia seguinte).

**Fix:** Calcular `dayStart` e `dayEnd` convertendo `date + 00:00` e `date + 23:59` para UTC usando `Intl.DateTimeFormat` ou `Date` aritmético com o offset do timezone.

---

### TD-02 — Seed de dados realista ausente
**Módulo:** `database`
**Identificado em:** Revisão pós-Epic 5
**Prioridade:** P1

O seed atual (`seed.ts`) cria apenas admin da agência. Falta um doutor completo (onboarding concluído, agent_settings configurado, working_hours preenchido), paciente de exemplo e booking token válido para testar o fluxo completo em produção.

**Fix:** Expandir `apps/api/src/database/seed.ts` com fixture realista de ponta a ponta.

---

### TD-03 — Coverage threshold não configurado no Jest
**Módulo:** `apps/api`
**Identificado em:** Revisão pós-Epic 5
**Prioridade:** P3

Não há `--coverageThreshold` no Jest config. A cobertura pode cair silenciosamente em futuras US sem alertar.

**Fix:** Adicionar threshold mínimo (sugestão: `{ statements: 80, functions: 90 }`) em `jest.config.ts`.

---

### TD-04 — CI não configurado (GitHub Actions)
**Módulo:** `infra`
**Identificado em:** Revisão pós-Epic 5
**Prioridade:** P1

Não há pipeline de CI. Testes Jest e Playwright só rodam localmente.

**Fix:** Criar `.github/workflows/ci.yml` com steps: `pnpm install` → `tsc --noEmit` → `jest` → `playwright test`.

---

### TD-05 — Mobile viewport não testado no Playwright
**Módulo:** `apps/web`
**Identificado em:** Revisão pós-Epic 5
**Prioridade:** P2

`playwright.config.ts` usa apenas Chromium desktop. A página de booking (`/book/:slug`) é acessada majoritariamente via mobile (link do WhatsApp).

**Fix:** Adicionar projeto `iphone-12` no config do Playwright para as suítes de booking (US-7.5).

---

### TD-06 — `any` explícito em jwt-auth.guard.ts
**Módulo:** `common/guards`
**Identificado em:** Health Check US-7.2
**Prioridade:** P3

`jwt-auth.guard.ts` usa `: any` em um type assertion. Não é risco de runtime — é qualidade de tipo.

**Fix:** Tipar corretamente com a interface `JwtPayload` do projeto.

---

### TD-07 — Specs de controller ausentes
**Módulo:** `auth`, `agency`, `booking`, `clinical-note`, `document`, `invite`
**Identificado em:** Auditoria pós-Epic 7
**Prioridade:** P2

Nenhum controller tem `*.controller.spec.ts`. Os testes cobrem os services, mas validações de rota, query params inválidos, respostas HTTP e guards ficam sem teste isolado. O `booking.controller.ts` é o mais crítico por ser público (sem guards).

**Fix:** Adicionar `*.controller.spec.ts` usando `Test.createTestingModule()` + `supertest`. Priorizar `booking.controller.spec.ts` por ser público.

---

### TD-08 — event_log cresce indefinidamente sem política de retenção
**Módulo:** `event-log`
**Identificado em:** ADR-007 / Auditoria pós-Epic 7
**Prioridade:** P2

A tabela `event_log` recebe uma linha por evento de negócio (appointments, documentos, notas clínicas, etc.) sem TTL ou arquivamento. Em produção com múltiplos tenants ativos, a tabela pode atingir milhões de linhas em meses, degradando queries de audit.

**Fix pós-deploy:** Definir política de retenção (sugestão: 180 dias). Implementar job de arquivamento trimestral ou particionamento por mês.

---

### TD-09 — Refresh tokens sem possibilidade de revogação imediata
**Módulo:** `auth`
**Identificado em:** ADR-006 / Auditoria pós-Epic 7
**Prioridade:** P2

Refresh tokens são stateless (não armazenados no banco). Impossível revogar sessão ativa de um usuário comprometido antes do token expirar (7 dias). Mitigação atual: access tokens curtos (15 min).

**Fix pós-escala:** Implementar Redis blacklist para refresh tokens ou armazenar hash do token no banco com flag `revoked`.

---

### TD-10 — Uploads de documentos em disco local sem backup
**Módulo:** `document`
**Identificado em:** ADR-003 / Auditoria pós-Epic 7
**Prioridade:** P2

Arquivos enviados (`/uploads/{tenantId}/`) ficam no disco da instância Hetzner sem replicação. Falha de disco = perda de todos os documentos dos pacientes.

**Fix pós-deploy:** Configurar cron job de sync para S3/R2. Longo prazo: substituir disco local por object storage (fora do escopo do MVP).

---

### TD-12 — Duplicação da lógica de geração de slots entre getSlots e getSlotsInternal
**Módulo:** `booking`
**Identificado em:** US-7.4 (OBS-TL-1)
**Prioridade:** P3

`getSlots(slug, token, date)` e `getSlotsInternal(tenantId, date)` duplicam verbatim a lógica de: parse do dia da semana, geração de slots por período, busca de appointments ocupados, conversão UTC→local e filtragem de overlap e horários passados.

**Impacto atual:** Nenhum — são dois pontos de entrada distintos (público e interno). Risco de drift se regras de slot mudarem (ex: buffer entre consultas).

**Fix:** Extrair `_computeSlots(tenantId: string, date: string): Promise<GetSlotsResult>` como método privado compartilhado. `getSlots` e `getSlotsInternal` delegam para ele após suas respectivas etapas de validação.

---

### TD-13 — getSlotsInternal silencia doutor inativo (retorna slots vazios sem NotFoundException)
**Módulo:** `booking`
**Identificado em:** US-7.4 (OBS-TL-2)
**Prioridade:** P2

Quando `getSlotsInternal(tenantId, date)` é chamado para um tenant sem doutor ativo (onboarding incompleto ou doutor inativado), o método retorna `{ slots: [], timezone: 'America/Sao_Paulo', durationMinutes: 30 }` silenciosamente — fallbacks padrão em vez de NotFoundException.

**Impacto atual:** O AgentModule (Epic 9) receberá resposta vazia sem saber o motivo, podendo confundir "agenda vazia" com "doutor inativo".

**Fix:** Lançar `NotFoundException('Médico não encontrado ou inativo')` quando `doctor === null`, ou o AgentModule deve verificar status do doutor antes de chamar. Resolver ao implementar AgentModule no Epic 9.

---

### TD-15 — AgentSettingsRow duplicada entre agent-settings.service.ts e onboarding.service.ts
**Módulo:** `doctor`
**Identificado em:** US-8.1 (OBS-TL-1)
**Prioridade:** P3

A interface `AgentSettingsRow` está definida em dois lugares: `agent-settings.service.ts` (privada) e `onboarding.service.ts` (exportada). Se a tabela `agent_settings` ganhar colunas novas (ex: `extra_config` exposto), a manutenção acontece em dois pontos.

**Fix:** Mover a interface para `doctor.types.ts` e reutilizar em ambos os services.

---

### TD-14 — formatTime/formatDateTime com timezone fixo; todayDate usa fuso local do browser
**Módulo:** `apps/web` (routes/book/$slug.tsx)
**Identificado em:** US-7.5 (OBS-TL-2 tech-lead)
**Prioridade:** P2

`formatTime` e `formatDateTime` usam `timeZone: 'America/Sao_Paulo'` fixo, ignorando `SlotsResponse.timezone` retornado pelo backend. `todayDate()` calcula a data mínima do input usando o fuso local do browser, criando janela de até 3h de inconsistência para médicos em UTC vs browser UTC-3.

**Impacto atual:** Nenhum — todos os médicos estão em `America/Sao_Paulo`. Manifesta-se com médicos em outros fusos ou servidor em fuso diferente.

**Fix:** Passar `timezone` da `SlotsResponse` para `formatTime`; calcular `todayDate()` convertendo `new Date()` para o fuso do médico via `Intl.DateTimeFormat`. Resolver antes do Epic 11 se escopo incluir médicos fora de SP.

---

### TD-15 — Campo phone readonly (booking) bypassável via DevTools; backend não valida correspondência
**Módulo:** `booking` (backend + apps/web)
**Identificado em:** US-7.5 (OBS-TL-3 tech-lead)
**Prioridade:** P2

O frontend aplica `readOnly` visual no campo `phone` quando o token tem um número vinculado. Esse atributo pode ser removido via DevTools, permitindo enviar um telefone diferente no POST `/book`. O `BookingService.book()` não verifica se o `phone` do body corresponde ao `phone` do token.

**Impacto atual:** Baixo — o agente WhatsApp gera o token com o phone do contato que iniciou a conversa. Um usuário malicioso poderia agendar em nome de outro número. Para o MVP com base de pacientes gerenciada, o risco é aceitável.

**Fix:** No `BookingService.book()`: se `bookingToken.phone` não for null, verificar `dto.phone === bookingToken.phone`; caso contrário, lançar `BadRequestException('Telefone não corresponde ao link de agendamento')`.

---

### TD-11 — EventEmitter2 sem retry (eventos de negócio podem ser perdidos)
**Módulo:** `agent`
**Identificado em:** ADR-014 / Auditoria pós-Epic 7
**Prioridade:** P2

`EventEmitter2` é síncrono e in-process. Se o processo NestJS cair durante a execução de um handler (ex: envio de notificação WhatsApp), o evento é descartado sem retry. O `event_log` garante rastreabilidade mas não reprocessamento automático.

**Mitigação atual:** Gravar no `event_log` ANTES de emitir o evento (já implementado) — permite reprocessamento manual.

**Fix pós-escala:** Migrar eventos críticos para BullMQ (Redis-backed) com retry automático e dead-letter queue.

---

### TD-12 — Timezone hardcoded `America/Sao_Paulo` no frontend de booking (OBS-TL-01/02)
**Módulo:** `apps/web/routes/book/`, `booking`
**Identificado em:** US-7.5 / Revisão tech-lead
**Prioridade:** P2

Em `$slug.tsx`, `formatDateTime` e a formatação de data no Step2 usam `timeZone: 'America/Sao_Paulo'` fixo. Além disso, o `dateTime` enviado ao POST `/book` é construído com offset fixo `-03:00` (`${date}T${slot.start}:00-03:00`). Doutores com timezone diferente (ex: `America/Manaus`) veriam horários incorretos.

**Mitigação atual:** Todos os doutores do MVP estão em BRT — comportamento correto para o caso de uso atual.

**Fix:** Expor `timezone` no `ValidateTokenResponse`; consumir no frontend para formatar datas e construir o offset correto. Relacionado ao TD-07 (backend) — resolver juntos.

---

### TD-16 — `workingHours: {}` apaga horários mas não invalida step de onboarding
**Módulo:** `apps/web/routes/doctor/settings`, `doctor/onboarding`
**Identificado em:** US-8.3 / Revisão tech-lead (OBS-TL-1)
**Prioridade:** P3

Se o usuário desativar todos os dias na `ScheduleSection` de settings e salvar, o backend persiste `working_hours = {}`. O serviço de onboarding verifica schedule como `Object.keys(working_hours).length > 0` — portanto `{}` faria o step "Horários" parecer incompleto retroativamente (embora `onboarding_completed` permaneça `true`).

**Impacto atual:** Nenhum no MVP. O step de onboarding não é exibido após conclusão. O campo `onboarding_completed` não é revertido pelo update.

**Fix:** Documentar no onboarding service que working_hours vazio é um estado válido pós-onboarding. Ou adicionar validação no settings para não permitir salvar sem pelo menos um dia ativo.

---

### TD-17 — Duas implementações de ativação de portal
**Módulo:** `patient`
**Identificado em:** US-9.1
**Prioridade:** P3

`appointment.service.ts` ativa o portal do paciente diretamente dentro da transação quando o status muda para `completed` (actor_type='doctor'). `patient.service.ts` tem o método `activatePortal()` standalone para uso futuro do módulo `agent/` (actor_type='system'). São dois caminhos distintos que registram entradas diferentes no `event_log`.

**Impacto atual:** Nenhum — os dois caminhos são mutuamente exclusivos no MVP. O risco é de inconsistência no `event_log` se o `agent/` precisar ativar portais que já foram ativados pelo fluxo do doutor.

**Fix:** Consolidar em US futura se o `agent/` precisar de consistência no `event_log`. Extrair a lógica de geração de código e UPDATE do paciente para `patient.service.activatePortal()`, e chamá-la de dentro da transação do `appointment.service` via injeção do `PatientService`.

---

### ~~TD-18 — Type guard do webhook controller não valida `data.key` antes do cast~~ ✅ RESOLVIDO em US-9.3
**Módulo:** `agent`
**Identificado em:** US-9.2 (OBS-TL-2 tech-lead)
**Resolvido em:** US-9.3 — adicionado guard `!payload.data?.key?.remoteJid` no controller antes de chamar `handleMessage`

---

### TD-19 — Webhook controller sem decorator explícito de rota pública
**Módulo:** `agent`
**Identificado em:** US-9.2 (OBS-TL-3 tech-lead)
**Prioridade:** P3

`agent.controller.ts` não usa `JwtAuthGuard` mas também não tem um decorator `@Public()` ou `@SkipAuth()` para documentar explicitamente a ausência de auth. Auditoria de rotas públicas fica dependente de leitura manual.

**Fix:** Criar `@Public()` decorator em `common/decorators/` e aplicar no controller. Útil quando o projeto escalar e múltiplos desenvolvedores precisarem auditar rotas sem auth.

---

### TD-20 — resolveTenantFromInstance não suporta múltiplos tenants ativos simultaneamente
**Módulo:** `agent`
**Identificado em:** US-9.3 (OBS-TL-4 tech-lead)
**Prioridade:** P1

`resolveTenantFromInstance()` busca o `agent_settings` com `enabled=true` mais recente por `updated_at`. Com dois ou mais doutores ativos, mensagens de pacientes de um tenant podem ser processadas com contexto de outro tenant — vazamento de dados entre tenants.

**Fix:** Adicionar coluna `evolution_instance VARCHAR(100)` em `agent_settings`. Cada tenant configura sua própria instância. A resolução passa a ser `WHERE evolution_instance = env.EVOLUTION_INSTANCE`. Resolver antes de onboarding do segundo cliente.

---

### TD-21 — Erros da API OpenAI não são capturados com contexto de tenant/phone
**Módulo:** `agent`
**Identificado em:** US-9.3 (OBS-TL-1 tech-lead)
**Prioridade:** P2

As chamadas a `openai.chat.completions.create()` em `handleMessage` não têm `try/catch`. Em caso de erro (quota, timeout, rede), o NestJS retorna 500 mas o log não identifica tenant/phone afetado.

**Fix:** Envolver o bloco do loop OpenAI em `try/catch` com log contextualizado e envio de mensagem de fallback ao paciente via `whatsappService.sendText`. Resolver antes do deploy.

---

### TD-22 — Instância OpenAI criada por mensagem recebida
**Módulo:** `agent`
**Identificado em:** US-9.3 (OBS-TL-2 tech-lead)
**Prioridade:** P3

`new OpenAI({ apiKey: env.OPENAI_API_KEY })` é instanciado dentro de `handleMessage` a cada chamada. Melhor instanciar como campo `private readonly openai` no constructor.

---

## Resolvidos

### TD-18 — Type guard do webhook controller não validava `data.key.remoteJid`
**Resolvido em:** US-9.3 — adicionado guard `!payload.data?.key?.remoteJid` no controller antes de chamar `handleMessage`

---

## Como usar este arquivo

- Ao identificar um novo débito, adicionar entrada com ID sequencial (`TD-NN`), módulo, US de origem e prioridade.
- Ao resolver, mover para a seção **Resolvidos** com o commit de fix.
- P1 deve ser resolvido antes do Epic 11 (deploy). P2 antes de escalar. P3 é qualidade opcional.
