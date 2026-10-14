import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Globe, Settings2 } from 'lucide-react'
import { useGallery, useMe } from '../api/hooks'
import { AlbumCard } from '../components/AlbumCard'
import { PageLoader } from '../components/Skeleton'
import { useGalleryTheme } from '../components/GalleryTheme'
import { ApiError } from '../api/client'
import { useUI } from '../store/ui'

/** A member's view of one gallery: its splash and the albums they may see. */
export function GalleryPage() {
  const { slug } = useParams()
  const { data: me } = useMe()
  const { data, isLoading, error } = useGallery(slug)
  const notify = useUI((s) => s.notify)
  const [tab, setTab] = useState<'all' | 'drafts'>('all')
  useGalleryTheme(data?.theme)

  if (isLoading) return <PageLoader />
  if (error instanceof ApiError && error.status === 404) return <Navigate to="/" replace />
  if (!data) return <PageLoader />
  const { gallery, albums, canManage } = data
  const shown = tab === 'drafts' ? albums.filter((a) => a.visibility === 'draft') : albums.filter((a) => a.visibility === 'published' || canManage)
  const publicUrl = `${location.origin}/public/${gallery.slug}`

  return (
    <main className="page">
      <div className="row between" style={{ marginBottom: 'calc(var(--space) * 2)' }}>
        <Link to="/" className="btn ghost sm">
          <ArrowLeft size={14} /> All galleries
        </Link>
        <div className="row">
          {gallery.publicAlbum && (
            <button className="btn sm" onClick={() => navigator.clipboard.writeText(publicUrl).then(() => notify('Public link copied', 'success'))}>
              <Globe size={14} /> Public page
            </button>
          )}
          {canManage && (
            <Link to="/admin/gallery" className="btn sm">
              <Settings2 size={14} /> Gallery settings
            </Link>
          )}
        </div>
      </div>
      <section className="hero-feature" style={{ minHeight: 360 }}>
        {gallery.splash && <img className="hero-bg" src={gallery.splash.thumbUrl ?? gallery.splash.url} alt="" />}
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="eyebrow light">{gallery.owner ? `Curated by ${gallery.owner.displayName}` : 'Gallery'}</div>
          <h1>{gallery.headline || gallery.title}</h1>
          {gallery.tagline && <p className="lead">{gallery.tagline}</p>}
        </div>
      </section>
      <section className="toolbar">
        <div>
          <div className="eyebrow">{gallery.title}</div>
          <h2 style={{ margin: 0 }}>{me?.role === 'user' ? 'Albums shared with you' : 'Albums'}</h2>
        </div>
        {canManage && (
          <div className="segmented">
            <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
              All
            </button>
            <button className={tab === 'drafts' ? 'active' : ''} onClick={() => setTab('drafts')}>
              Drafts
            </button>
          </div>
        )}
      </section>
      {shown.length === 0 ? (
        <div className="empty">No albums here yet.</div>
      ) : (
        <div className="album-grid">
          {shown.map((a) => (
            <AlbumCard album={a} key={a.id} />
          ))}
        </div>
      )}
    </main>
  )
}
