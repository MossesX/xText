import type { Palette, ThemeDraft } from '../api/types'
import { withAlpha } from './color'

export type ColorMode = 'light' | 'dark' | 'system'

export function resolveMode(mode: ColorMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const PALETTE_VARS: Record<keyof Palette, string> = {
  bg: '--c-bg',
  bgElevated: '--c-bg-elevated',
  surface: '--c-surface',
  surfaceHover: '--c-surface-hover',
  border: '--c-border',
  text: '--c-text',
  textMuted: '--c-text-muted',
  primary: '--c-primary',
  primaryText: '--c-primary-text',
  accent: '--c-accent',
  accentText: '--c-accent-text',
  danger: '--c-danger',
  success: '--c-success',
}

export function paletteToVars(p: Palette): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const key of Object.keys(PALETTE_VARS) as (keyof Palette)[]) {
    vars[PALETTE_VARS[key]] = p[key]
  }
  vars['--c-primary-soft'] = withAlpha(p.primary, 0.14)
  vars['--c-accent-soft'] = withAlpha(p.accent, 0.16)
  vars['--c-shadow'] = withAlpha(p.text, 0.12)
  vars['--c-overlay'] = withAlpha('#000000', 0.55)
  return vars
}

export function themeToVars(theme: ThemeDraft, mode: 'light' | 'dark'): Record<string, string> {
  return {
    ...paletteToVars(mode === 'dark' ? theme.dark : theme.light),
    '--font-display': `'${theme.fontDisplay}', 'Sora', sans-serif`,
    '--font-body': `'${theme.fontBody}', system-ui, sans-serif`,
    '--radius': `${theme.radius}px`,
    '--radius-sm': `${Math.max(2, theme.radius / 2)}px`,
    '--scale': String(theme.scale),
  }
}

export function applyTheme(theme: ThemeDraft, mode: 'light' | 'dark', el: HTMLElement = document.documentElement): void {
  const vars = themeToVars(theme, mode)
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
  el.dataset.mode = mode
  el.style.colorScheme = mode
  if (!el.dataset.themed) {
    el.dataset.themed = '1'
    // Enable colour transitions only after the first paint so the initial theme never animates in.
    requestAnimationFrame(() => requestAnimationFrame(() => (el.dataset.transitions = '1')))
  }
}
