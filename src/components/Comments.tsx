import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { useSession } from '../store/session'

interface Props {
  mediaId?: number
  albumId?: number
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function Comments({ mediaId, albumId }: Props) {
  const user = useSession((s) => s.user)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const comments = useLiveQuery(async () => {
    const rows = mediaId != null ? await db.comments.where('mediaId').equals(mediaId).toArray() : albumId != null ? await db.comments.where('albumId').equals(albumId).filter((c) => c.mediaId == null).toArray() : []
    rows.sort((a, b) => a.createdAt - b.createdAt)
    const users = await db.users.bulkGet([...new Set(rows.map((r) => r.userId))])
    const byId = new Map(users.filter(Boolean).map((u) => [u!.id!, u!]))
    return rows.map((r) => ({ ...r, author: byId.get(r.userId) }))
  }, [mediaId, albumId])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim() || user?.id == null) return
    setBusy(true)
    try {
      await db.comments.add({ userId: user.id, mediaId, albumId, body: body.trim(), createdAt: Date.now() })
      setBody('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div>
        {!comments?.length && <p className="muted small">No comments yet. Start the conversation.</p>}
        {comments?.map((c) => (
          <div className="comment" key={c.id}>
            <div className="avatar">{(c.author?.displayName ?? '?').slice(0, 2)}</div>
            <div className="grow">
              <div className="row between">
                <div>
                  <strong>{c.author?.displayName ?? 'Removed user'}</strong>{' '}
                  <span className="meta">{formatDate(c.createdAt)}</span>
                </div>
                {(user?.role === 'admin' || user?.id === c.userId) && (
                  <button className="btn ghost icon sm" title="Delete comment" onClick={() => db.comments.delete(c.id!)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="body">{c.body}</div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="stack">
        <textarea
          className="textarea"
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ minHeight: 72 }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
          }}
        />
        <div className="row between">
          <span className="muted small">Ctrl/⌘ + Enter to post</span>
          <button className="btn primary sm" disabled={busy || !body.trim()}>
            Post
          </button>
        </div>
      </form>
    </div>
  )
}
