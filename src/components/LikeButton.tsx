import { Heart } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useSession } from '../store/session'

export function useLikeState(mediaId: number) {
  const user = useSession((s) => s.user)
  const count = useLiveQuery(() => db.likes.where('mediaId').equals(mediaId).count(), [mediaId]) ?? 0
  const mine = useLiveQuery(async () => {
    if (user?.id == null) return undefined
    return db.likes.where('[userId+mediaId]').equals([user.id, mediaId]).first()
  }, [user?.id, mediaId])
  const toggle = async () => {
    if (user?.id == null) return
    if (mine?.id != null) await db.likes.delete(mine.id)
    else await db.likes.add({ userId: user.id, mediaId, createdAt: Date.now() })
  }
  return { count, liked: !!mine, toggle }
}

export function LikeButton({ mediaId }: { mediaId: number }) {
  const { count, liked, toggle } = useLikeState(mediaId)
  return (
    <button className={`btn like-btn ${liked ? 'liked' : ''}`} onClick={toggle} aria-pressed={liked}>
      <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
      {count} {count === 1 ? 'like' : 'likes'}
    </button>
  )
}
