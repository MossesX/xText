import { Link } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { useFavorites } from '../api/hooks'
import { AlbumCard } from '../components/AlbumCard'
import { AlbumCardSkeleton } from '../components/Skeleton'

export function FavoritesPage() {
  const { data, isLoading } = useFavorites()
  return (
    <main className="page">
      <section className="toolbar">
        <div>
          <div className="eyebrow">Your collection</div>
          <h2 style={{ margin: 0 }}>Saved galleries</h2>
        </div>
      </section>
      {isLoading ? (
        <div className="album-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <AlbumCardSkeleton key={i} />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="empty">
          <Bookmark size={40} strokeWidth={1.2} />
          <p style={{ marginTop: 12 }}>Nothing saved yet. Use “Save” on any gallery to keep it here.</p>
          <Link to="/">Browse galleries →</Link>
        </div>
      ) : (
        <div className="album-grid">
          {data.map((a) => (
            <AlbumCard album={a} key={a.id} />
          ))}
        </div>
      )}
    </main>
  )
}
