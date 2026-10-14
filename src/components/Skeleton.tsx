import type { CSSProperties } from 'react'

export function Skeleton({ style, className = '' }: { style?: CSSProperties; className?: string }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />
}

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading">
      <div className="spinner" />
    </div>
  )
}

export function AlbumCardSkeleton() {
  return (
    <div className="album-card skeleton-card">
      <Skeleton style={{ aspectRatio: '4 / 3' }} />
      <div className="body stack" style={{ gap: 8 }}>
        <Skeleton style={{ height: 20, width: '60%' }} />
        <Skeleton style={{ height: 14, width: '90%' }} />
        <Skeleton style={{ height: 14, width: '40%' }} />
      </div>
    </div>
  )
}
