import { create } from "zustand"
import { api } from "@/lib/api"

export type User = {
  id: string
  email: string
  name: string
  role: string
}

type AuthState = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credential: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (credential: string) => {
    try {
      const response = await api.googleLogin(credential)
      if (response.success) {
        api.setToken(response.data.token)
        set({ user: response.data.user, isAuthenticated: true })
      }
    } catch (error) {
      console.error("Login failed:", error)
      throw error
    }
  },

  logout: () => {
    api.setToken(null)
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    const token = api.getToken()
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }

    try {
      const response = await api.getMe()
      if (response.success) {
        set({ user: response.data.user, isAuthenticated: true, isLoading: false })
      }
    } catch (error) {
      // Token invalid, clear it
      api.setToken(null)
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
