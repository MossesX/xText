import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Copy, Dices, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../../db/db'
import { getSiteSettings, updateSiteSettings } from '../../lib/settings'
import { rollTheme } from '../../theme/generate'
import { Modal } from '../../components/Modal'
import { ThemeEditor, type ThemeDraft } from '../../components/ThemeEditor'
import { useUI } from '../../store/ui'
import type { Theme } from '../../db/types'

export function ThemesPage() {
  const notify = useUI((s) => s.notify)
  const previewThemeId = useUI((s) => s.previewThemeId)
  const setPreview = useUI((s) => s.setPreviewThemeId)
  const themes = useLiveQuery(() => db.themes.orderBy('createdAt').toArray(), [])
  const settings = useLiveQuery(() => getSiteSettings(), [])
  const [editing, setEditing] = useState<{ id?: number; draft: ThemeDraft } | null>(null)

  useEffect(() => () => setPreview(null), [setPreview])

  const activate = async (id: number) => {
    await updateSiteSettings({ activeThemeId: id })
    setPreview(null)
    notify('Theme activated', 'success')
  }

  const roll = async () => {
    const t = rollTheme()
    const id = (await db.themes.add({ ...t, createdAt: Date.now() })) as number
    setPreview(id)
    notify(`Rolled "${t.name}" — previewing. Activate to keep it.`)
  }

  const duplicate = async (t: Theme) => {
    const { id: _id, createdAt: _c, builtIn: _b, ...rest } = t
    await db.themes.add({ ...rest, name: `${t.name} copy`, createdAt: Date.now() })
  }

  const remove = async (t: Theme) => {
    if (settings?.activeThemeId === t.id) {
      notify('Deactivate this theme before deleting it', 'error')
      return
    }
    if (!confirm(`Delete theme "${t.name}"?`)) return
    await db.themes.delete(t.id!)
    if (previewThemeId === t.id) setPreview(null)
  }

  const save = async () => {
    if (!editing) return
    if (editing.id != null) await db.themes.update(editing.id, editing.draft)
    else {
      const id = (await db.themes.add({ ...editing.draft, createdAt: Date.now() })) as number
      setPreview(id)
    }
    setEditing(null)
    notify('Theme saved', 'success')
  }

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row between">
        <div>
          <div className="eyebrow">Design</div>
          <h1 style={{ margin: 0 }}>Themes</h1>
        </div>
        <div className="row">
          <button className="btn accent" onClick={roll}>
            <Dices size={16} /> Roll a theme
          </button>
          <button className="btn primary" onClick={() => setEditing({ draft: { ...rollTheme(), name: 'New theme' } })}>
            <Plus size={16} /> New theme
          </button>
        </div>
      </div>
      <p className="muted">
        Every theme carries both a light and a dark palette. Members choose light, dark or system on their own device. Hover a theme to preview it; activate to apply it site-wide.
      </p>
      {previewThemeId != null && (
        <div className="row card" style={{ padding: 12, justifyContent: 'space-between' }}>
          <span>
            <Eye size={14} /> Previewing <strong>{themes?.find((t) => t.id === previewThemeId)?.name}</strong>
          </span>
          <div className="row">
            <button className="btn sm" onClick={() => setPreview(null)}>
              Stop preview
            </button>
            <button className="btn primary sm" onClick={() => activate(previewThemeId)}>
              <Check size={14} /> Activate
            </button>
          </div>
        </div>
      )}
      <div className="theme-grid">
        {themes?.map((t) => {
          const active = settings?.activeThemeId === t.id
          return (
            <div key={t.id} className={`card theme-card ${active ? 'active' : ''}`}>
              <div className="theme-swatches">
                {[t.light.bg, t.light.surface, t.light.primary, t.light.accent, t.light.text].map((c, i) => (
                  <div key={`l${i}`} style={{ background: c }} />
                ))}
                {[t.dark.text, t.dark.accent, t.dark.primary, t.dark.surface, t.dark.bg].map((c, i) => (
                  <div key={`d${i}`} style={{ background: c }} />
                ))}
              </div>
              <div className="body stack" style={{ gap: 8 }}>
                <div className="row between">
                  <strong style={{ fontFamily: `'${t.fontDisplay}', serif`, fontSize: '1.15rem' }}>{t.name}</strong>
                  {active && <span className="badge primary">Active</span>}
                </div>
                <div className="muted small">
                  {t.fontDisplay} / {t.fontBody} · radius {t.radius}px
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {!active && (
                    <button className="btn primary sm" onClick={() => activate(t.id!)}>
                      Activate
                    </button>
                  )}
                  <button className="btn sm" onClick={() => setPreview(previewThemeId === t.id ? null : t.id!)} title="Preview">
                    <Eye size={14} />
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => {
                      const { id, createdAt: _c, ...draft } = t
                      setEditing({ id, draft })
                    }}
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button className="btn sm" onClick={() => duplicate(t)} title="Duplicate">
                    <Copy size={14} />
                  </button>
                  <button className="btn sm danger" onClick={() => remove(t)} title="Delete" disabled={active}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id != null ? 'Edit theme' : 'New theme'} wide>
        {editing && (
          <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
            <ThemeEditor value={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} />
            <div className="row between">
              <button className="btn accent" onClick={() => setEditing({ ...editing, draft: { ...rollTheme(), name: editing.draft.name } })}>
                <Dices size={14} /> Re-roll colours
              </button>
              <div className="row">
                <button className="btn" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button className="btn primary" onClick={save} disabled={!editing.draft.name.trim()}>
                  Save theme
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
