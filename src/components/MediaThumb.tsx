import { useObjectUrl } from '../lib/useObjectUrl'
import type { MediaItem } from '../db/types'

/** Renders the thumbnail (or the full image when no thumb exists) for a media item. */
export function MediaThumb({ item, className, alt }: { item: MediaItem; className?: string; alt?: string }) {
  const url = useObjectUrl(item.thumb ?? (item.kind === 'image' ? item.blob : undefined))
  if (!url) {
    return <div className={className} style={{ width: '100%', aspectRatio: `${item.width} / ${item.height}`, background: 'var(--c-surface-hover)' }} />
  }
  return <img src={url} alt={alt ?? item.title} className={className} loading="lazy" width={item.width} height={item.height} />
}
