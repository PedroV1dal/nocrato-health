import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgencyMember, Doctor, UserType } from '@/types/api'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AgencyMember | Doctor | null
  userType: UserType | null
  tenantId: string | null

  setAuth: (data: {
    accessToken: string
    refreshToken: string
    user: AgencyMember | Doctor
    userType: UserType
    tenantId?: string
  }) => void
  clearAuth: () => void
  updateTokens: (tokens: { accessToken: string; refreshToken: string }) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      userType: null,
      tenantId: null,

      setAuth: ({ accessToken, refreshToken, user, userType, tenantId }) =>
        set({ accessToken, refreshToken, user, userType, tenantId: tenantId ?? null }),

      clearAuth: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          userType: null,
          tenantId: null,
        }),

      updateTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
    }),
    { name: 'nocrato-auth' },
  ),
)
