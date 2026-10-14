import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Copy, ExternalLink, Globe, Image as ImageIcon } from 'lucide-react'
import { api } from '../../api/client'
import { useAlbums, useGalleries, useGallery, useMe, useThemes } from '../../api/hooks'
import type { Gallery, MediaItem } from '../../api/types'
import { Modal } from '../../components/Modal'
import { PageLoader } from '../../components/Skeleton'
import { useUI } from '../../store/ui'

type Draft = Pick<Gallery, 'title' | 'slug' | 'tagline' | 'headline' | 'splashMediaId' | 'themeId' | 'publicAlbumId'>

/** An admin's own gallery: splash screen, theme and public album. Owners can pick any gallery. */
export function GallerySettingsPage() {
  const { data: me } = useMe()
  const { data: galleries } = useGalleries()
  const qc = useQueryClient()
  const notify = useUI((s) => s.notify)
  const mine = galleries?.filter((g) => g.isMine || me?.role === 'owner') ?? []
  const [selected, setSelected] = useState<number | null>(null)
  const galleryId = selected ?? mine.find((g) => g.isMine)?.id ?? mine[0]?.id ?? null
  const { data } = useGallery(galleryId != null ? String(galleryId) : undefined)
  const { data: themes } = useThemes()
  const { data: albumsData } = useAlbums({ gallery: galleryId != null ? String(galleryId) : undefined, sort: 'manual' })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerAlbum, setPickerAlbum] = useState<number | null>(null)
  const [pickerMedia, setPickerMedia] = useState<MediaItem[]>([])

  useEffect(() => {
    if (data) {
      const g = data.gallery
      setDraft({ title: g.title, slug: g.slug, tagline: g.tagline, headline: g.headline, splashMediaId: g.splashMediaId, themeId: g.themeId, publicAlbumId: g.publicAlbumId })
    }
  }, [data])

  useEffect(() => {
    if (pickerAlbum == null) return
    api.get<{ media: MediaItem[] }>(`/api/albums/${pickerAlbum}`).then((r) => setPickerMedia(r.media.filter((m) => m.kind === 'image')))
  }, [pickerAlbum])

  const save = useMutation({
    mutationFn: (d: Draft) => api.put(`/api/galleries/${galleryId}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gallery'] })
      qc.invalidateQueries({ queryKey: ['galleries'] })
      qc.invalidateQueries({ queryKey: ['albums'] })
      notify('Gallery saved', 'success')
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  if (!data || !draft) return <PageLoader />
  const g = data.gallery
  const publicUrl = `${location.origin}/public/${g.slug}`
  const albums = albumsData?.albums ?? []

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row between">
        <div>
          <div className="eyebrow">Control panel</div>
          <h1 style={{ margin: 0 }}>{g.title}</h1>
        </div>
        <div className="row">
          {me?.role === 'owner' && mine.length > 1 && (
            <select className="select" value={galleryId ?? ''} onChange={(e) => setSelected(Number(e.target.value))} style={{ width: 'auto' }}>
              {mine.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          )}
          <Link to={`/g/${g.slug}`} className="btn">
            <ExternalLink size={14} /> View gallery
          </Link>
        </div>
      </div>

      <div className="two-col">
        <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
          <h3>Splash screen</h3>
          <p className="muted small" style={{ margin: 0 }}>
            The first thing members and public visitors see on this gallery's landing page.
          </p>
          <div className="hero-feature" style={{ minHeight: 220, marginBottom: 0 }}>
            {g.splash && draft.splashMediaId === g.splashMediaId ? <img className="hero-bg" src={g.splash.thumbUrl ?? g.splash.url} alt="" /> : draft.splashMediaId == null ? null : null}
            <div className="hero-shade" />
            <div className="hero-content" style={{ padding: 24 }}>
              <div className="eyebrow light">Curated by {g.owner?.displayName}</div>
              <h2 style={{ color: '#fff', margin: '4px 0' }}>{draft.headline || draft.title}</h2>
              <p style={{ color: 'rgba(255,255,255,.85)', margin: 0 }}>{draft.tagline}</p>
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => { setPickerAlbum(albums[0]?.id ?? null); setPickerOpen(true) }} disabled={!albums.length}>
              <ImageIcon size={14} /> Choose splash image
            </button>
            {draft.splashMediaId != null && (
              <button className="btn ghost" onClick={() => setDraft({ ...draft, splashMediaId: null })}>
                Remove image
              </button>
            )}
          </div>
          <div className="field">
            <label>Headline (defaults to the gallery title)</label>
            <input className="input" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} placeholder={draft.title} />
          </div>
          <div className="field">
            <label>Tagline</label>
            <input className="input" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} placeholder="A line under the headline" />
          </div>
          <div className="field">
            <label>Colour theme for this gallery</label>
            <select className="select" value={draft.themeId ?? ''} onChange={(e) => setDraft({ ...draft, themeId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Site default</option>
              {themes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
          <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
            <h3>Identity</h3>
            <div className="field">
              <label>Gallery name</label>
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="field">
              <label>URL name</label>
              <input className="input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              <span className="muted small">{location.origin}/g/{draft.slug}</span>
            </div>
          </section>
          <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Public album</h3>
              {g.publicAlbum ? <span className="badge success">Visible to everyone</span> : <span className="badge">None</span>}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              One published album that anyone can view without an account, shown under the splash screen at the public link.
            </p>
            <select className="select" value={draft.publicAlbumId ?? ''} onChange={(e) => setDraft({ ...draft, publicAlbumId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">No public album</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.visibility === 'draft' ? ' (draft, publish it first)' : ''}
                </option>
              ))}
            </select>
            <div className="row">
              <input className="input grow" readOnly value={publicUrl} onFocus={(e) => e.target.select()} />
              <button className="btn icon" title="Copy" onClick={() => navigator.clipboard.writeText(publicUrl).then(() => notify('Public link copied', 'success'))}>
                <Copy size={14} />
              </button>
              <a className="btn icon" title="Open" href={publicUrl} target="_blank" rel="noreferrer">
                <Globe size={14} />
              </a>
            </div>
          </section>
        </div>
      </div>

      <div>
        <button className="btn primary lg" disabled={save.isPending || !draft.title.trim()} onClick={() => save.mutate(draft)}>
          Save gallery
        </button>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose a splash image" wide>
        <div className="stack">
          <select className="select" value={pickerAlbum ?? ''} onChange={(e) => setPickerAlbum(Number(e.target.value))}>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          {pickerMedia.length === 0 ? (
            <p className="muted small">No images in this album.</p>
          ) : (
            <div className="splash-picker">
              {pickerMedia.map((m) => (
                <button key={m.id} className={draft.splashMediaId === m.id ? 'on' : ''} onClick={() => { setDraft({ ...draft, splashMediaId: m.id }); setPickerOpen(false) }} title={m.title}>
                  <img src={m.thumbUrl ?? m.url} alt={m.title} />
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
