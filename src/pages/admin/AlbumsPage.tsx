import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, GripVertical, Plus, Star, Trash2 } from 'lucide-react'
import { api } from '../../api/client'
import { useAlbums } from '../../api/hooks'
import type { Album } from '../../api/types'
import { Modal } from '../../components/Modal'
import { MediaThumb } from '../../components/MediaThumb'
import { useUI } from '../../store/ui'

export function AlbumsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const notify = useUI((s) => s.notify)
  const { data } = useAlbums({ sort: 'manual' })
  const [list, setList] = useState<Album[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dragId, setDragId] = useState<number | null>(null)
  useEffect(() => setList(data?.albums ?? []), [data])
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['albums'] })
    qc.invalidateQueries({ queryKey: ['album'] })
  }

  const create = useMutation({
    mutationFn: () => api.post<{ album: Album }>('/api/albums', { title }),
    onSuccess: (r) => {
      refresh()
      setOpen(false)
      setTitle('')
      navigate(`/admin/albums/${r.album.id}`)
    },
  })
  const patch = useMutation({
    mutationFn: (v: { id: number; patch: Record<string, unknown> }) => api.put(`/api/albums/${v.id}`, v.patch),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/albums/${id}`),
    onSuccess: () => {
      refresh()
      notify('Album deleted')
    },
  })
  const reorder = useMutation({
    mutationFn: (ids: number[]) => api.put('/api/albums/reorder', { ids }),
    onSuccess: refresh,
  })

  const onDrop = (targetId: number) => {
    if (dragId == null || dragId === targetId) return
    const from = list.findIndex((a) => a.id === dragId)
    const to = list.findIndex((a) => a.id === targetId)
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setList(next)
    setDragId(null)
    reorder.mutate(next.map((a) => a.id))
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
      <p className="muted small">Drag rows to set the curated order shown on the home page.</p>
      {list.length === 0 ? (
        <div className="empty">No albums yet. Create one to start uploading.</div>
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Album</th>
                <th>Items</th>
                <th>Layout</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr
                  key={a.id}
                  draggable
                  onDragStart={() => setDragId(a.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(a.id)}
                  className={dragId === a.id ? 'dragging' : ''}
                >
                  <td className="muted" style={{ cursor: 'grab' }}>
                    <GripVertical size={16} />
                  </td>
                  <td>
                    <div className="row" style={{ gap: 12 }}>
                      <div className="mini-cover">{a.cover && <MediaThumb item={a.cover} alt="" />}</div>
                      <div>
                        <Link to={`/admin/albums/${a.id}`} style={{ color: 'inherit', fontWeight: 600 }}>
                          {a.title}
                        </Link>
                        <div className="muted small">
                          /album/{a.slug} {a.featured && <span className="badge accent">Featured</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {a.counts.media}
                    {a.counts.videos > 0 && <span className="muted small"> · {a.counts.videos} video</span>}
                  </td>
                  <td>{a.layoutOverride ? <span className="badge accent">{a.layoutOverride.kind} (override)</span> : <span className="badge">Default</span>}</td>
                  <td>{a.visibility === 'published' ? <span className="badge success">Published</span> : <span className="badge">Draft</span>}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                      <button className="btn ghost icon sm" title={a.featured ? 'Unfeature' : 'Feature on home'} onClick={() => patch.mutate({ id: a.id, patch: { featured: !a.featured } })}>
                        <Star size={14} fill={a.featured ? 'currentColor' : 'none'} />
                      </button>
                      <button className="btn ghost icon sm" title={a.visibility === 'published' ? 'Unpublish' : 'Publish'} onClick={() => patch.mutate({ id: a.id, patch: { visibility: a.visibility === 'published' ? 'draft' : 'published' } })}>
                        {a.visibility === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button className="btn ghost icon sm danger" title="Delete" onClick={() => confirm(`Delete "${a.title}" and all its media? This cannot be undone.`) && remove.mutate(a.id)}>
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
        <form
          className="stack"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            create.mutate()
          }}
          style={{ gap: 'calc(var(--space) * 2)' }}
        >
          {create.error && <div className="error">{create.error.message}</div>}
          <div className="field">
            <label>Title</label>
            <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer in Lisbon" />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={!title.trim() || create.isPending}>
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
