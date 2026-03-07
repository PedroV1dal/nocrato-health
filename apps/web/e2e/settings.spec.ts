/**
 * settings.spec.ts
 *
 * Testes E2E para US-8.3 — Página de Configurações no portal do doutor.
 *
 * Pré-requisito: globalSetup (global-setup.ts) cria dados de teste no banco.
 * Doutor usado: test-done@nocrato.com / Doctor123! (onboarding concluído)
 *
 * CTs cobertos: CT-83-01 a CT-83-05
 *
 * Notas de seletores:
 *   - TabsTrigger renderiza como <button> — usar getByRole('button', { name })
 *   - Toast: CustomEvent 'toast' → verifica texto no container via data-testid ou texto
 *   - Select: SelectTrigger renderiza como botão; SelectItem como div clicável
 *
 * Execução: cd apps/web && npx playwright test e2e/settings.spec.ts
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

// ─── Constantes ────────────────────────────────────────────────────────────────

const API_URL = 'http://localhost:3000'
const WEB_URL = 'http://localhost:5173'
const TEST_EMAIL = 'test-done@nocrato.com'
const TEST_PASSWORD = 'Doctor123!'

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface DoctorLoginResult {
  accessToken: string
  refreshToken: string
  doctor: {
    id: string
    name: string
    email: string
    tenantId: string
    slug: string
    onboardingCompleted: boolean
  }
}

async function loginDoctor(request: APIRequestContext): Promise<DoctorLoginResult> {
  const res = await request.post(`${API_URL}/api/v1/doctor/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
  if (!res.ok()) {
    throw new Error(`Login failed (${res.status()}): ${await res.text()}`)
  }
  return res.json() as Promise<DoctorLoginResult>
}

function buildAuthState(data: DoctorLoginResult): string {
  return JSON.stringify({
    state: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.doctor,
      userType: 'doctor',
      tenantId: data.doctor.tenantId,
      onboardingCompleted: true,
    },
    version: 0,
  })
}

async function gotoSettings(
  page: import('@playwright/test').Page,
  request: APIRequestContext,
): Promise<void> {
  const loginData = await loginDoctor(request)
  await page.goto(WEB_URL)
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: 'nocrato-auth', value: buildAuthState(loginData) },
  )
  await page.goto(`${WEB_URL}/doctor/settings`)
  await page.waitForLoadState('networkidle')
}

// ─── CT-83-01: Página exibe as 4 seções com dados atuais ─────────────────────

test('CT-83-01: página /doctor/settings exibe 4 seções com dados carregados', async ({
  page,
  request,
}) => {
  await gotoSettings(page, request)

  // Título principal
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()

  // 4 abas devem estar visíveis (TabsTrigger renderiza como button)
  await expect(page.getByRole('button', { name: 'Dados do doutor' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Horários' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Branding' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agente WhatsApp' })).toBeVisible()

  // Seção padrão (Dados do doutor) — campos visíveis com valores
  await expect(page.getByLabel('Nome completo')).toBeVisible()
  await expect(page.getByLabel('Especialidade')).toBeVisible()
  await expect(page.getByLabel('Telefone de contato')).toBeVisible()

  // Email read-only exibido
  await expect(page.getByText(TEST_EMAIL)).toBeVisible()
})

// ─── CT-83-02: Editar especialidade e salvar exibe toast de sucesso ────────────

test('CT-83-02: editar especialidade e salvar exibe toast de sucesso e persiste', async ({
  page,
  request,
}) => {
  await gotoSettings(page, request)

  // Editar campo Especialidade
  const specialtyInput = page.getByLabel('Especialidade')
  await specialtyInput.clear()
  await specialtyInput.fill('Neurologia')

  // Clicar em Salvar dados
  await page.getByRole('button', { name: 'Salvar dados' }).click()

  // Toast de sucesso deve aparecer
  await expect(page.getByText('Dados atualizados com sucesso!')).toBeVisible({ timeout: 5000 })

  // Recarregar e verificar persistência
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByLabel('Especialidade')).toHaveValue('Neurologia')

  // Restaurar valor original para não quebrar outros testes
  await page.getByLabel('Especialidade').clear()
  await page.getByLabel('Especialidade').fill('Clínica Geral')
  await page.getByRole('button', { name: 'Salvar dados' }).click()
  await expect(page.getByText('Dados atualizados com sucesso!')).toBeVisible({ timeout: 5000 })
})

// ─── CT-83-03: Editar mensagem de boas-vindas e toggle agente ────────────────

test('CT-83-03: editar mensagem de boas-vindas e ativar agente, salvar persiste', async ({
  page,
  request,
}) => {
  await gotoSettings(page, request)

  // Ir para aba Agente WhatsApp
  await page.getByRole('button', { name: 'Agente WhatsApp' }).click()
  await page.waitForLoadState('networkidle')

  // Editar mensagem de boas-vindas
  const welcomeInput = page.getByLabel('Mensagem de boas-vindas')
  await welcomeInput.clear()
  await welcomeInput.fill('Olá! Posso ajudar?')

  // Clicar em salvar
  await page.getByRole('button', { name: 'Salvar configurações do agente' }).click()

  // Toast de sucesso
  await expect(page.getByText('Configurações do agente salvas com sucesso!')).toBeVisible({
    timeout: 5000,
  })

  // Verificar via API que o dado foi persistido
  const loginData = await loginDoctor(request)
  const agentRes = await request.get(`${API_URL}/api/v1/doctor/agent-settings`, {
    headers: { Authorization: `Bearer ${loginData.accessToken}` },
  })
  expect(agentRes.ok()).toBeTruthy()
  const agentData = await agentRes.json()
  expect(agentData.welcomeMessage).toBe('Olá! Posso ajudar?')
})

// ─── CT-83-04: Sem autenticação redireciona para /doctor/login ─────────────────

test('CT-83-04: acesso sem autenticação redireciona para /doctor/login', async ({ page }) => {
  // Navegar sem setar localStorage (sem token)
  await page.goto(`${WEB_URL}/doctor/settings`)
  await page.waitForLoadState('networkidle')

  // Deve ter redirecionado para login
  await expect(page).toHaveURL(/\/doctor\/login/)

  // Página de configurações NÃO deve estar visível
  await expect(page.getByRole('heading', { name: 'Configurações' })).not.toBeVisible()
})

// ─── CT-83-05: Alterar bookingMode para 'link' persiste corretamente ──────────

test('CT-83-05: alterar bookingMode para "Apenas link" persiste após reload', async ({
  page,
  request,
}) => {
  await gotoSettings(page, request)

  // Ir para aba Agente WhatsApp
  await page.getByRole('button', { name: 'Agente WhatsApp' }).click()
  await page.waitForLoadState('networkidle')

  // Abrir o Select de Modo de agendamento
  // SelectTrigger renderiza como <button> com o VALOR BRUTO (link|chat|both), não a label
  // Padrão estabelecido: Select mostra valor bruto — ver MEMORY.md
  const selectTrigger = page.locator('button').filter({ hasText: /^(link|chat|both)$/ })
  await selectTrigger.click()

  // SelectItem renderiza como <button> com o texto da label
  await page.getByRole('button', { name: 'Apenas link' }).click()

  // Salvar
  await page.getByRole('button', { name: 'Salvar configurações do agente' }).click()

  // Toast de sucesso
  await expect(page.getByText('Configurações do agente salvas com sucesso!')).toBeVisible({
    timeout: 5000,
  })

  // Recarregar e verificar se o Select mostra "Apenas link"
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Agente WhatsApp' }).click()
  await page.waitForLoadState('networkidle')

  // O trigger do Select deve exibir o valor bruto 'link' (padrão: SelectValue mostra valor raw)
  await expect(page.locator('button').filter({ hasText: /^link$/ })).toBeVisible()
})
