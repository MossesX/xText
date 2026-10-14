import { CheckSquare, Square } from 'lucide-react'
import type { ReactNode } from 'react'

export interface CheckOption {
  id: number
  label: ReactNode
  hint?: ReactNode
}

interface Props {
  options: CheckOption[]
  selected: number[]
  onChange: (ids: number[]) => void
  emptyText?: string
  columns?: number
}

/** A list of checkboxes with check-all and uncheck-all, used wherever users or albums are picked. */
export function CheckList({ options, selected, onChange, emptyText = 'Nothing to choose from.', columns = 2 }: Props) {
  const set = new Set(selected)
  const all = options.length > 0 && options.every((o) => set.has(o.id))
  return (
    <div className="checklist">
      <div className="row between checklist-head">
        <span className="muted small">
          {selected.length} of {options.length} selected
        </span>
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className="btn ghost sm" disabled={all} onClick={() => onChange(options.map((o) => o.id))}>
            <CheckSquare size={14} /> Check all
          </button>
          <button type="button" className="btn ghost sm" disabled={selected.length === 0} onClick={() => onChange([])}>
            <Square size={14} /> Uncheck all
          </button>
        </div>
      </div>
      {options.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>{emptyText}</p>
      ) : (
        <div className="checklist-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${columns === 1 ? 100 : 200}px, 1fr))` }}>
          {options.map((o) => (
            <label key={o.id} className={`checklist-item ${set.has(o.id) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={set.has(o.id)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))}
              />
              <span className="grow">
                <span className="checklist-label">{o.label}</span>
                {o.hint && <span className="checklist-hint">{o.hint}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
