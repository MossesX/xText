import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ColorMode } from '../theme/apply'

interface UIState {
  colorMode: ColorMode
  setColorMode: (m: ColorMode) => void
  /** Admin theme preview: temporarily apply a theme without saving it. */
  previewThemeId: number | null
  setPreviewThemeId: (id: number | null) => void
  toast: { id: number; message: string; tone: 'info' | 'error' | 'success' } | null
  notify: (message: string, tone?: 'info' | 'error' | 'success') => void
  dismissToast: () => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      colorMode: 'system',
      setColorMode: (colorMode) => set({ colorMode }),
      previewThemeId: null,
      setPreviewThemeId: (previewThemeId) => set({ previewThemeId }),
      toast: null,
      notify: (message, tone = 'info') => set({ toast: { id: Date.now(), message, tone } }),
      dismissToast: () => set({ toast: null }),
    }),
    { name: 'lumen-ui', partialize: (s) => ({ colorMode: s.colorMode }) },
  ),
)
