import { useEffect } from 'react'
import type { Theme } from '../api/types'
import { useUI } from '../store/ui'

/** Applies a gallery's own theme while its pages are mounted. */
export function useGalleryTheme(theme: Theme | null | undefined) {
  const set = useUI((s) => s.setGalleryTheme)
  useEffect(() => {
    if (!theme) {
      set(null)
      return
    }
    const { id: _i, createdAt: _c, builtIn: _b, ...draft } = theme
    set(draft)
    return () => set(null)
  }, [theme, set])
}
