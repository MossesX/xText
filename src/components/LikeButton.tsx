import { Heart } from 'lucide-react'
import { useToggleLike } from '../api/hooks'
import type { MediaItem } from '../api/types'

export function LikeButton({ item, compact = false }: { item: MediaItem; compact?: boolean }) {
  const toggle = useToggleLike()
  return (
    <button className={`btn like-btn ${item.liked ? 'liked' : ''} ${compact ? 'sm' : ''}`} onClick={() => toggle.mutate(item.id)} aria-pressed={item.liked} disabled={toggle.isPending}>
      <Heart size={16} fill={item.liked ? 'currentColor' : 'none'} />
      {item.likes} {compact ? '' : item.likes === 1 ? 'like' : 'likes'}
    </button>
  )
}
