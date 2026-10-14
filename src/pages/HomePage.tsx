import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Images, LayoutGrid, Search, X } from 'lucide-react'
import { useAlbums, useGalleries, useMe, useSettings } from '../api/hooks'
import { AlbumCard } from '../components/AlbumCard'
import { GalleryCard } from '../components/GalleryCard'
import { AlbumCardSkeleton } from '../components/Skeleton'
import { MediaThumb } from '../components/MediaThumb'

const SORTS = [
  ['manual', 'Curated'],
  ['newest', 'Newest'],
  ['updated', 'Recently updated'],
  ['popular', 'Most viewed'],
  ['title', 'A to Z'],
] as const

export function HomePage() {
  const { data: user } = useMe()
  const { data: site } = useSettings()
  const { data: galleries } = useGalleries()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const tag = params.get('tag') ?? ''
  const gallery = params.get('gallery') ?? ''
  const sort = params.get('sort') ?? 'manual'
  const { data, isLoading } = useAlbums({ q: q || undefined, tag: tag || undefined, sort, gallery: gallery || undefined })

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const albums = data?.albums ?? []
  const filtering = !!(q || tag || gallery)
  const hero = useMemo(() => {
    if (filtering) return null
    const byId = site?.settings.heroAlbumId ? albums.find((a) => a.id === site.settings.heroAlbumId) : undefined
    return byId ?? albums.find((a) => a.featured && a.cover) ?? albums.find((a) => a.cover) ?? null
  }, [albums, filtering, site?.settings.heroAlbumId])
  const rest = hero ? albums.filter((a) => a.id !== hero.id) : albums
  const multiGallery = (galleries?.length ?? 0) > 1

  return (
    <main className="page">
      {hero && (
        <section className="hero-feature">
          {hero.cover && <MediaThumb item={hero.cover} alt="" className="hero-bg" />}
          <div className="hero-shade" />
          <div className="hero-content">
            <div className="eyebrow light">Featured gallery{hero.gallery ? ` · ${hero.gallery.title}` : ''}</div>
            <h1>{hero.title}</h1>
            {hero.description && <p className="lead clamp-3">{hero.description}</p>}
            <div className="row" style={{ gap: 12 }}>
              <Link to={`/album/${hero.slug}`} className="btn primary lg">
                Open album <ArrowRight size={16} />
              </Link>
              <span className="chip chip-glass">
                <Images size={12} /> {hero.counts.media} items
              </span>
            </div>
          </div>
        </section>
      )}

      {multiGallery && !filtering && (
        <>
          <section className="toolbar">
            <div>
              <div className="eyebrow">Your access</div>
              <h2 style={{ margin: 0 }}>Galleries</h2>
            </div>
          </section>
          <div className="gallery-grid">
            {galleries!.map((g) => (
              <GalleryCard gallery={g} key={g.id} />
            ))}
          </div>
        </>
      )}

      <section className="toolbar">
        <div>
          <div className="eyebrow">{filtering ? 'Results' : 'All albums'}</div>
          <h2 style={{ margin: 0 }}>
            {q ? `“${q}”` : tag ? `#${tag}` : gallery ? galleries?.find((g) => String(g.id) === gallery)?.title ?? 'Gallery' : `Welcome back, ${user?.display_name?.split(' ')[0] ?? 'friend'}`}
          </h2>
        </div>
        <div className="row">
          {filtering && (
            <button className="btn sm" onClick={() => setParams({}, { replace: true })}>
              <X size={14} /> Clear
            </button>
          )}
          {multiGallery && (
            <select className="select" value={gallery} onChange={(e) => set('gallery', e.target.value)} aria-label="Gallery" style={{ width: 'auto' }}>
              <option value="">All galleries</option>
              {galleries!.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          )}
          <select className="select" value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort" style={{ width: 'auto' }}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!!data?.tags.length && (
        <div className="tag-row">
          {data.tags.map((t) => (
            <button key={t.name} className={`chip chip-tag ${tag === t.name ? 'active' : ''}`} onClick={() => set('tag', tag === t.name ? '' : t.name)}>
              #{t.name} <span className="muted">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="album-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <AlbumCardSkeleton key={i} />
          ))}
        </div>
      ) : rest.length === 0 && !hero ? (
        <div className="empty">
          {filtering ? <Search size={40} strokeWidth={1.2} /> : <LayoutGrid size={40} strokeWidth={1.2} />}
          <p style={{ marginTop: 12 }}>{filtering ? 'Nothing matches that search.' : 'No albums have been shared with you yet.'}</p>
          {user?.role !== 'user' && !filtering && <Link to="/admin/albums">Create your first album →</Link>}
        </div>
      ) : (
        <div className="album-grid">
          {rest.map((a) => (
            <AlbumCard album={a} key={a.id} />
          ))}
        </div>
      )}
    </main>
  )
}
