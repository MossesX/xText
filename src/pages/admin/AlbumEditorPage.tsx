import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowLeftRight, ExternalLink, ImagePlus, Pencil, Star, Trash2, Upload } from 'lucide-react'
import { db } from '../../db/db'
import { formatBytes, formatDuration, kindOf, processFile, slugify } from '../../lib/media'
import { MediaThumb } from '../../components/MediaThumb'
import { Modal } from '../../components/Modal'
import { LayoutEditor } from '../../components/LayoutEditor'
import { useUI } from '../../store/ui'
import { getSiteSettings } from '../../lib/settings'
import type { Album, LayoutConfig, MediaItem } from '../../db/types'

interface UploadProgress {
  total: number
  done: number
  current?: string
  errors: string[]
}

export function AlbumEditorPage() {
  const { id } = useParams()
  const albumId = Number(id)
  const notify = useUI((s) => s.notify)
  const album = useLiveQuery(() => db.albums.get(albumId), [albumId])
  const settings = useLiveQuery(() => getSiteSettings(), [])
  const items = useLiveQuery(() => db.media.where('[albumId+sortOrder]').between([albumId, -Infinity], [albumId, Infinity]).toArray(), [albumId])

  const [draft, setDraft] = useState<Pick<Album, 'title' | 'slug' | 'description' | 'tags' | 'visibility'> | null>(null)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState<MediaItem | null>(null)
  const [layoutDraft, setLayoutDraft] = useState<LayoutConfig | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (album && !draft) {
      setDraft({ title: album.title, slug: album.slug, description: album.description, tags: album.tags, visibility: album.visibility })
    }
  }, [album, draft])

  if (album === undefined || settings === undefined) return null
  if (album === null || Number.isNaN(albumId)) return <Navigate to="/admin/albums" replace />

  const saveDetails = async () => {
    if (!draft) return
    const slug = slugify(draft.slug || draft.title)
    const clash = await db.albums.where('slug').equals(slug).first()
    if (clash && clash.id !== albumId) {
      notify('That URL slug is already used by another album', 'error')
      return
    }
    await db.albums.update(albumId, { ...draft, slug, title: draft.title.trim(), updatedAt: Date.now() })
    notify('Album saved', 'success')
  }

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => kindOf(f))
    if (!list.length) {
      notify('No supported images or videos selected', 'error')
      return
    }
    const last = await db.media.where('[albumId+sortOrder]').between([albumId, -Infinity], [albumId, Infinity]).last()
    let order = (last?.sortOrder ?? 0) + 1
    const state: UploadProgress = { total: list.length, done: 0, errors: [] }
    setProgress({ ...state })
    for (const file of list) {
      setProgress({ ...state, current: file.name })
      try {
        const meta = await processFile(file)
        await db.media.add({
          albumId,
          kind: meta.kind,
          title: file.name.replace(/\.[^.]+$/, ''),
          description: '',
          mimeType: file.type,
          blob: file,
          thumb: meta.thumb,
          width: meta.width,
          height: meta.height,
          size: file.size,
          duration: meta.duration,
          sortOrder: order++,
          createdAt: Date.now(),
        })
      } catch (err) {
        state.errors.push(`${file.name}: ${err instanceof Error ? err.message : 'failed'}`)
      }
      state.done++
      setProgress({ ...state })
    }
    await db.albums.update(albumId, { updatedAt: Date.now() })
    setTimeout(() => setProgress(null), state.errors.length ? 6000 : 1200)
    notify(`${state.done - state.errors.length} file${state.done - state.errors.length === 1 ? '' : 's'} uploaded`, state.errors.length ? 'error' : 'success')
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const moveItem = async (item: MediaItem, dir: -1 | 1) => {
    if (!items) return
    const idx = items.findIndex((m) => m.id === item.id)
    const other = items[idx + dir]
    if (!other) return
    await db.transaction('rw', db.media, async () => {
      await db.media.update(item.id!, { sortOrder: other.sortOrder })
      await db.media.update(other.id!, { sortOrder: item.sortOrder })
    })
  }

  const removeItem = async (item: MediaItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return
    await db.transaction('rw', db.media, db.likes, db.comments, db.albums, async () => {
      await db.likes.where('mediaId').equals(item.id!).delete()
      await db.comments.where('mediaId').equals(item.id!).delete()
      await db.media.delete(item.id!)
      if (album.coverMediaId === item.id) await db.albums.update(albumId, { coverMediaId: undefined })
    })
  }

  const saveLayout = async (layout: LayoutConfig | null) => {
    await db.albums.update(albumId, { layoutOverride: layout, updatedAt: Date.now() })
    setLayoutDraft(null)
    notify(layout ? 'Album layout override saved' : 'Album now uses the default layout', 'success')
  }

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
          <button
            className={`btn ${album.visibility === 'published' ? '' : 'primary'}`}
            onClick={() => db.albums.update(albumId, { visibility: album.visibility === 'published' ? 'draft' : 'published', updatedAt: Date.now() })}
          >
            {album.visibility === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {draft && (
        <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
          <h3>Details</h3>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="field grow">
              <label>Title</label>
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="field grow">
              <label>URL slug</label>
              <input className="input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Tags (comma separated)</label>
            <input
              className="input"
              value={draft.tags.join(', ')}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder="travel, portraits, 35mm"
            />
          </div>
          <div>
            <button className="btn primary" onClick={saveDetails} disabled={!draft.title.trim()}>
              Save details
            </button>
          </div>
        </section>
      )}

      <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Layout</h3>
          {album.layoutOverride ? <span className="badge accent">Override: {album.layoutOverride.kind}</span> : <span className="badge">Inherits default ({settings.defaultLayout.kind})</span>}
        </div>
        {layoutDraft ? (
          <>
            <LayoutEditor value={layoutDraft} onChange={setLayoutDraft} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setLayoutDraft(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={() => saveLayout(layoutDraft)}>
                Save override
              </button>
            </div>
          </>
        ) : (
          <div className="row">
            <button className="btn" onClick={() => setLayoutDraft(album.layoutOverride ?? settings.defaultLayout)}>
              <Pencil size={14} /> {album.layoutOverride ? 'Edit override' : 'Override layout for this album'}
            </button>
            {album.layoutOverride && (
              <button className="btn ghost" onClick={() => saveLayout(null)}>
                <ArrowLeftRight size={14} /> Use default layout
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card stack" style={{ gap: 'calc(var(--space) * 2)' }}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Media ({items?.length ?? 0})</h3>
          <button className="btn primary" onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> Upload
          </button>
          <input ref={fileInput} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>
        <div
          className={`dropzone ${dragging ? 'active' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <ImagePlus size={28} strokeWidth={1.3} />
          <div style={{ marginTop: 8 }}>Drag images or videos here, or click to browse.</div>
          <div className="small">Thumbnails are generated automatically. Files are stored in this browser.</div>
        </div>
        {progress && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row between small">
              <span>
                {progress.done < progress.total ? `Processing ${progress.current ?? ''}` : 'Done'} · {progress.done}/{progress.total}
              </span>
            </div>
            <div className="progress">
              <div style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            {progress.errors.map((e) => (
              <div className="error" key={e}>
                {e}
              </div>
            ))}
          </div>
        )}
        <div className="media-admin-grid">
          {items?.map((m, i) => (
            <div key={m.id} className={`media-admin-item ${album.coverMediaId === m.id ? 'cover' : ''}`}>
              <div className="thumb">
                <MediaThumb item={m} />
                {m.kind === 'video' && <span className="kind-badge" style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: 999, padding: '2px 7px', fontSize: '0.7rem' }}>{formatDuration(m.duration) || 'video'}</span>}
              </div>
              <div className="meta">
                <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title || 'Untitled'}</strong>
                <span className="muted">
                  {m.width}×{m.height} · {formatBytes(m.size)}
                </span>
              </div>
              <div className="actions">
                <div className="row" style={{ gap: 0 }}>
                  <button className="btn ghost icon sm" title="Move left" disabled={i === 0} onClick={() => moveItem(m, -1)}>
                    ←
                  </button>
                  <button className="btn ghost icon sm" title="Move right" disabled={i === (items?.length ?? 0) - 1} onClick={() => moveItem(m, 1)}>
                    →
                  </button>
                </div>
                <div className="row" style={{ gap: 0 }}>
                  <button className="btn ghost icon sm" title="Set as cover" onClick={() => db.albums.update(albumId, { coverMediaId: m.id })}>
                    <Star size={14} fill={album.coverMediaId === m.id ? 'currentColor' : 'none'} />
                  </button>
                  <button className="btn ghost icon sm" title="Edit" onClick={() => setEditing(m)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn ghost icon sm danger" title="Delete" onClick={() => removeItem(m)}>
                    <Trash2 size={14} />
                  </button>
                </div>
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
            onSubmit={async (e) => {
              e.preventDefault()
              await db.media.update(editing.id!, { title: editing.title, description: editing.description })
              setEditing(null)
            }}
          >
            <div style={{ maxHeight: 240, overflow: 'hidden', borderRadius: 'var(--radius-sm)' }}>
              <MediaThumb item={editing} />
            </div>
            <div className="field">
              <label>Title</label>
              <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea className="textarea" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn primary">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
