import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type {
  OnboardingStatus,
  WorkingHours,
  CompleteOnboardingResponse,
  ProfileResponseDto,
  AgentSettingsResponseDto,
  UpdateProfileSettingsDto,
  UpdateBrandingSettingsDto,
  UpdateAgentSettingsV2Dto,
} from '@/types/api'

// ─── Queries ─────────────────────────────────────────────────────────────────

export const onboardingStatusQueryOptions = () =>
  queryOptions<OnboardingStatus>({
    queryKey: ['doctor', 'onboarding', 'status'],
    queryFn: () => api.get<OnboardingStatus>('/api/v1/doctor/onboarding/status'),
  })

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  name: string
  crm: string
  crmState: string
  specialty?: string
  phone?: string
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateProfilePayload) =>
      api.patch('/api/v1/doctor/onboarding/profile', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor', 'onboarding', 'status'] })
    },
  })
}

export interface UpdateSchedulePayload {
  workingHours: WorkingHours
  timezone: string
  appointmentDuration: number
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateSchedulePayload) =>
      api.patch('/api/v1/doctor/onboarding/schedule', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor', 'onboarding', 'status'] })
    },
  })
}

export interface UpdateBrandingPayload {
  primaryColor?: string
  logoUrl?: string
}

export function useUpdateBranding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateBrandingPayload) =>
      api.patch('/api/v1/doctor/onboarding/branding', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor', 'onboarding', 'status'] })
    },
  })
}

export interface UpdateAgentPayload {
  welcomeMessage: string
  personality?: string
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateAgentPayload) =>
      api.patch('/api/v1/doctor/onboarding/agent', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor', 'onboarding', 'status'] })
    },
  })
}

export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: () => api.post<CompleteOnboardingResponse>('/api/v1/doctor/onboarding/complete'),
  })
}

// ─── Settings (US-8.3) ────────────────────────────────────────────────────────

export const profileSettingsQueryOptions = () =>
  queryOptions<ProfileResponseDto>({
    queryKey: ['doctor', 'profile-settings'],
    queryFn: () => api.get<ProfileResponseDto>('/api/v1/doctor/profile'),
  })

export const agentSettingsQueryOptions = () =>
  queryOptions<AgentSettingsResponseDto>({
    queryKey: ['doctor', 'agent-settings'],
    queryFn: () => api.get<AgentSettingsResponseDto>('/api/v1/doctor/agent-settings'),
  })

export function useUpdateProfileSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateProfileSettingsDto) =>
      api.patch<ProfileResponseDto>('/api/v1/doctor/profile', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor', 'profile-settings'] })
    },
  })
}

export function useUpdateBrandingSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateBrandingSettingsDto) =>
      api.patch<{ primaryColor: string | null; logoUrl: string | null }>(
        '/api/v1/doctor/profile/branding',
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor', 'profile-settings'] })
    },
  })
}

export function useUpdateAgentSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateAgentSettingsV2Dto) =>
      api.patch<AgentSettingsResponseDto>('/api/v1/doctor/agent-settings', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor', 'agent-settings'] })
    },
  })
}
