import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db } from '../db/db'
import type { User } from '../db/types'
import { login as doLogin } from '../lib/auth'

interface SessionState {
  user: User | null
  hydrated: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  refresh: () => Promise<void>
  markHydrated: () => void
}

type StoredSession = { userId: number | null }

export const useSession = create<SessionState & StoredSession>()(
  persist(
    (set, get) => ({
      user: null,
      userId: null,
      hydrated: false,
      async login(username, password) {
        const user = await doLogin(username, password)
        set({ user, userId: user.id ?? null })
        return user
      },
      logout() {
        set({ user: null, userId: null })
      },
      async refresh() {
        const id = get().userId
        if (id == null) {
          set({ user: null, hydrated: true })
          return
        }
        const user = await db.users.get(id)
        if (!user || user.disabled) set({ user: null, userId: null, hydrated: true })
        else set({ user, hydrated: true })
      },
      markHydrated() {
        set({ hydrated: true })
      },
    }),
    {
      name: 'lumen-session',
      partialize: (s) => ({ userId: s.userId }),
    },
  ),
)
