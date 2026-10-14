import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useAlbums, useSettings, useUpdateSettings } from '../../api/hooks'
import type { SiteSettings } from '../../api/types'
import { LayoutEditor } from '../../components/LayoutEditor'
import { useUI } from '../../store/ui'

export function AppearancePage() {
  const notify = useUI((s) => s.notify)
  const qc = useQueryClient()
  const { data: site } = useSettings()
  const { data: albumsData } = useAlbums({ sort: 'manual' })
  const update = useUpdateSettings()
  const [draft, setDraft] = useState<SiteSettings | null>(null)
  useEffect(() => {
    if (site && !draft) setDraft(site.settings)
  }, [site, draft])

  const overrides = albumsData?.albums.filter((a) => a.layoutOverride) ?? []
  const clearOverrides = useMutation({
    mutationFn: () => Promise.all(overrides.map((a) => api.put(`/api/albums/${a.id}`, { layoutOverride: null }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['albums'] })
      notify('All albums now use the default layout', 'success')
    },
  })

  if (!draft) return null

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div>
        <div className="eyebrow">Design</div>
        <h1 style={{ margin: 0 }}>Appearance</h1>
      </div>

      <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
        <h3>Identity</h3>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="field grow">
            <label>Site title</label>
            <input className="input" value={draft.siteTitle} onChange={(e) => setDraft({ ...draft, siteTitle: e.target.value })} />
          </div>
          <div className="field grow">
            <label>Brand name</label>
            <input className="input" value={draft.brandName} onChange={(e) => setDraft({ ...draft, brandName: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Tagline</label>
          <input className="input" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
        </div>
        <div className="field">
          <label>Hero gallery on the home page</label>
          <select className="select" value={draft.heroAlbumId ?? ''} onChange={(e) => setDraft({ ...draft, heroAlbumId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Automatic (first featured gallery)</option>
            {albumsData?.albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
                {a.visibility === 'draft' ? ' (draft)' : ''}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
        <h3>Community</h3>
        <div className="row" style={{ gap: 'calc(var(--space) * 3)' }}>
          <label className="checkbox">
            <input type="checkbox" checked={draft.allowLikes} onChange={(e) => setDraft({ ...draft, allowLikes: e.target.checked })} /> Members can like media
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={draft.allowComments} onChange={(e) => setDraft({ ...draft, allowComments: e.target.checked })} /> Members can comment
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={draft.allowDownloads} onChange={(e) => setDraft({ ...draft, allowDownloads: e.target.checked })} /> Allow downloads of originals
          </label>
        </div>
      </section>

      <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Default album layout</h3>
          <span className="muted small">{overrides.length ? `${overrides.length} album(s) override this` : 'All albums use this layout'}</span>
        </div>
        <LayoutEditor value={draft.defaultLayout} onChange={(defaultLayout) => setDraft({ ...draft, defaultLayout })} />
        {overrides.length > 0 && (
          <div className="row between" style={{ borderTop: '1px solid var(--c-border)', paddingTop: 12 }}>
            <span className="muted small">Overrides: {overrides.map((a) => `${a.title} (${a.layoutOverride!.kind})`).join(', ')}</span>
            <button className="btn ghost sm danger" onClick={() => confirm(`Reset ${overrides.length} album layout override(s)?`) && clearOverrides.mutate()}>
              Reset all to default
            </button>
          </div>
        )}
      </section>

      <div>
        <button className="btn primary lg" disabled={update.isPending} onClick={() => update.mutate(draft, { onSuccess: () => notify('Appearance saved', 'success'), onError: (e: Error) => notify(e.message, 'error') })}>
          Save appearance
        </button>
      </div>
    </div>
  )
}
