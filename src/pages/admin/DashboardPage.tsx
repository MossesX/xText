import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { formatBytes } from '../../lib/media'

export function DashboardPage() {
  const stats = useLiveQuery(async () => {
    const [albums, media, users, likes, comments] = await Promise.all([db.albums.count(), db.media.count(), db.users.count(), db.likes.count(), db.comments.count()])
    let bytes = 0
    await db.media.each((m) => {
      bytes += m.size
    })
    return { albums, media, users, likes, comments, bytes }
  }, [])
  const recent = useLiveQuery(async () => {
    const rows = await db.comments.orderBy('createdAt').reverse().limit(6).toArray()
    const users = await db.users.bulkGet([...new Set(rows.map((r) => r.userId))])
    const albums = await db.albums.bulkGet([...new Set(rows.map((r) => r.albumId).filter((x): x is number => x != null))])
    const media = await db.media.bulkGet([...new Set(rows.map((r) => r.mediaId).filter((x): x is number => x != null))])
    return rows.map((r) => ({
      ...r,
      author: users.find((u) => u?.id === r.userId)?.displayName ?? 'Removed user',
      target: r.mediaId != null ? media.find((m) => m?.id === r.mediaId)?.title || 'media' : albums.find((a) => a?.id === r.albumId)?.title || 'album',
    }))
  }, [])

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div>
        <div className="eyebrow">Overview</div>
        <h1>Dashboard</h1>
      </div>
      <div className="stats">
        {[
          ['Albums', stats?.albums, '/admin/albums'],
          ['Media items', stats?.media, '/admin/albums'],
          ['Users', stats?.users, '/admin/users'],
          ['Likes', stats?.likes],
          ['Comments', stats?.comments],
          ['Storage', stats ? formatBytes(stats.bytes) : undefined],
        ].map(([label, value, to]) => (
          <Link className="card stat" key={label as string} to={(to as string) ?? '#'} style={{ color: 'inherit' }}>
            <div className="eyebrow">{label as string}</div>
            <div className="value">{value ?? '–'}</div>
          </Link>
        ))}
      </div>
      <section className="card">
        <h3>Recent comments</h3>
        {!recent?.length && <p className="muted small">No comments yet.</p>}
        {recent?.map((c) => (
          <div className="comment" key={c.id}>
            <div className="avatar">{c.author.slice(0, 2)}</div>
            <div className="grow">
              <div>
                <strong>{c.author}</strong> <span className="meta">on {c.target}</span>
              </div>
              <div className="body small">{c.body}</div>
            </div>
          </div>
        ))}
      </section>
      <section className="card">
        <h3>Getting started</h3>
        <ol className="muted small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Create user accounts under <Link to="/admin/users">Users</Link>.</li>
          <li>Create an album and upload images or videos under <Link to="/admin/albums">Albums</Link>.</li>
          <li>Roll or hand-craft a colour theme under <Link to="/admin/themes">Themes</Link> and activate it.</li>
          <li>Set the default album layout under <Link to="/admin/appearance">Appearance</Link>, or override it per album.</li>
        </ol>
      </section>
    </div>
  )
}
