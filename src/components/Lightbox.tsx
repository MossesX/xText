import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Info, Maximize2, Pause, Play, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { MediaItem } from '../api/types'
import { LikeButton } from './LikeButton'
import { Comments } from './Comments'
import { formatBytes, formatDuration } from '../lib/media'
import { api } from '../api/client'

interface Props {
  items: MediaItem[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
  allowComments: boolean
  allowLikes: boolean
  allowDownloads: boolean
  /** Public share mode: no likes/comments/views. */
  readOnly?: boolean
}

function Stage({ item, zoom, onToggleZoom }: { item: MediaItem; zoom: boolean; onToggleZoom: () => void }) {
  if (item.kind === 'video') return <video key={item.id} src={item.url} controls autoPlay playsInline />
  return <img key={item.id} src={item.url} alt={item.title} className={zoom ? 'zoomed' : ''} onClick={onToggleZoom} draggable={false} />
}

export function Lightbox({ items, index, onClose, onNavigate, allowComments, allowLikes, allowDownloads, readOnly }: Props) {
  const item = items[index]
  const [sideOpen, setSideOpen] = useState(() => window.innerWidth > 900)
  const [zoom, setZoom] = useState(false)
  const [playing, setPlaying] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<number | null>(null)

  const prev = useCallback(() => onNavigate((index - 1 + items.length) % items.length), [index, items.length, onNavigate])
  const next = useCallback(() => onNavigate((index + 1) % items.length), [index, items.length, onNavigate])

  useEffect(() => setZoom(false), [index])

  useEffect(() => {
    if (!readOnly && item) api.post(`/api/media/${item.id}/view`).catch(() => undefined)
  }, [item?.id, readOnly, item])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(next, 4000)
    return () => clearInterval(t)
  }, [playing, next])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key === 'i') setSideOpen((s) => !s)
      else if (e.key === 'z') setZoom((z) => !z)
      else if (e.key === 'f') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, prev, next])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    else stageRef.current?.parentElement?.requestFullscreen?.().catch(() => undefined)
  }

  if (!item) return null

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.title || 'Media viewer'}>
      <div
        className="stage"
        ref={stageRef}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStart.current == null) return
          const dx = e.changedTouches[0].clientX - touchStart.current
          if (Math.abs(dx) > 60) (dx > 0 ? prev : next)()
          touchStart.current = null
        }}
      >
        <div className="lb-toolbar lb-toolbar-left">
          <button className="lb-btn" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <X size={20} />
          </button>
        </div>
        <div className="lb-toolbar lb-toolbar-right">
          {item.kind === 'image' && (
            <button className="lb-btn" onClick={() => setZoom((z) => !z)} aria-label="Zoom" title="Zoom (Z)">
              {zoom ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
            </button>
          )}
          {items.length > 1 && (
            <button className={`lb-btn ${playing ? 'active' : ''}`} onClick={() => setPlaying((p) => !p)} aria-label="Slideshow" title="Slideshow (Space)">
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}
          <button className="lb-btn" onClick={toggleFullscreen} aria-label="Fullscreen" title="Fullscreen (F)">
            <Maximize2 size={18} />
          </button>
          {allowDownloads && (
            <a className="lb-btn" href={`${item.url}${item.url.includes('?') ? '&' : '?'}download=1`} aria-label="Download" title="Download">
              <Download size={18} />
            </a>
          )}
          <button className={`lb-btn ${sideOpen ? 'active' : ''}`} onClick={() => setSideOpen((v) => !v)} aria-label="Details" title="Details (I)">
            <Info size={18} />
          </button>
        </div>
        {items.length > 1 && (
          <>
            <button className="lb-btn lb-prev" onClick={prev} aria-label="Previous" title="Previous (←)">
              <ChevronLeft size={22} />
            </button>
            <button className="lb-btn lb-next" onClick={next} aria-label="Next" title="Next (→)">
              <ChevronRight size={22} />
            </button>
          </>
        )}
        <Stage item={item} zoom={zoom} onToggleZoom={() => setZoom((z) => !z)} />
        <div className="counter">
          {index + 1} / {items.length}
          {playing && <span className="pulse" />}
        </div>
      </div>
      <aside className={`side ${sideOpen ? '' : 'collapsed'}`}>
        <div className="side-head">
          <div className="eyebrow">
            {item.kind} · {item.width}×{item.height}
            {item.duration ? ` · ${formatDuration(item.duration)}` : ''} · {formatBytes(item.size)}
          </div>
          <h3 style={{ marginTop: 6 }}>{item.title || 'Untitled'}</h3>
          {item.description && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>}
          <div className="row" style={{ gap: 10 }}>
            {allowLikes && !readOnly && <LikeButton item={item} />}
            <span className="muted small">{item.views} views</span>
          </div>
        </div>
        {allowComments && !readOnly && (
          <div className="side-body">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Comments
            </div>
            <Comments mediaId={item.id} />
          </div>
        )}
        {readOnly && (
          <div className="side-body">
            <p className="muted small">You are viewing a shared link. Sign in to like and comment.</p>
          </div>
        )}
      </aside>
    </div>
  )
}
