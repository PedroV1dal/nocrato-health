import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Settings, User, Clock, Palette, Bot, Plus, Trash2 } from 'lucide-react'

import {
  profileSettingsQueryOptions,
  agentSettingsQueryOptions,
  useUpdateProfileSettings,
  useUpdateBrandingSettings,
  useUpdateAgentSettings,
} from '@/lib/queries/doctor'
import { toast } from '@/lib/toast'
import type { WorkingHours, WorkingHoursSlot } from '@/types/api'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ─── Constantes ──────────────────────────────────────────────────────────────

const DAY_KEYS: Array<keyof WorkingHours> = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]

const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo',
}

const BOOKING_MODE_LABELS: Record<string, string> = {
  link: 'Apenas link',
  chat: 'Apenas chat',
  both: 'Ambos',
}

// ─── Seção 1: Dados do doutor ─────────────────────────────────────────────────

interface ProfileSectionProps {
  name: string | null
  specialty: string | null
  phone: string | null
  email: string
  crm: string | null
  crmState: string | null
}

function ProfileSection({ name, specialty, phone, email, crm, crmState }: ProfileSectionProps) {
  const [formName, setFormName] = React.useState(name ?? '')
  const [formSpecialty, setFormSpecialty] = React.useState(specialty ?? '')
  const [formPhone, setFormPhone] = React.useState(phone ?? '')

  const mutation = useUpdateProfileSettings()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        name: formName || undefined,
        specialty: formSpecialty || undefined,
        phone: formPhone || undefined,
      },
      {
        onSuccess: () => toast.success('Dados atualizados com sucesso!'),
        onError: () => toast.error('Erro ao salvar dados. Tente novamente.'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-amber-mid" />
          Dados do consultório
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campos read-only */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-[#f5f0e8] border border-[#e8dfc8]">
            <div className="space-y-1">
              <Label className="text-xs text-[#6c85a0] uppercase tracking-wide">E-mail</Label>
              <p className="text-sm text-amber-dark font-medium">{email}</p>
            </div>
            {crm && (
              <div className="space-y-1">
                <Label className="text-xs text-[#6c85a0] uppercase tracking-wide">CRM</Label>
                <p className="text-sm text-amber-dark font-medium">{crm}</p>
              </div>
            )}
            {crmState && (
              <div className="space-y-1">
                <Label className="text-xs text-[#6c85a0] uppercase tracking-wide">Estado do CRM</Label>
                <p className="text-sm text-amber-dark font-medium">{crmState}</p>
              </div>
            )}
          </div>

          {/* Campos editáveis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ps-name">Nome completo</Label>
              <Input
                id="ps-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Dr. João Silva"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-specialty">Especialidade</Label>
              <Input
                id="ps-specialty"
                value={formSpecialty}
                onChange={(e) => setFormSpecialty(e.target.value)}
                placeholder="Cardiologista"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-phone">Telefone de contato</Label>
            <Input
              id="ps-phone"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="max-w-xs"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={mutation.isPending}>
              Salvar dados
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Seção 2: Horários de atendimento ────────────────────────────────────────

interface ScheduleSectionProps {
  workingHours: WorkingHours | null
  timezone: string
}

function ScheduleSection({ workingHours: initialHours, timezone: initialTimezone }: ScheduleSectionProps) {
  const [hours, setHours] = React.useState<WorkingHours>(() => initialHours ?? {})
  const [timezone, setTimezone] = React.useState(initialTimezone)

  const mutation = useUpdateProfileSettings()

  function isDayActive(day: string): boolean {
    return Array.isArray(hours[day as keyof WorkingHours]) &&
      (hours[day as keyof WorkingHours]?.length ?? 0) > 0
  }

  function toggleDay(day: keyof WorkingHours) {
    setHours((prev) => {
      if (isDayActive(day)) {
        const next = { ...prev }
        delete next[day]
        return next
      }
      return { ...prev, [day]: [{ start: '08:00', end: '18:00' }] }
    })
  }

  function addSlot(day: keyof WorkingHours) {
    setHours((prev) => ({
      ...prev,
      [day]: [...(prev[day] ?? []), { start: '08:00', end: '18:00' }],
    }))
  }

  function removeSlot(day: keyof WorkingHours, index: number) {
    setHours((prev) => {
      const slots = (prev[day] ?? []).filter((_, i) => i !== index)
      if (slots.length === 0) {
        const next = { ...prev }
        delete next[day]
        return next
      }
      return { ...prev, [day]: slots }
    })
  }

  function updateSlot(day: keyof WorkingHours, index: number, field: keyof WorkingHoursSlot, value: string) {
    setHours((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot,
      ),
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      { workingHours: hours, timezone: timezone || undefined },
      {
        onSuccess: () => toast.success('Horários atualizados com sucesso!'),
        onError: () => toast.error('Erro ao salvar horários. Tente novamente.'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-mid" />
          Horários de atendimento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Fuso horário */}
          <div className="space-y-1.5">
            <Label htmlFor="sch-timezone">Fuso horário</Label>
            <Input
              id="sch-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Sao_Paulo"
              className="max-w-xs"
            />
            <p className="text-xs text-[#6c85a0]">Exemplo: America/Sao_Paulo, America/Manaus</p>
          </div>

          {/* Dias da semana */}
          <div className="space-y-3">
            {DAY_KEYS.map((day) => {
              const active = isDayActive(day)
              const slots = hours[day] ?? []

              return (
                <div key={day} className="rounded-lg border border-[#e8dfc8] overflow-hidden">
                  {/* Linha do dia */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#f5f0e8]">
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={[
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                        active ? 'bg-amber-bright' : 'bg-gray-200',
                      ].join(' ')}
                      aria-label={`${active ? 'Desativar' : 'Ativar'} ${DAY_LABELS[day]}`}
                    >
                      <span
                        className={[
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                          active ? 'translate-x-5' : 'translate-x-0',
                        ].join(' ')}
                      />
                    </button>
                    <span className={`text-sm font-medium ${active ? 'text-amber-dark' : 'text-[#6c85a0]'}`}>
                      {DAY_LABELS[day]}
                    </span>
                    {!active && (
                      <span className="text-xs text-[#6c85a0] ml-auto">Fechado</span>
                    )}
                    {active && (
                      <button
                        type="button"
                        onClick={() => addSlot(day)}
                        className="ml-auto flex items-center gap-1 text-xs text-amber-mid hover:text-amber-dark transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar intervalo
                      </button>
                    )}
                  </div>

                  {/* Intervalos */}
                  {active && slots.length > 0 && (
                    <div className="px-4 py-3 space-y-2 bg-white">
                      {slots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateSlot(day, idx, 'start', e.target.value)}
                              className="w-32"
                              aria-label={`Início do intervalo ${idx + 1} de ${DAY_LABELS[day]}`}
                            />
                            <span className="text-[#6c85a0] text-sm">até</span>
                            <Input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateSlot(day, idx, 'end', e.target.value)}
                              className="w-32"
                              aria-label={`Fim do intervalo ${idx + 1} de ${DAY_LABELS[day]}`}
                            />
                          </div>
                          {slots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSlot(day, idx)}
                              className="p-1 text-[#6c85a0] hover:text-red-500 transition-colors"
                              aria-label="Remover intervalo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={mutation.isPending}>
              Salvar horários
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Seção 3: Branding ────────────────────────────────────────────────────────

interface BrandingSectionProps {
  primaryColor: string | null
  logoUrl: string | null
}

function BrandingSection({ primaryColor: initColor, logoUrl: initLogoUrl }: BrandingSectionProps) {
  const [primaryColor, setPrimaryColor] = React.useState(initColor ?? '#fabe01')
  const [logoUrl, setLogoUrl] = React.useState(initLogoUrl ?? '')
  const [colorError, setColorError] = React.useState('')

  const mutation = useUpdateBrandingSettings()

  const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

  function handleColorChange(value: string) {
    setPrimaryColor(value)
    if (value && !COLOR_REGEX.test(value)) {
      setColorError('Formato inválido. Use #RRGGBB (ex: #fabe01)')
    } else {
      setColorError('')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (colorError) return

    mutation.mutate(
      {
        primaryColor: primaryColor || undefined,
        logoUrl: logoUrl || null,
      },
      {
        onSuccess: () => toast.success('Branding atualizado com sucesso!'),
        onError: () => toast.error('Erro ao salvar branding. Tente novamente.'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Palette className="w-5 h-5 text-amber-mid" />
          Identidade visual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cor primária */}
          <div className="space-y-1.5">
            <Label htmlFor="br-color-text">Cor principal da marca</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={COLOR_REGEX.test(primaryColor) ? primaryColor : '#fabe01'}
                onChange={(e) => handleColorChange(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-[#e8dfc8] p-1"
                aria-label="Seletor de cor"
              />
              <Input
                id="br-color-text"
                value={primaryColor}
                onChange={(e) => handleColorChange(e.target.value)}
                placeholder="#fabe01"
                className="max-w-[160px] font-mono"
                error={!!colorError}
              />
              {COLOR_REGEX.test(primaryColor) && (
                <span
                  className="h-8 w-8 rounded-full border border-[#e8dfc8] shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                  title="Pré-visualização da cor"
                />
              )}
            </div>
            {colorError && <p className="text-xs text-red-500">{colorError}</p>}
          </div>

          {/* URL do logo */}
          <div className="space-y-1.5">
            <Label htmlFor="br-logo">URL do logotipo</Label>
            <Input
              id="br-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://exemplo.com/logo.png"
            />
            <p className="text-xs text-[#6c85a0]">Link público para a imagem do logotipo do consultório.</p>
            {logoUrl && (
              <div className="mt-2 p-3 rounded-lg border border-[#e8dfc8] bg-[#f5f0e8] inline-block">
                <img
                  src={logoUrl}
                  alt="Pré-visualização do logotipo"
                  className="h-12 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={mutation.isPending} disabled={!!colorError}>
              Salvar branding
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Seção 4: Agente WhatsApp ─────────────────────────────────────────────────

interface AgentSectionProps {
  enabled: boolean
  bookingMode: 'link' | 'chat' | 'both'
  welcomeMessage: string | null
  personality: string | null
  faq: string | null
  appointmentRules: string | null
}

function AgentSection({
  enabled: initEnabled,
  bookingMode: initBookingMode,
  welcomeMessage: initWelcomeMsg,
  personality: initPersonality,
  faq: initFaq,
  appointmentRules: initRules,
}: AgentSectionProps) {
  const [enabled, setEnabled] = React.useState(initEnabled)
  const [bookingMode, setBookingMode] = React.useState<'link' | 'chat' | 'both'>(initBookingMode)
  const [welcomeMessage, setWelcomeMessage] = React.useState(initWelcomeMsg ?? '')
  const [personality, setPersonality] = React.useState(initPersonality ?? '')
  const [faq, setFaq] = React.useState(initFaq ?? '')
  const [appointmentRules, setAppointmentRules] = React.useState(initRules ?? '')

  const mutation = useUpdateAgentSettings()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        enabled,
        bookingMode,
        welcomeMessage: welcomeMessage || null,
        personality: personality || null,
        faq: faq || null,
        appointmentRules: appointmentRules || null,
      },
      {
        onSuccess: () => toast.success('Configurações do agente salvas com sucesso!'),
        onError: () => toast.error('Erro ao salvar configurações do agente. Tente novamente.'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="w-5 h-5 text-amber-mid" />
          Agente WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Toggle agente ativo */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-[#e8dfc8] bg-[#f5f0e8]">
            <div>
              <p className="text-sm font-medium text-amber-dark">Agente ativo</p>
              <p className="text-xs text-[#6c85a0] mt-0.5">
                Quando ativo, o agente responde automaticamente no WhatsApp
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                enabled ? 'bg-amber-bright' : 'bg-gray-200',
              ].join(' ')}
              aria-label={enabled ? 'Desativar agente' : 'Ativar agente'}
            >
              <span
                className={[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                  enabled ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Modo de agendamento */}
          <div className="space-y-1.5">
            <Label>Modo de agendamento</Label>
            <Select value={bookingMode} onValueChange={(v) => setBookingMode(v as 'link' | 'chat' | 'both')}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Selecionar modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="link">{BOOKING_MODE_LABELS.link}</SelectItem>
                <SelectItem value="chat">{BOOKING_MODE_LABELS.chat}</SelectItem>
                <SelectItem value="both">{BOOKING_MODE_LABELS.both}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6c85a0]">
              Define como o agente encaminha pedidos de agendamento.
            </p>
          </div>

          {/* Mensagem de boas-vindas */}
          <div className="space-y-1.5">
            <Label htmlFor="ag-welcome">Mensagem de boas-vindas</Label>
            <Textarea
              id="ag-welcome"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Olá! Sou o assistente do consultório. Como posso ajudar?"
              rows={3}
              maxLength={1000}
              className="border-[#e8dfc8] focus-visible:ring-amber-dark/30"
            />
            <p className="text-xs text-[#6c85a0] text-right">{welcomeMessage.length}/1000</p>
          </div>

          {/* Personalidade */}
          <div className="space-y-1.5">
            <Label htmlFor="ag-personality">Personalidade do agente</Label>
            <Textarea
              id="ag-personality"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Descreva como o agente deve se comportar e comunicar com os pacientes..."
              rows={4}
              maxLength={2000}
              className="border-[#e8dfc8] focus-visible:ring-amber-dark/30"
            />
            <p className="text-xs text-[#6c85a0] text-right">{personality.length}/2000</p>
          </div>

          {/* FAQ */}
          <div className="space-y-1.5">
            <Label htmlFor="ag-faq">Perguntas frequentes (FAQ)</Label>
            <Textarea
              id="ag-faq"
              value={faq}
              onChange={(e) => setFaq(e.target.value)}
              placeholder="Liste as perguntas e respostas mais comuns sobre o consultório..."
              rows={5}
              maxLength={5000}
              className="border-[#e8dfc8] focus-visible:ring-amber-dark/30"
            />
            <p className="text-xs text-[#6c85a0] text-right">{faq.length}/5000</p>
          </div>

          {/* Regras de agendamento */}
          <div className="space-y-1.5">
            <Label htmlFor="ag-rules">Regras de agendamento</Label>
            <Textarea
              id="ag-rules"
              value={appointmentRules}
              onChange={(e) => setAppointmentRules(e.target.value)}
              placeholder="Descreva as regras de agendamento: antecedência mínima, cancelamento, documentos necessários..."
              rows={4}
              maxLength={3000}
              className="border-[#e8dfc8] focus-visible:ring-amber-dark/30"
            />
            <p className="text-xs text-[#6c85a0] text-right">{appointmentRules.length}/3000</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={mutation.isPending}>
              Salvar configurações do agente
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-48" />
      </div>
      <Skeleton className="h-9 w-96" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <Skeleton className="h-10 w-1/2" />
          <div className="flex justify-end">
            <Skeleton className="h-10 w-28" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function DoctorSettingsPage() {
  const profileQuery = useQuery(profileSettingsQueryOptions())
  const agentQuery = useQuery(agentSettingsQueryOptions())

  const isLoading = profileQuery.isLoading || agentQuery.isLoading
  const isError = profileQuery.isError || agentQuery.isError

  if (isLoading) return <SettingsSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Settings className="w-10 h-10 text-amber-bright opacity-50 mb-4" />
        <p className="text-amber-dark font-medium">Erro ao carregar as configurações</p>
        <p className="text-sm text-[#6c85a0] mt-1">Recarregue a página ou tente novamente.</p>
      </div>
    )
  }

  const profile = profileQuery.data!
  const agent = agentQuery.data!

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-amber-dark font-heading flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Configurações
        </h1>
        <p className="text-sm text-[#6c85a0] mt-1">
          Gerencie os dados do consultório, horários, identidade visual e o agente WhatsApp
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="profile">Dados do doutor</TabsTrigger>
          <TabsTrigger value="schedule">Horários</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="agent">Agente WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection
            name={profile.name}
            specialty={profile.specialty}
            phone={profile.phone}
            email={profile.email}
            crm={profile.crm}
            crmState={profile.crmState}
          />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleSection
            workingHours={profile.workingHours}
            timezone={profile.timezone}
          />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingSection
            primaryColor={profile.branding.primaryColor}
            logoUrl={profile.branding.logoUrl}
          />
        </TabsContent>

        <TabsContent value="agent">
          <AgentSection
            enabled={agent.enabled}
            bookingMode={agent.bookingMode}
            welcomeMessage={agent.welcomeMessage}
            personality={agent.personality}
            faq={agent.faq}
            appointmentRules={agent.appointmentRules}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
