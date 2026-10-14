import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Dices, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../api/client'
import { keys, useSaveTheme, useSettings, useThemes, useUpdateSettings } from '../../api/hooks'
import type { Theme, ThemeDraft } from '../../api/types'
import { rollTheme } from '../../theme/generate'
import { Modal } from '../../components/Modal'
import { ThemeEditor } from '../../components/ThemeEditor'
import { useUI } from '../../store/ui'

export function ThemesPage() {
  const notify = useUI((s) => s.notify)
  const setPreview = useUI((s) => s.setPreviewTheme)
  const qc = useQueryClient()
  const { data: themes } = useThemes()
  const { data: site } = useSettings()
  const save = useSaveTheme()
  const updateSettings = useUpdateSettings()
  const [editing, setEditing] = useState<{ id?: number; draft: ThemeDraft } | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)

  useEffect(() => () => setPreview(null), [setPreview])

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/themes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.themes }),
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const activate = (id: number) => updateSettings.mutate({ activeThemeId: id }, { onSuccess: () => {
    setPreview(null)
    setPreviewId(null)
    notify('Theme activated for everyone', 'success')
  } })

  const startPreview = (t: Theme) => {
    if (previewId === t.id) {
      setPreview(null)
      setPreviewId(null)
    } else {
      const { id: _i, createdAt: _c, builtIn: _b, ...draft } = t
      setPreview(draft)
      setPreviewId(t.id)
    }
  }

  const roll = () => {
    const draft = rollTheme()
    setPreview(draft)
    setPreviewId(null)
    setEditing({ draft })
  }

  const duplicate = (t: Theme) => {
    const { id: _i, createdAt: _c, builtIn: _b, ...draft } = t
    save.mutate({ draft: { ...draft, name: `${t.name} copy` } })
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
        Every theme carries a light and a dark palette. Members pick light, dark or system on their own device. Preview applies only to you until you activate.
      </p>
      {previewId != null && (
        <div className="row card" style={{ padding: 12, justifyContent: 'space-between' }}>
          <span className="row" style={{ gap: 8 }}>
            <Eye size={14} /> Previewing <strong>{themes?.find((t) => t.id === previewId)?.name}</strong>
          </span>
          <div className="row">
            <button className="btn sm" onClick={() => { setPreview(null); setPreviewId(null) }}>
              Stop preview
            </button>
            <button className="btn primary sm" onClick={() => activate(previewId)}>
              <Check size={14} /> Activate
            </button>
          </div>
        </div>
      )}
      <div className="theme-grid">
        {themes?.map((t) => {
          const active = site?.settings.activeThemeId === t.id
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
                  <strong style={{ fontFamily: `'${t.fontDisplay}', sans-serif`, fontSize: '1.15rem' }}>{t.name}</strong>
                  {active && <span className="badge primary">Active</span>}
                  {!active && t.builtIn && <span className="badge">AmberX</span>}
                </div>
                <div className="muted small">
                  {t.fontDisplay} / {t.fontBody} · radius {t.radius}px
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {!active && (
                    <button className="btn primary sm" onClick={() => activate(t.id)}>
                      Activate
                    </button>
                  )}
                  <button className={`btn sm ${previewId === t.id ? 'accent' : ''}`} onClick={() => startPreview(t)} title="Preview">
                    <Eye size={14} />
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => {
                      const { id, createdAt: _c, builtIn: _b, ...draft } = t
                      setEditing({ id, draft })
                    }}
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button className="btn sm" onClick={() => duplicate(t)} title="Duplicate">
                    <Copy size={14} />
                  </button>
                  <button className="btn sm danger" onClick={() => confirm(`Delete theme "${t.name}"?`) && remove.mutate(t.id)} title="Delete" disabled={active}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={!!editing} onClose={() => { setEditing(null); if (previewId == null) setPreview(null) }} title={editing?.id != null ? 'Edit theme' : 'New theme'} wide>
        {editing && (
          <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
            <ThemeEditor value={editing.draft} onChange={(draft) => { setEditing({ ...editing, draft }); setPreview(draft) }} />
            <div className="row between">
              <button className="btn accent" onClick={() => { const d = { ...rollTheme(), name: editing.draft.name }; setEditing({ ...editing, draft: d }); setPreview(d) }}>
                <Dices size={14} /> Re-roll colours
              </button>
              <div className="row">
                <button className="btn" onClick={() => { setEditing(null); setPreview(null); setPreviewId(null) }}>
                  Cancel
                </button>
                <button
                  className="btn primary"
                  disabled={!editing.draft.name.trim() || save.isPending}
                  onClick={() =>
                    save.mutate(editing, {
                      onSuccess: () => {
                        setEditing(null)
                        setPreview(null)
                        setPreviewId(null)
                        notify('Theme saved', 'success')
                      },
                      onError: (e: Error) => notify(e.message, 'error'),
                    })
                  }
                >
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
