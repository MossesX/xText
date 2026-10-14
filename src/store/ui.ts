import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ColorMode } from '../theme/apply'
import type { ThemeDraft } from '../api/types'

interface UIState {
  colorMode: ColorMode
  setColorMode: (m: ColorMode) => void
  /** Admin theme preview: temporarily apply a theme without saving it. */
  previewTheme: ThemeDraft | null
  setPreviewTheme: (t: ThemeDraft | null) => void
  /** Theme of the gallery currently being browsed, if it has one. */
  galleryTheme: ThemeDraft | null
  setGalleryTheme: (t: ThemeDraft | null) => void
  toast: { id: number; message: string; tone: 'info' | 'error' | 'success' } | null
  notify: (message: string, tone?: 'info' | 'error' | 'success') => void
  dismissToast: () => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      colorMode: 'system',
      setColorMode: (colorMode) => set({ colorMode }),
      previewTheme: null,
      setPreviewTheme: (previewTheme) => set({ previewTheme }),
      galleryTheme: null,
      setGalleryTheme: (galleryTheme) => set({ galleryTheme }),
      toast: null,
      notify: (message, tone = 'info') => set({ toast: { id: Date.now(), message, tone } }),
      dismissToast: () => set({ toast: null }),
    }),
    { name: 'xgallery-ui', partialize: (s) => ({ colorMode: s.colorMode }) },
  ),
)
