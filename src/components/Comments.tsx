import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useMe } from '../api/hooks'
import type { Comment } from '../api/types'
import { Avatar } from './Avatar'
import { useUI } from '../store/ui'

interface Props {
  mediaId?: number
  albumId?: number
  initial?: Comment[]
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function Comments({ mediaId, albumId, initial }: Props) {
  const { data: user } = useMe()
  const qc = useQueryClient()
  const notify = useUI((s) => s.notify)
  const [body, setBody] = useState('')
  const url = mediaId != null ? `/api/media/${mediaId}/comments` : `/api/albums/${albumId}/comments`
  const key = ['comments', mediaId != null ? `m${mediaId}` : `a${albumId}`]

  const { data: comments } = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ comments: Comment[] }>(url).then((r) => r.comments),
    initialData: initial,
  })

  const post = useMutation({
    mutationFn: (text: string) => api.post<{ comment: Comment }>(url, { body: text }).then((r) => r.comment),
    onSuccess: (c) => {
      qc.setQueryData<Comment[]>(key, (old) => [...(old ?? []), c])
      setBody('')
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/comments/${id}`),
    onSuccess: (_r, id) => qc.setQueryData<Comment[]>(key, (old) => (old ?? []).filter((c) => c.id !== id)),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (body.trim()) post.mutate(body.trim())
  }

  return (
    <div className="stack comments">
      <div>
        {!comments?.length && <p className="muted small">No comments yet. Start the conversation.</p>}
        {comments?.map((c) => (
          <div className="comment" key={c.id}>
            <Avatar name={c.author.displayName} />
            <div className="grow">
              <div className="row between">
                <div>
                  <strong>{c.author.displayName}</strong> <span className="meta">{formatDate(c.createdAt)}</span>
                </div>
                {(user?.role === 'admin' || user?.id === c.userId) && (
                  <button className="btn ghost icon sm" title="Delete comment" onClick={() => remove.mutate(c.id)}>
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
          <button className="btn primary sm" disabled={post.isPending || !body.trim()}>
            Post
          </button>
        </div>
      </form>
    </div>
  )
}
