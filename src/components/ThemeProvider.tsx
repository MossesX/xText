import { useEffect, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { applyTheme, resolveMode } from '../theme/apply'
import { useUI } from '../store/ui'
import { getSiteSettings } from '../lib/settings'
import { PRESET_THEMES } from '../theme/generate'

/** Applies the active theme (or the admin's preview theme) to the document root. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorMode = useUI((s) => s.colorMode)
  const previewThemeId = useUI((s) => s.previewThemeId)
  const settings = useLiveQuery(() => getSiteSettings(), [])
  const themeId = previewThemeId ?? settings?.activeThemeId ?? null
  const theme = useLiveQuery(async () => (themeId == null ? undefined : db.themes.get(themeId)), [themeId])

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const t = theme ?? { ...PRESET_THEMES[0], createdAt: 0 }
      applyTheme(t, resolveMode(colorMode))
    }
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme, colorMode])

  return <>{children}</>
}
