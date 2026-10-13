import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Images } from 'lucide-react'
import { db } from '../db/db'
import { getSiteSettings } from '../lib/settings'
import { useSession } from '../store/session'
import { MediaThumb } from '../components/MediaThumb'
import type { Album } from '../db/types'

function AlbumCard({ album }: { album: Album }) {
  const cover = useLiveQuery(async () => {
    if (album.coverMediaId != null) {
      const m = await db.media.get(album.coverMediaId)
      if (m) return m
    }
    return db.media.where('[albumId+sortOrder]').between([album.id!, -Infinity], [album.id!, Infinity]).first()
  }, [album.id, album.coverMediaId])
  const count = useLiveQuery(() => db.media.where('albumId').equals(album.id!).count(), [album.id]) ?? 0
  return (
    <Link to={`/album/${album.slug}`} className="album-card">
      <div className="cover">
        {cover ? (
          <MediaThumb item={cover} />
        ) : (
          <div className="cover-placeholder">
            <Images size={36} strokeWidth={1.2} />
          </div>
        )}
      </div>
      <div className="body">
        <div className="row between">
          <h3>{album.title}</h3>
          {album.visibility === 'draft' && <span className="badge">Draft</span>}
        </div>
        {album.description && (
          <p className="muted small" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {album.description}
          </p>
        )}
        <div className="row" style={{ gap: 6 }}>
          <span className="badge">{count} items</span>
          {album.tags.slice(0, 3).map((t) => (
            <span className="badge primary" key={t}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}

export function HomePage() {
  const user = useSession((s) => s.user)
  const settings = useLiveQuery(() => getSiteSettings(), [])
  const albums = useLiveQuery(async () => {
    const all = await db.albums.orderBy('sortOrder').toArray()
    return user?.role === 'admin' ? all : all.filter((a) => a.visibility === 'published')
  }, [user?.role])

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow" style={{ marginBottom: 12 }}>{settings?.tagline}</div>
        <h1>{settings?.siteTitle ?? 'Lumen'}</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          Welcome back, {user?.displayName}. Browse the galleries below.
        </p>
      </section>
      {albums && albums.length === 0 ? (
        <div className="empty">
          <Images size={40} strokeWidth={1.2} />
          <p style={{ marginTop: 12 }}>No galleries yet.</p>
          {user?.role === 'admin' && <Link to="/admin/albums">Create your first album →</Link>}
        </div>
      ) : (
        <div className="album-grid">{albums?.map((a) => <AlbumCard album={a} key={a.id} />)}</div>
      )}
    </main>
  )
}
