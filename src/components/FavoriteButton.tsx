import { Bookmark } from 'lucide-react'
import { useToggleFavorite } from '../api/hooks'
import type { Album } from '../api/types'

export function FavoriteButton({ album, compact = false }: { album: Album; compact?: boolean }) {
  const toggle = useToggleFavorite()
  return (
    <button
      className={`btn ${compact ? 'icon' : ''} ${album.favorited ? 'primary' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle.mutate(album.id)
      }}
      title={album.favorited ? 'Remove from favourites' : 'Save to favourites'}
      aria-pressed={album.favorited}
      disabled={toggle.isPending}
    >
      <Bookmark size={16} fill={album.favorited ? 'currentColor' : 'none'} />
      {!compact && (album.favorited ? 'Saved' : 'Save')}
    </button>
  )
}
