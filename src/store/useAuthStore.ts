import { create } from 'zustand'
import type { AuthUser } from '../types/giapha'
import * as api from '../services/api'

interface AuthState {
  user: AuthUser | null
  setupNeeded: boolean
  loading: boolean
  error: string | null

  checkAuth: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  setupFirstAdmin: (username: string, password: string, email: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setupNeeded: false,
  loading: false,
  error: null,

  checkAuth: async () => {
    set({ loading: true })
    try {
      const { user, setupNeeded } = await api.getAuthMe()
      set({ user, setupNeeded, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const { user } = await api.login(username, password)
      set({ user, loading: false, setupNeeded: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  setupFirstAdmin: async (username, password, email) => {
    set({ loading: true, error: null })
    try {
      const { user } = await api.setupFirstAdmin(username, password, email)
      set({ user, loading: false, setupNeeded: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  logout: async () => {
    await api.logout()
    set({ user: null })
  },

  clearError: () => set({ error: null }),
}))
