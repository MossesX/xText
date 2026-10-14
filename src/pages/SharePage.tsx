import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSettings, useShare } from '../api/hooks'
import { MediaLayout } from '../components/MediaLayout'
import { Lightbox } from '../components/Lightbox'
import { PageLoader } from '../components/Skeleton'
import { AmberMark, Wordmark } from '../brand/Logo'
import { Toast } from '../components/Toast'
import { ColorModeToggle } from '../components/ColorModeToggle'

/** Login-free view of an album through its share token. */
export function SharePage() {
  const { token } = useParams()
  const { data: site } = useSettings()
  const { data, isLoading, error } = useShare(token)
  const [open, setOpen] = useState<number | null>(null)

  if (isLoading || !site) return <PageLoader />

  const layout = data?.album.layoutOverride ?? site.settings.defaultLayout

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
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="page">
        {error || !data ? (
          <div className="empty">
            <p>This share link is not valid or has been turned off.</p>
          </div>
        ) : (
          <>
            <header className="album-header">
              <div className="eyebrow">Shared gallery</div>
              <h1>{data.album.title}</h1>
              {data.album.description && <p className="muted lead" style={{ maxWidth: 720 }}>{data.album.description}</p>}
            </header>
            <MediaLayout items={data.media} layout={{ ...layout, showLikes: false }} onOpen={setOpen} />
            {open != null && (
              <Lightbox items={data.media} index={open} onClose={() => setOpen(null)} onNavigate={setOpen} allowComments={false} allowLikes={false} allowDownloads={site.settings.allowDownloads} readOnly />
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>{site.settings.siteTitle} · {site.settings.tagline}</span>
        </div>
      </footer>
      <Toast />
    </div>
  )
}
