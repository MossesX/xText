import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Pencil } from 'lucide-react'
import { db } from '../db/db'
import { getSiteSettings } from '../lib/settings'
import { useSession } from '../store/session'
import { MediaLayout } from '../components/MediaLayout'
import { Lightbox } from '../components/Lightbox'
import { Comments } from '../components/Comments'
import { useObjectUrl } from '../lib/useObjectUrl'
import type { MediaItem } from '../db/types'

export function AlbumPage() {
  const { slug } = useParams()
  const user = useSession((s) => s.user)
  const settings = useLiveQuery(() => getSiteSettings(), [])
  const album = useLiveQuery(() => db.albums.where('slug').equals(slug ?? '').first(), [slug])
  const items = useLiveQuery(async () => {
    if (album?.id == null) return [] as MediaItem[]
    return db.media.where('[albumId+sortOrder]').between([album.id, -Infinity], [album.id, Infinity]).toArray()
  }, [album?.id])
  const cover = useLiveQuery(async () => {
    if (album?.coverMediaId == null) return items?.[0]
    return (await db.media.get(album.coverMediaId)) ?? items?.[0]
  }, [album?.coverMediaId, items])
  const coverUrl = useObjectUrl(cover?.thumb ?? (cover?.kind === 'image' ? cover.blob : undefined))
  const [open, setOpen] = useState<number | null>(null)

  if (album === undefined || settings === undefined) return <main className="page" />
  if (album === null || (album.visibility === 'draft' && user?.role !== 'admin')) return <Navigate to="/" replace />

  const layout = album.layoutOverride ?? settings.defaultLayout

  return (
    <main className="page">
      <div className="row between" style={{ marginBottom: 'calc(var(--space) * 2)' }}>
        <Link to="/" className="btn ghost sm">
          <ArrowLeft size={14} /> All galleries
        </Link>
        {user?.role === 'admin' && (
          <Link to={`/admin/albums/${album.id}`} className="btn sm">
            <Pencil size={14} /> Edit album
          </Link>
        )}
      </div>

      {layout.heroCover && coverUrl ? (
        <section className="album-hero">
          <img src={coverUrl} alt="" />
          <div className="shade" />
          <div className="content">
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              {album.tags.map((t) => (
                <span className="badge" key={t} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
                  {t}
                </span>
              ))}
              {album.layoutOverride && user?.role === 'admin' && <span className="badge accent">Custom layout</span>}
            </div>
            <h1>{album.title}</h1>
            {album.description && <p>{album.description}</p>}
          </div>
        </section>
      ) : (
        <header className="album-header">
          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            {album.tags.map((t) => (
              <span className="badge primary" key={t}>
                {t}
              </span>
            ))}
          </div>
          <h1>{album.title}</h1>
          {album.description && <p className="muted" style={{ maxWidth: 720 }}>{album.description}</p>}
        </header>
      )}

      <MediaLayout items={items ?? []} layout={layout} onOpen={setOpen} />

      {settings.allowComments && (
        <section className="card" style={{ marginTop: 'calc(var(--space) * 6)', maxWidth: 760 }}>
          <h3>Discussion</h3>
          <Comments albumId={album.id} />
        </section>
      )}

      {open != null && items && (
        <Lightbox items={items} index={open} onClose={() => setOpen(null)} onNavigate={setOpen} allowComments={settings.allowComments} allowLikes={settings.allowLikes} />
      )}
    </main>
  )
}
