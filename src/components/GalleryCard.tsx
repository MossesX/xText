import { Link } from 'react-router-dom'
import { Images, Users } from 'lucide-react'
import type { Gallery } from '../api/types'

export function GalleryCard({ gallery, to }: { gallery: Gallery; to?: string }) {
  return (
    <Link to={to ?? `/g/${gallery.slug}`} className="gallery-card">
      {gallery.splash ? <img src={gallery.splash.thumbUrl ?? gallery.splash.url} alt="" /> : <div className="cover-placeholder" style={{ position: 'absolute', inset: 0 }} />}
      <div className="shade" />
      <div className="content">
        <div className="eyebrow light">{gallery.owner ? `Curated by ${gallery.owner.displayName}` : 'Gallery'}</div>
        <h3>{gallery.title}</h3>
        {gallery.tagline && <p className="small" style={{ margin: 0, opacity: 0.85 }}>{gallery.tagline}</p>}
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <span className="chip chip-glass">
            <Images size={11} /> {gallery.counts.albums} albums
          </span>
          <span className="chip chip-glass">
            <Users size={11} /> {gallery.counts.members}
          </span>
        </div>
      </div>
    </Link>
  )
}
