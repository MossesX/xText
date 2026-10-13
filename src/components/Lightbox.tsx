import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, MessageSquare, X } from 'lucide-react'
import type { MediaItem } from '../db/types'
import { useObjectUrl } from '../lib/useObjectUrl'
import { LikeButton } from './LikeButton'
import { Comments } from './Comments'
import { formatDuration } from '../lib/media'

interface Props {
  items: MediaItem[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
  allowComments: boolean
  allowLikes: boolean
}

function Stage({ item }: { item: MediaItem }) {
  const url = useObjectUrl(item.blob)
  if (!url) return <div className="spinner" />
  if (item.kind === 'video') return <video src={url} controls autoPlay playsInline />
  return <img src={url} alt={item.title} />
}

export function Lightbox({ items, index, onClose, onNavigate, allowComments, allowLikes }: Props) {
  const item = items[index]
  const [sideOpen, setSideOpen] = useState(true)

  const prev = useCallback(() => onNavigate((index - 1 + items.length) % items.length), [index, items.length, onNavigate])
  const next = useCallback(() => onNavigate((index + 1) % items.length), [index, items.length, onNavigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, prev, next])

  if (!item) return null

  return (
    <div className="lightbox">
      <div className="stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <button className="lb-btn lb-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <button className="lb-btn side-toggle" onClick={() => setSideOpen((v) => !v)} aria-label="Toggle details">
          <MessageSquare size={18} />
        </button>
        {items.length > 1 && (
          <>
            <button className="lb-btn lb-prev" onClick={prev} aria-label="Previous">
              <ChevronLeft size={22} />
            </button>
            <button className="lb-btn lb-next" onClick={next} aria-label="Next">
              <ChevronRight size={22} />
            </button>
          </>
        )}
        <Stage key={item.id} item={item} />
        <div className="counter">
          {index + 1} / {items.length}
        </div>
      </div>
      <aside className={`side ${sideOpen ? '' : 'collapsed'}`}>
        <div className="side-head">
          <div className="eyebrow">
            {item.kind} {item.duration ? `· ${formatDuration(item.duration)}` : ''} · {item.width}×{item.height}
          </div>
          <h3 style={{ marginTop: 6 }}>{item.title || 'Untitled'}</h3>
          {item.description && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>}
          {allowLikes && item.id != null && <LikeButton mediaId={item.id} />}
        </div>
        {allowComments && item.id != null && (
          <div className="side-body">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Comments
            </div>
            <Comments mediaId={item.id} />
          </div>
        )}
      </aside>
    </div>
  )
}
