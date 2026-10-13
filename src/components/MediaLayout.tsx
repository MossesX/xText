import { useRef, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Heart, Play } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { LayoutConfig, MediaItem } from '../db/types'
import { MediaThumb } from './MediaThumb'
import { formatDuration } from '../lib/media'
import { useSession } from '../store/session'

interface Props {
  items: MediaItem[]
  layout: LayoutConfig
  onOpen: (index: number) => void
}

interface TileProps {
  item: MediaItem
  layout: LayoutConfig
  onOpen: (i: number) => void
  index: number
  frameClass?: string
  frameStyle?: CSSProperties
}

function Tile({ item, layout, onOpen, index, frameClass = '', frameStyle }: TileProps) {
  const user = useSession((s) => s.user)
  const likeCount =
    useLiveQuery(async () => {
      if (!layout.showLikes || item.id == null) return 0
      return db.likes.where('mediaId').equals(item.id).count()
    }, [item.id, layout.showLikes]) ?? 0
  const liked = useLiveQuery(async () => {
    if (!layout.showLikes || item.id == null || user?.id == null) return undefined
    return db.likes.where('[userId+mediaId]').equals([user.id, item.id]).first()
  }, [item.id, user?.id, layout.showLikes])
  const cls = ['tile', `shape-${layout.shape}`, layout.rounded ? 'rounded' : '', layout.hoverZoom ? 'zoom' : ''].join(' ')
  const captionInside = layout.caption === 'overlay' || layout.caption === 'hover'
  const hasCaption = item.title || item.description
  return (
    <div className={`tile-frame ${layout.caption === 'below' ? 'below-caption' : ''} ${frameClass}`} style={frameStyle}>
      <div className={cls} onClick={() => onOpen(index)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(index)}>
        <MediaThumb item={item} />
        {item.kind === 'video' && (
          <span className="kind-badge">
            <Play size={11} fill="currentColor" /> {formatDuration(item.duration) || 'Video'}
          </span>
        )}
        {layout.showLikes && likeCount > 0 && (
          <span className={`likes ${liked ? 'liked' : ''}`}>
            <Heart size={11} fill={liked ? 'currentColor' : 'none'} /> {likeCount}
          </span>
        )}
        {captionInside && hasCaption && (
          <div className={`caption ${layout.caption}`}>
            <strong>{item.title}</strong>
            {item.description && <span>{item.description}</span>}
          </div>
        )}
      </div>
      {layout.caption === 'below' && hasCaption && (
        <div className="caption below">
          <strong>{item.title}</strong>
          {item.description && <span>{item.description}</span>}
        </div>
      )}
    </div>
  )
}

export function MediaLayout({ items, layout, onOpen }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const style = { '--gap': `${layout.gap}px`, '--cols': layout.columns } as CSSProperties

  if (items.length === 0) return <div className="empty">This album has no media yet.</div>

  if (layout.kind === 'justified') {
    return (
      <div className={`media-layout layout-${layout.kind}`} style={style}>
        {items.map((item, i) => {
          const ratio = item.width / Math.max(1, item.height)
          const rowHeight = 1400 / Math.max(2, layout.columns)
          const basis = Math.round(ratio * (rowHeight / 4))
          return (
            <Tile
              key={item.id}
              item={item}
              layout={{ ...layout, shape: 'natural' }}
              onOpen={onOpen}
              index={i}
              frameStyle={{ '--grow': ratio * 100, '--basis': `${basis}px` } as CSSProperties}
            />
          )
        })}
      </div>
    )
  }

  if (layout.kind === 'carousel') {
    const scrollBy = (dir: 1 | -1) => {
      const el = trackRef.current
      if (!el) return
      el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
    }
    return (
      <div className={`media-layout layout-carousel`} style={style}>
        <div className="track" ref={trackRef}>
          {items.map((item, i) => (
            <Tile key={item.id} item={item} layout={{ ...layout, shape: 'landscape' }} onOpen={onOpen} index={i} />
          ))}
        </div>
        {items.length > 1 && (
          <div className="arrows">
            <button className="btn icon" onClick={() => scrollBy(-1)} aria-label="Previous">
              <ChevronLeft size={18} />
            </button>
            <button className="btn icon" onClick={() => scrollBy(1)} aria-label="Next">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    )
  }

  if (layout.kind === 'mosaic') {
    return (
      <div className={`media-layout layout-mosaic`} style={style}>
        {items.map((item, i) => (
          <Tile
            key={item.id}
            item={item}
            layout={{ ...layout, shape: 'natural' }}
            onOpen={onOpen}
            index={i}
            frameClass={i % 7 === 0 || (i % 7 === 4 && items.length > 5) ? 'feature' : ''}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`media-layout layout-${layout.kind}`} style={style}>
      {items.map((item, i) => (
        <Tile key={item.id} item={item} layout={layout} onOpen={onOpen} index={i} />
      ))}
    </div>
  )
}
