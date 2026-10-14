import { useState } from 'react'
import type { MediaItem } from '../api/types'

/** Renders the thumbnail for a media item with a blur-up placeholder. */
export function MediaThumb({ item, className, alt, sizes }: { item: MediaItem; className?: string; alt?: string; sizes?: string }) {
  const [loaded, setLoaded] = useState(false)
  const src = item.thumbUrl ?? item.url
  return (
    <img
      src={src}
      alt={alt ?? item.title}
      className={`${className ?? ''} ${loaded ? 'is-loaded' : 'is-loading'}`}
      loading="lazy"
      decoding="async"
      width={item.width || undefined}
      height={item.height || undefined}
      sizes={sizes}
      onLoad={() => setLoaded(true)}
      style={{ aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : undefined }}
    />
  )
}
