import { Dices } from 'lucide-react'
import type { CaptionMode, LayoutConfig, TileShape } from '../db/types'
import { LAYOUT_KINDS, rollLayout } from '../layouts/generate'

interface Props {
  value: LayoutConfig
  onChange: (next: LayoutConfig) => void
}

function Mini({ kind }: { kind: LayoutConfig['kind'] }) {
  switch (kind) {
    case 'masonry':
      return (
        <div className="mini" style={{ gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr' }}>
          <div style={{ gridRow: 'span 2' }} /><div /><div style={{ gridRow: 'span 3' }} /><div style={{ gridRow: 'span 2' }} /><div />
        </div>
      )
    case 'grid':
      return <div className="mini" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>{Array.from({ length: 6 }).map((_, i) => <div key={i} />)}</div>
    case 'justified':
      return (
        <div className="mini" style={{ gridTemplateColumns: '2fr 1fr 1.4fr', gridTemplateRows: '1fr 1fr' }}>
          <div /><div /><div /><div style={{ gridColumn: 'span 2' }} /><div />
        </div>
      )
    case 'mosaic':
      return (
        <div className="mini" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr 1fr' }}>
          <div style={{ gridRow: 'span 2', gridColumn: 'span 2' }} /><div /><div />
        </div>
      )
    case 'filmstrip':
      return <div className="mini" style={{ gridTemplateRows: '1fr 1fr' }}><div /><div /></div>
    case 'carousel':
      return <div className="mini" style={{ gridTemplateColumns: '0.3fr 2fr 0.3fr' }}><div style={{ opacity: 0.5 }} /><div /><div style={{ opacity: 0.5 }} /></div>
  }
}

export function LayoutEditor({ value, onChange }: Props) {
  const set = <K extends keyof LayoutConfig>(key: K, v: LayoutConfig[K]) => onChange({ ...value, [key]: v })
  const single = value.kind === 'filmstrip' || value.kind === 'carousel'
  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row between">
        <div className="eyebrow">Layout style</div>
        <button type="button" className="btn accent sm" onClick={() => onChange(rollLayout())}>
          <Dices size={14} /> Roll layout
        </button>
      </div>
      <div className="layout-picker">
        {LAYOUT_KINDS.map((k) => (
          <button type="button" key={k.kind} className={`layout-option ${value.kind === k.kind ? 'active' : ''}`} onClick={() => set('kind', k.kind)} title={k.blurb}>
            <Mini kind={k.kind} />
            <strong style={{ fontSize: '0.85rem' }}>{k.label}</strong>
          </button>
        ))}
      </div>
      <div className="layout-form">
        <div className="field">
          <label>Columns: {single ? '1' : value.columns}</label>
          <input type="range" min={2} max={6} value={value.columns} disabled={single} onChange={(e) => set('columns', Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Gap: {value.gap}px</label>
          <input type="range" min={0} max={40} step={2} value={value.gap} onChange={(e) => set('gap', Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Captions</label>
          <select className="select" value={value.caption} onChange={(e) => set('caption', e.target.value as CaptionMode)}>
            <option value="hover">Show on hover</option>
            <option value="overlay">Always overlay</option>
            <option value="below">Below tile</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
        <div className="field">
          <label>Tile shape</label>
          <select className="select" value={value.shape} disabled={value.kind !== 'grid'} onChange={(e) => set('shape', e.target.value as TileShape)}>
            <option value="natural">Natural</option>
            <option value="square">Square</option>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
            <option value="circle">Circle</option>
          </select>
          {value.kind !== 'grid' && <span className="muted small">Shape applies to the Grid layout.</span>}
        </div>
      </div>
      <div className="row" style={{ gap: 'calc(var(--space) * 3)' }}>
        <label className="checkbox"><input type="checkbox" checked={value.rounded} onChange={(e) => set('rounded', e.target.checked)} /> Rounded corners</label>
        <label className="checkbox"><input type="checkbox" checked={value.hoverZoom} onChange={(e) => set('hoverZoom', e.target.checked)} /> Hover zoom</label>
        <label className="checkbox"><input type="checkbox" checked={value.showLikes} onChange={(e) => set('showLikes', e.target.checked)} /> Show like counts</label>
        <label className="checkbox"><input type="checkbox" checked={value.heroCover} onChange={(e) => set('heroCover', e.target.checked)} /> Hero cover banner</label>
      </div>
    </div>
  )
}
