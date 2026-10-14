import { Link } from 'react-router-dom'
import { Clapperboard, Eye, Heart, Images, MessageSquare, Star } from 'lucide-react'
import type { Album } from '../api/types'
import { MediaThumb } from './MediaThumb'
import { FavoriteButton } from './FavoriteButton'

export function AlbumCard({ album, large = false }: { album: Album; large?: boolean }) {
  return (
    <Link to={`/album/${album.slug}`} className={`album-card ${large ? 'large' : ''}`}>
      <div className="cover">
        {album.cover ? (
          <MediaThumb item={album.cover} alt="" />
        ) : (
          <div className="cover-placeholder">
            <Images size={36} strokeWidth={1.2} />
          </div>
        )}
        <div className="cover-top">
          <div className="row" style={{ gap: 6 }}>
            {album.featured && (
              <span className="chip chip-accent">
                <Star size={11} fill="currentColor" /> Featured
              </span>
            )}
            {album.visibility === 'draft' && <span className="chip">Draft</span>}
          </div>
          <FavoriteButton album={album} compact />
        </div>
        <div className="cover-bottom">
          <span className="chip chip-glass">
            <Images size={11} /> {album.counts.media}
          </span>
          {album.counts.videos > 0 && (
            <span className="chip chip-glass">
              <Clapperboard size={11} /> {album.counts.videos}
            </span>
          )}
        </div>
      </div>
      <div className="body">
        <h3>{album.title}</h3>
        {album.description && <p className="muted small clamp-2">{album.description}</p>}
        <div className="row between" style={{ marginTop: 'auto' }}>
          <div className="row" style={{ gap: 6 }}>
            {album.tags.slice(0, 3).map((t) => (
              <span className="badge primary" key={t}>
                {t}
              </span>
            ))}
          </div>
          <div className="row muted small" style={{ gap: 10 }}>
            <span className="row" style={{ gap: 3 }}>
              <Heart size={12} /> {album.counts.likes}
            </span>
            <span className="row" style={{ gap: 3 }}>
              <MessageSquare size={12} /> {album.counts.comments}
            </span>
            <span className="row" style={{ gap: 3 }}>
              <Eye size={12} /> {album.views}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
