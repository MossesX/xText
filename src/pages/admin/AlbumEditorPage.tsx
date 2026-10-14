import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowLeftRight, Copy, ExternalLink, GripVertical, Link2, Link2Off, Pencil, Star, Trash2 } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import { useAlbum, useSettings } from '../../api/hooks'
import type { Album, LayoutConfig, MediaItem } from '../../api/types'
import { MediaThumb } from '../../components/MediaThumb'
import { Modal } from '../../components/Modal'
import { LayoutEditor } from '../../components/LayoutEditor'
import { Uploader } from '../../components/Uploader'
import { PageLoader } from '../../components/Skeleton'
import { formatBytes, formatDuration } from '../../lib/media'
import { useUI } from '../../store/ui'

type Draft = Pick<Album, 'title' | 'slug' | 'description' | 'tags'>

export function AlbumEditorPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const notify = useUI((s) => s.notify)
  const { data: site } = useSettings()
  const { data, isLoading, error } = useAlbum(id)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [tagText, setTagText] = useState('')
  const [editing, setEditing] = useState<MediaItem | null>(null)
  const [layoutDraft, setLayoutDraft] = useState<LayoutConfig | null>(null)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [dragId, setDragId] = useState<number | null>(null)

  useEffect(() => {
    if (data && !draft) {
      setDraft({ title: data.album.title, slug: data.album.slug, description: data.album.description, tags: data.album.tags })
      setTagText(data.album.tags.join(', '))
    }
  }, [data, draft])
  useEffect(() => setMedia(data?.media ?? []), [data?.media])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['album'] })
    qc.invalidateQueries({ queryKey: ['albums'] })
  }
  const patch = useMutation({
    mutationFn: (p: Record<string, unknown>) => api.put<{ album: Album }>(`/api/albums/${id}`, p),
    onSuccess: refresh,
    onError: (e: Error) => notify(e.message, 'error'),
  })
  const share = useMutation({
    mutationFn: (enabled: boolean) => api.post<{ shareToken: string | null }>(`/api/albums/${id}/share`, { enabled }),
    onSuccess: (r) => {
      refresh()
      notify(r.shareToken ? 'Public share link enabled' : 'Share link turned off', 'success')
    },
  })
  const updateMedia = useMutation({
    mutationFn: (v: { id: number; title: string; description: string }) => api.put(`/api/media/${v.id}`, v),
    onSuccess: () => {
      refresh()
      setEditing(null)
    },
  })
  const removeMedia = useMutation({ mutationFn: (mid: number) => api.del(`/api/media/${mid}`), onSuccess: refresh })
  const reorder = useMutation({ mutationFn: (ids: number[]) => api.put('/api/media/reorder', { ids }), onSuccess: refresh })

  if (isLoading || !site) return <PageLoader />
  if (error instanceof ApiError && error.status === 404) return <Navigate to="/admin/albums" replace />
  if (!data || !draft) return <PageLoader />
  const { album } = data

  const saveDetails = () => {
    const tags = tagText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    patch.mutate({ ...draft, tags }, { onSuccess: () => notify('Album saved', 'success') })
  }

  const onDrop = (targetId: number) => {
    if (dragId == null || dragId === targetId) return
    const from = media.findIndex((m) => m.id === dragId)
    const to = media.findIndex((m) => m.id === targetId)
    const next = [...media]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setMedia(next)
    setDragId(null)
    reorder.mutate(next.map((m) => m.id))
  }

  const shareUrl = album.shareToken ? `${location.origin}/s/${album.shareToken}` : null

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row between">
        <div>
          <Link to="/admin/albums" className="btn ghost sm" style={{ marginLeft: -10 }}>
            <ArrowLeft size={14} /> Albums
          </Link>
          <h1 style={{ margin: '6px 0 0' }}>{album.title}</h1>
        </div>
        <div className="row">
          <Link to={`/album/${album.slug}`} className="btn">
            <ExternalLink size={14} /> View
          </Link>
          <button className={`btn ${album.featured ? 'accent' : ''}`} onClick={() => patch.mutate({ featured: !album.featured })}>
            <Star size={14} fill={album.featured ? 'currentColor' : 'none'} /> {album.featured ? 'Featured' : 'Feature'}
          </button>
          <button className={`btn ${album.visibility === 'published' ? '' : 'primary'}`} onClick={() => patch.mutate({ visibility: album.visibility === 'published' ? 'draft' : 'published' })}>
            {album.visibility === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="two-col">
        <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
          <h3>Details</h3>
          <div className="field">
            <label>Title</label>
            <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="field">
            <label>URL slug</label>
            <input className="input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Tags (comma separated)</label>
            <input className="input" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="travel, portraits, 35mm" />
          </div>
          <div>
            <button className="btn primary" onClick={saveDetails} disabled={!draft.title.trim() || patch.isPending}>
              Save details
            </button>
          </div>
        </section>

        <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
          <section className="card stack" style={{ gap: 'calc(var(--space) * 1.5)' }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Sharing</h3>
              {album.shareToken ? <span className="badge success">Public link on</span> : <span className="badge">Members only</span>}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              A public link lets anyone view this album without signing in, even while it is a draft. Likes and comments stay members-only.
            </p>
            {shareUrl && (
              <div className="row">
                <input className="input grow" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                <button className="btn icon" title="Copy" onClick={() => navigator.clipboard.writeText(shareUrl).then(() => notify('Link copied', 'success'))}>
                  <Copy size={14} />
                </button>
              </div>
            )}
            <div>
              <button className="btn sm" onClick={() => share.mutate(!album.shareToken)}>
                {album.shareToken ? <Link2Off size={14} /> : <Link2 size={14} />} {album.shareToken ? 'Turn off link' : 'Create public link'}
              </button>
            </div>
          </section>

          <section className="card stack" style={{ gap: 'calc(var(--space) * 1.5)' }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Layout</h3>
              {album.layoutOverride ? <span className="badge accent">Override: {album.layoutOverride.kind}</span> : <span className="badge">Inherits default ({site.settings.defaultLayout.kind})</span>}
            </div>
            {layoutDraft ? (
              <>
                <LayoutEditor value={layoutDraft} onChange={setLayoutDraft} />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setLayoutDraft(null)}>
                    Cancel
                  </button>
                  <button className="btn primary" onClick={() => patch.mutate({ layoutOverride: layoutDraft }, { onSuccess: () => setLayoutDraft(null) })}>
                    Save override
                  </button>
                </div>
              </>
            ) : (
              <div className="row">
                <button className="btn sm" onClick={() => setLayoutDraft(album.layoutOverride ?? site.settings.defaultLayout)}>
                  <Pencil size={14} /> {album.layoutOverride ? 'Edit override' : 'Override layout'}
                </button>
                {album.layoutOverride && (
                  <button className="btn ghost sm" onClick={() => patch.mutate({ layoutOverride: null })}>
                    <ArrowLeftRight size={14} /> Use default
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Media ({media.length})</h3>
          <span className="muted small">Drag tiles to reorder · star sets the cover</span>
        </div>
        <Uploader albumId={album.id} onUploaded={refresh} />
        <div className="media-admin-grid">
          {media.map((m) => (
            <div
              key={m.id}
              className={`media-admin-item ${album.coverMediaId === m.id ? 'cover' : ''} ${dragId === m.id ? 'dragging' : ''}`}
              draggable
              onDragStart={() => setDragId(m.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(m.id)}
            >
              <div className="thumb">
                <MediaThumb item={m} />
                {m.kind === 'video' && <span className="kind-badge">{formatDuration(m.duration ?? undefined) || 'video'}</span>}
                <span className="grip">
                  <GripVertical size={14} />
                </span>
              </div>
              <div className="meta">
                <strong className="ellipsis" style={{ display: 'block' }}>
                  {m.title || 'Untitled'}
                </strong>
                <span className="muted">
                  {m.width}×{m.height} · {formatBytes(m.size)} · {m.likes} ♥
                </span>
              </div>
              <div className="actions">
                <button className="btn ghost icon sm" title="Set as cover" onClick={() => patch.mutate({ coverMediaId: m.id })}>
                  <Star size={14} fill={album.coverMediaId === m.id ? 'currentColor' : 'none'} />
                </button>
                <button className="btn ghost icon sm" title="Edit" onClick={() => setEditing(m)}>
                  <Pencil size={14} />
                </button>
                <button className="btn ghost icon sm danger" title="Delete" onClick={() => confirm(`Delete "${m.title}"?`) && removeMedia.mutate(m.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit media">
        {editing && (
          <form
            className="stack"
            style={{ gap: 'calc(var(--space) * 2)' }}
            onSubmit={(e) => {
              e.preventDefault()
              updateMedia.mutate({ id: editing.id, title: editing.title, description: editing.description })
            }}
          >
            <div className="modal-preview">
              <MediaThumb item={editing} />
            </div>
            <div className="field">
              <label>Title</label>
              <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="field">
              <label>Description / caption</label>
              <textarea className="textarea" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn primary" disabled={updateMedia.isPending}>
                Save
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
