import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { db } from '../../db/db'
import { slugify } from '../../lib/media'
import { Modal } from '../../components/Modal'
import { useUI } from '../../store/ui'
import type { Album } from '../../db/types'

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base)
  let n = 2
  while (await db.albums.where('slug').equals(slug).first()) slug = `${slugify(base)}-${n++}`
  return slug
}

export function AlbumsPage() {
  const navigate = useNavigate()
  const notify = useUI((s) => s.notify)
  const albums = useLiveQuery(() => db.albums.orderBy('sortOrder').toArray(), [])
  const counts = useLiveQuery(async () => {
    const map = new Map<number, number>()
    await db.media.each((m) => map.set(m.albumId, (map.get(m.albumId) ?? 0) + 1))
    return map
  }, [])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const now = Date.now()
    const last = await db.albums.orderBy('sortOrder').last()
    const id = await db.albums.add({
      slug: await uniqueSlug(title),
      title: title.trim(),
      description: '',
      visibility: 'draft',
      tags: [],
      layoutOverride: null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    })
    setOpen(false)
    setTitle('')
    navigate(`/admin/albums/${id}`)
  }

  const move = async (album: Album, dir: -1 | 1) => {
    if (!albums) return
    const idx = albums.findIndex((a) => a.id === album.id)
    const other = albums[idx + dir]
    if (!other) return
    await db.transaction('rw', db.albums, async () => {
      await db.albums.update(album.id!, { sortOrder: other.sortOrder })
      await db.albums.update(other.id!, { sortOrder: album.sortOrder })
    })
  }

  const remove = async (album: Album) => {
    if (!confirm(`Delete "${album.title}" and all its media? This cannot be undone.`)) return
    await db.transaction('rw', db.albums, db.media, db.likes, db.comments, async () => {
      const mediaIds = (await db.media.where('albumId').equals(album.id!).primaryKeys()).filter((k): k is number => k != null)
      await db.likes.where('mediaId').anyOf(mediaIds).delete()
      await db.comments.where('mediaId').anyOf(mediaIds).delete()
      await db.comments.where('albumId').equals(album.id!).delete()
      await db.media.bulkDelete(mediaIds)
      await db.albums.delete(album.id!)
    })
    notify('Album deleted')
  }

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row between">
        <div>
          <div className="eyebrow">Content</div>
          <h1 style={{ margin: 0 }}>Albums</h1>
        </div>
        <button className="btn primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> New album
        </button>
      </div>
      {albums?.length === 0 ? (
        <div className="empty">No albums yet. Create one to start uploading.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Album</th>
                <th>Items</th>
                <th>Layout</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {albums?.map((a, i) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/admin/albums/${a.id}`} style={{ color: 'inherit', fontWeight: 600 }}>
                      {a.title}
                    </Link>
                    <div className="muted small">/album/{a.slug}</div>
                  </td>
                  <td>{counts?.get(a.id!) ?? 0}</td>
                  <td>{a.layoutOverride ? <span className="badge accent">{a.layoutOverride.kind} (override)</span> : <span className="badge">Default</span>}</td>
                  <td>{a.visibility === 'published' ? <span className="badge success">Published</span> : <span className="badge">Draft</span>}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                      <button className="btn ghost icon sm" title="Move up" disabled={i === 0} onClick={() => move(a, -1)}>
                        <ArrowUp size={14} />
                      </button>
                      <button className="btn ghost icon sm" title="Move down" disabled={i === (albums?.length ?? 0) - 1} onClick={() => move(a, 1)}>
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className="btn ghost icon sm"
                        title={a.visibility === 'published' ? 'Unpublish' : 'Publish'}
                        onClick={() => db.albums.update(a.id!, { visibility: a.visibility === 'published' ? 'draft' : 'published', updatedAt: Date.now() })}
                      >
                        {a.visibility === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button className="btn ghost icon sm danger" title="Delete" onClick={() => remove(a)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New album">
        <form className="stack" onSubmit={create} style={{ gap: 'calc(var(--space) * 2)' }}>
          <div className="field">
            <label>Title</label>
            <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer in Lisbon" />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={!title.trim()}>
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
