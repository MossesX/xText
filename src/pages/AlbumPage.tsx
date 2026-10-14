import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clapperboard, Eye, Heart, Images, Pencil, Play, Share2 } from 'lucide-react'
import { useAlbum, useSettings } from '../api/hooks'
import { MediaLayout } from '../components/MediaLayout'
import { Lightbox } from '../components/Lightbox'
import { Comments } from '../components/Comments'
import { FavoriteButton } from '../components/FavoriteButton'
import { PageLoader } from '../components/Skeleton'
import { useUI } from '../store/ui'
import { ApiError } from '../api/client'

export function AlbumPage() {
  const { slug } = useParams()
  const { data: site } = useSettings()
  const { data, isLoading, error } = useAlbum(slug)
  const notify = useUI((s) => s.notify)
  const [params, setParams] = useSearchParams()
  const openId = params.get('m')
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    if (!data || !openId) return
    const idx = data.media.findIndex((m) => String(m.id) === openId)
    if (idx >= 0) setOpen(idx)
  }, [data, openId])

  if (isLoading || !site) return <PageLoader />
  if (error instanceof ApiError && error.status === 404) return <Navigate to="/" replace />
  if (!data) return <PageLoader />

  const { album, media, comments } = data
  const layout = album.layoutOverride ?? site.settings.defaultLayout
  const heroItem = album.cover ?? media[0]

  const openAt = (i: number) => {
    setOpen(i)
    const next = new URLSearchParams(params)
    next.set('m', String(media[i].id))
    setParams(next, { replace: true })
  }
  const close = () => {
    setOpen(null)
    const next = new URLSearchParams(params)
    next.delete('m')
    setParams(next, { replace: true })
  }

  const share = async () => {
    const url = album.shareToken ? `${location.origin}/s/${album.shareToken}` : location.href
    try {
      await navigator.clipboard.writeText(url)
      notify(album.shareToken ? 'Public share link copied' : 'Link copied (members only)', 'success')
    } catch {
      notify(url)
    }
  }

  return (
    <main className="page">
      <div className="row between" style={{ marginBottom: 'calc(var(--space) * 2)' }}>
        <Link to={album.gallery ? `/g/${album.gallery.slug}` : '/'} className="btn ghost sm">
          <ArrowLeft size={14} /> {album.gallery?.title ?? 'All galleries'}
        </Link>
        <div className="row">
          <button className="btn sm" onClick={share}>
            <Share2 size={14} /> Share
          </button>
          <FavoriteButton album={album} />
          {media.length > 1 && (
            <button className="btn sm" onClick={() => openAt(0)}>
              <Play size={14} /> Slideshow
            </button>
          )}
          {data.canManage && (
            <Link to={`/admin/albums/${album.id}`} className="btn sm">
              <Pencil size={14} /> Edit
            </Link>
          )}
        </div>
      </div>

      {layout.heroCover && heroItem ? (
        <section className="album-hero">
          <img src={heroItem.thumbUrl ?? heroItem.url} alt="" />
          <div className="shade" />
          <div className="content">
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              {album.tags.map((t) => (
                <Link to={`/?tag=${encodeURIComponent(t)}`} className="chip chip-glass" key={t}>
                  #{t}
                </Link>
              ))}
              {album.visibility === 'draft' && <span className="chip">Draft</span>}
            </div>
            <h1>{album.title}</h1>
            {album.description && <p className="lead">{album.description}</p>}
            <AlbumMeta album={album} />
          </div>
        </section>
      ) : (
        <header className="album-header">
          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            {album.tags.map((t) => (
              <Link to={`/?tag=${encodeURIComponent(t)}`} className="badge primary" key={t}>
                #{t}
              </Link>
            ))}
          </div>
          <h1>{album.title}</h1>
          {album.description && <p className="muted lead" style={{ maxWidth: 720 }}>{album.description}</p>}
          <AlbumMeta album={album} muted />
        </header>
      )}

      <MediaLayout items={media} layout={layout} onOpen={openAt} />

      {site.settings.allowComments && (
        <section className="card discussion">
          <h3>Discussion</h3>
          <Comments albumId={album.id} initial={comments} />
        </section>
      )}

      {open != null && (
        <Lightbox items={media} index={open} onClose={close} onNavigate={openAt} allowComments={site.settings.allowComments} allowLikes={site.settings.allowLikes} allowDownloads={site.settings.allowDownloads} />
      )}
    </main>
  )
}

function AlbumMeta({ album, muted }: { album: { counts: { media: number; videos: number; likes: number }; views: number }; muted?: boolean }) {
  return (
    <div className={`row album-meta ${muted ? 'muted' : ''}`} style={{ gap: 16, marginTop: 10 }}>
      <span className="row" style={{ gap: 5 }}>
        <Images size={14} /> {album.counts.media} items
      </span>
      {album.counts.videos > 0 && (
        <span className="row" style={{ gap: 5 }}>
          <Clapperboard size={14} /> {album.counts.videos} videos
        </span>
      )}
      <span className="row" style={{ gap: 5 }}>
        <Heart size={14} /> {album.counts.likes}
      </span>
      <span className="row" style={{ gap: 5 }}>
        <Eye size={14} /> {album.views}
      </span>
    </div>
  )
}
