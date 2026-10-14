import { useEffect, type ReactNode } from 'react'
import { applyTheme, resolveMode } from '../theme/apply'
import { useUI } from '../store/ui'
import { useSettings } from '../api/hooks'
import { AMBERX_FALLBACK } from '../theme/generate'

/** Applies the active theme (or the admin's preview theme) to the document root. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorMode = useUI((s) => s.colorMode)
  const preview = useUI((s) => s.previewTheme)
  const galleryTheme = useUI((s) => s.galleryTheme)
  const { data } = useSettings()
  const theme = preview ?? galleryTheme ?? data?.theme ?? AMBERX_FALLBACK

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => applyTheme(theme, resolveMode(colorMode))
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme, colorMode])

  useEffect(() => {
    if (data?.settings.siteTitle) document.title = `${data.settings.siteTitle} · ${data.settings.brandName}`
  }, [data?.settings.siteTitle, data?.settings.brandName])

  return <>{children}</>
}
