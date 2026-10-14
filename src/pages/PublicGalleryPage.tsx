import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePublicGallery, useSettings } from '../api/hooks'
import { MediaLayout } from '../components/MediaLayout'
import { Lightbox } from '../components/Lightbox'
import { PageLoader } from '../components/Skeleton'
import { AmberMark, Wordmark } from '../brand/Logo'
import { Toast } from '../components/Toast'
import { ColorModeToggle } from '../components/ColorModeToggle'
import { useGalleryTheme } from '../components/GalleryTheme'

/** Login-free landing page for a gallery: its splash screen and its public album. */
export function PublicGalleryPage() {
  const { slug } = useParams()
  const { data: site } = useSettings()
  const { data, isLoading, error } = usePublicGallery(slug)
  const [open, setOpen] = useState<number | null>(null)
  useGalleryTheme(data?.theme)

  if (isLoading || !site) return <PageLoader />
  const layout = data?.album?.layoutOverride ?? site.settings.defaultLayout

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <AmberMark size={34} />
            <Wordmark title={site.settings.siteTitle} brand={site.settings.brandName} />
          </Link>
          <nav className="nav">
            <ColorModeToggle />
            <Link to="/login" className="btn primary sm">
              Member sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="page">
        {error || !data ? (
          <div className="empty">
            <p>This gallery is not available.</p>
          </div>
        ) : (
          <>
            <section className="hero-feature">
              {data.gallery.splash && <img className="hero-bg" src={data.gallery.splash.thumbUrl ?? data.gallery.splash.url} alt="" />}
              <div className="hero-shade" />
              <div className="hero-content">
                <div className="eyebrow light">{data.gallery.owner ? `Curated by ${data.gallery.owner.displayName}` : 'Gallery'}</div>
                <h1>{data.gallery.headline || data.gallery.title}</h1>
                {data.gallery.tagline && <p className="lead">{data.gallery.tagline}</p>}
              </div>
            </section>
            {data.album ? (
              <>
                <section className="toolbar">
                  <div>
                    <div className="eyebrow">Public album</div>
                    <h2 style={{ margin: 0 }}>{data.album.title}</h2>
                    {data.album.description && <p className="muted" style={{ margin: '6px 0 0', maxWidth: 720 }}>{data.album.description}</p>}
                  </div>
                </section>
                <MediaLayout items={data.media} layout={{ ...layout, showLikes: false, heroCover: false }} onOpen={setOpen} />
                {open != null && (
                  <Lightbox items={data.media} index={open} onClose={() => setOpen(null)} onNavigate={setOpen} allowComments={false} allowLikes={false} allowDownloads={site.settings.allowDownloads} readOnly />
                )}
              </>
            ) : (
              <div className="empty">This gallery has no public album yet. Members can sign in to see more.</div>
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>
            {site.settings.siteTitle} · {site.settings.tagline}
          </span>
        </div>
      </footer>
      <Toast />
    </div>
  )
}
