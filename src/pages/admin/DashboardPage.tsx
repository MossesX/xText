import { Link } from 'react-router-dom'
import { Eye, Heart } from 'lucide-react'
import { useStats } from '../../api/hooks'
import { formatBytes } from '../../lib/media'
import { Avatar } from '../../components/Avatar'
import { formatDate } from '../../components/Comments'

export function DashboardPage() {
  const { data: s } = useStats()
  const tiles: [string, string | number | undefined, string?][] = [
    ['Albums', s ? `${s.published} / ${s.albums}` : undefined, '/admin/albums'],
    ['Media', s?.media, '/admin/albums'],
    ['Members', s ? `${s.activeUsers} active / ${s.users}` : undefined, '/admin/users'],
    ['Pending', s?.pendingUsers, '/admin/users'],
    ['Galleries', s?.galleries, '/admin/gallery'],
    ['Views', s?.views],
    ['Likes', s?.likes],
    ['Comments', s?.comments],
    ['Saved', s?.favorites],
    ['Storage', s ? formatBytes(s.bytes) : undefined],
  ]
  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div>
        <div className="eyebrow">Overview</div>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
      </div>
      <div className="stats">
        {tiles.map(([label, value, to]) => (
          <Link className="card stat" key={label} to={to ?? '#'} style={{ color: 'inherit', pointerEvents: to ? 'auto' : 'none' }}>
            <div className="eyebrow">{label}</div>
            <div className="value">{value ?? '–'}</div>
          </Link>
        ))}
      </div>
      <div className="two-col">
        <section className="card">
          <h3>Top galleries</h3>
          {!s?.topAlbums.length && <p className="muted small">No albums yet.</p>}
          {s?.topAlbums.map((a, i) => (
            <div className="row between list-row" key={a.id}>
              <span className="row" style={{ gap: 10 }}>
                <span className="rank">{i + 1}</span>
                <Link to={`/album/${a.slug}`} style={{ color: 'inherit', fontWeight: 600 }}>
                  {a.title}
                </Link>
              </span>
              <span className="row muted small" style={{ gap: 12 }}>
                <span className="row" style={{ gap: 4 }}>
                  <Eye size={12} /> {a.views}
                </span>
                <span className="row" style={{ gap: 4 }}>
                  <Heart size={12} /> {a.likes}
                </span>
              </span>
            </div>
          ))}
        </section>
        <section className="card">
          <h3>Recent comments</h3>
          {!s?.recentComments.length && <p className="muted small">No comments yet.</p>}
          {s?.recentComments.map((c) => (
            <div className="comment" key={c.id}>
              <Avatar name={c.author} />
              <div className="grow">
                <div>
                  <strong>{c.author}</strong>{' '}
                  <span className="meta">
                    on {c.slug ? <Link to={`/album/${c.slug}`}>{c.target}</Link> : c.target} · {formatDate(c.createdAt)}
                  </span>
                </div>
                <div className="body small">{c.body}</div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
