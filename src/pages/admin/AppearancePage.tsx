import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getSiteSettings, updateSiteSettings } from '../../lib/settings'
import { LayoutEditor } from '../../components/LayoutEditor'
import { useUI } from '../../store/ui'
import type { SiteSettings } from '../../db/types'

export function AppearancePage() {
  const notify = useUI((s) => s.notify)
  const settings = useLiveQuery(() => getSiteSettings(), [])
  const overrides = useLiveQuery(() => db.albums.filter((a) => !!a.layoutOverride).toArray(), [])
  const [draft, setDraft] = useState<SiteSettings | null>(null)

  useEffect(() => {
    if (settings && !draft) setDraft(settings)
  }, [settings, draft])

  if (!draft) return null

  const save = async () => {
    await updateSiteSettings(draft)
    notify('Appearance saved', 'success')
  }

  const clearOverrides = async () => {
    if (!overrides?.length || !confirm(`Reset ${overrides.length} album layout override(s) to the default?`)) return
    await db.albums.bulkUpdate(overrides.map((a) => ({ key: a.id!, changes: { layoutOverride: null } })))
    notify('All albums now use the default layout', 'success')
  }

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div>
        <div className="eyebrow">Design</div>
        <h1 style={{ margin: 0 }}>Appearance</h1>
      </div>

      <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
        <h3>Site</h3>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="field grow">
            <label>Site title</label>
            <input className="input" value={draft.siteTitle} onChange={(e) => setDraft({ ...draft, siteTitle: e.target.value })} />
          </div>
          <div className="field grow">
            <label>Tagline</label>
            <input className="input" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
          </div>
        </div>
        <div className="row" style={{ gap: 'calc(var(--space) * 3)' }}>
          <label className="checkbox">
            <input type="checkbox" checked={draft.allowLikes} onChange={(e) => setDraft({ ...draft, allowLikes: e.target.checked })} /> Members can like media
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={draft.allowComments} onChange={(e) => setDraft({ ...draft, allowComments: e.target.checked })} /> Members can comment
          </label>
        </div>
      </section>

      <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Default album layout</h3>
          <span className="muted small">
            {overrides?.length ? `${overrides.length} album(s) override this` : 'All albums use this layout'}
          </span>
        </div>
        <LayoutEditor value={draft.defaultLayout} onChange={(defaultLayout) => setDraft({ ...draft, defaultLayout })} />
        {!!overrides?.length && (
          <div className="row between" style={{ borderTop: '1px solid var(--c-border)', paddingTop: 12 }}>
            <span className="muted small">Overrides: {overrides.map((a) => `${a.title} (${a.layoutOverride!.kind})`).join(', ')}</span>
            <button className="btn ghost sm danger" onClick={clearOverrides}>
              Reset all to default
            </button>
          </div>
        )}
      </section>

      <div>
        <button className="btn primary" onClick={save}>
          Save appearance
        </button>
      </div>
    </div>
  )
}
