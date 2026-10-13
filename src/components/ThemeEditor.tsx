import type { Palette, Theme } from '../db/types'
import { FONT_CHOICES } from '../theme/generate'
import { paletteToVars } from '../theme/apply'
import type { CSSProperties } from 'react'

export type ThemeDraft = Omit<Theme, 'id' | 'createdAt'>

const PALETTE_LABELS: Record<keyof Palette, string> = {
  bg: 'Background',
  bgElevated: 'Elevated',
  surface: 'Surface',
  surfaceHover: 'Surface hover',
  border: 'Border',
  text: 'Text',
  textMuted: 'Muted text',
  primary: 'Primary',
  primaryText: 'On primary',
  accent: 'Accent',
  accentText: 'On accent',
  danger: 'Danger',
  success: 'Success',
}

function PaletteFields({ palette, onChange }: { palette: Palette; onChange: (p: Palette) => void }) {
  return (
    <div className="palette-editor">
      {(Object.keys(PALETTE_LABELS) as (keyof Palette)[]).map((k) => (
        <div className="field" key={k}>
          <label>{PALETTE_LABELS[k]}</label>
          <input type="color" value={palette[k]} onChange={(e) => onChange({ ...palette, [k]: e.target.value })} />
        </div>
      ))}
    </div>
  )
}

export function ThemePreview({ theme, mode }: { theme: ThemeDraft; mode: 'light' | 'dark' }) {
  const vars = {
    ...paletteToVars(mode === 'dark' ? theme.dark : theme.light),
    '--font-display': `'${theme.fontDisplay}', serif`,
    '--font-body': `'${theme.fontBody}', sans-serif`,
    '--radius': `${theme.radius}px`,
    '--radius-sm': `${Math.max(2, theme.radius / 2)}px`,
  } as CSSProperties
  return (
    <div className="theme-preview" style={vars}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{mode} preview</div>
      <h3 style={{ fontFamily: 'var(--font-display)' }}>{theme.name || 'Untitled theme'}</h3>
      <p className="muted small">Body text set in {theme.fontBody}. Headings use {theme.fontDisplay}.</p>
      <div className="row">
        <button type="button" className="btn primary sm">Primary</button>
        <button type="button" className="btn accent sm">Accent</button>
        <button type="button" className="btn sm">Default</button>
        <span className="badge primary">Badge</span>
      </div>
    </div>
  )
}

export function ThemeEditor({ value, onChange }: { value: ThemeDraft; onChange: (t: ThemeDraft) => void }) {
  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field grow">
          <label>Theme name</label>
          <input className="input" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Display font</label>
          <select className="select" value={value.fontDisplay} onChange={(e) => onChange({ ...value, fontDisplay: e.target.value })}>
            {FONT_CHOICES.display.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Body font</label>
          <select className="select" value={value.fontBody} onChange={(e) => onChange({ ...value, fontBody: e.target.value })}>
            {FONT_CHOICES.body.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div className="row" style={{ gap: 'calc(var(--space) * 3)' }}>
        <div className="field grow">
          <label>Corner radius: {value.radius}px</label>
          <input type="range" min={0} max={28} value={value.radius} onChange={(e) => onChange({ ...value, radius: Number(e.target.value) })} />
        </div>
        <div className="field grow">
          <label>Density scale: {value.scale.toFixed(2)}</label>
          <input type="range" min={0.85} max={1.15} step={0.05} value={value.scale} onChange={(e) => onChange({ ...value, scale: Number(e.target.value) })} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'calc(var(--space) * 3)' }}>
        <div className="stack">
          <div className="eyebrow">Light palette</div>
          <PaletteFields palette={value.light} onChange={(light) => onChange({ ...value, light })} />
          <ThemePreview theme={value} mode="light" />
        </div>
        <div className="stack">
          <div className="eyebrow">Dark palette</div>
          <PaletteFields palette={value.dark} onChange={(dark) => onChange({ ...value, dark })} />
          <ThemePreview theme={value} mode="dark" />
        </div>
      </div>
    </div>
  )
}
