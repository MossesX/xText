import type { CaptionMode, LayoutConfig, LayoutKind, TileShape } from '../api/types'

export const LAYOUT_KINDS: { kind: LayoutKind; label: string; blurb: string }[] = [
  { kind: 'masonry', label: 'Masonry', blurb: 'Pinterest-style columns with natural aspect ratios.' },
  { kind: 'grid', label: 'Grid', blurb: 'Uniform tiles in a clean grid.' },
  { kind: 'justified', label: 'Justified', blurb: 'Rows of varying widths, edges aligned.' },
  { kind: 'mosaic', label: 'Mosaic', blurb: 'Feature tiles mixed with smaller ones.' },
  { kind: 'filmstrip', label: 'Filmstrip', blurb: 'Large single column, editorial feel.' },
  { kind: 'carousel', label: 'Carousel', blurb: 'One at a time, horizontal slides.' },
]

export const DEFAULT_LAYOUT: LayoutConfig = {
  kind: 'masonry',
  columns: 3,
  gap: 16,
  caption: 'hover',
  shape: 'natural',
  rounded: true,
  hoverZoom: true,
  showLikes: true,
  heroCover: true,
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Randomly generate a layout that makes sense for the chosen kind. */
export function rollLayout(): LayoutConfig {
  const kind = pick(LAYOUT_KINDS).kind
  const captions: CaptionMode[] = ['overlay', 'below', 'hover', 'hidden']
  const shapes: TileShape[] = ['natural', 'square', 'portrait', 'landscape']
  const base: LayoutConfig = {
    kind,
    columns: pick([2, 3, 3, 4, 5]),
    gap: pick([0, 4, 8, 12, 16, 24, 32]),
    caption: pick(captions),
    shape: pick(shapes),
    rounded: Math.random() < 0.6,
    hoverZoom: Math.random() < 0.7,
    showLikes: Math.random() < 0.8,
    heroCover: Math.random() < 0.6,
  }
  switch (kind) {
    case 'masonry':
      return { ...base, shape: 'natural' }
    case 'justified':
      return { ...base, shape: 'natural', columns: pick([3, 4, 5]) }
    case 'mosaic':
      return { ...base, shape: 'square', columns: pick([3, 4]) }
    case 'filmstrip':
      return { ...base, columns: 1, shape: 'natural', caption: pick(['below', 'overlay']) }
    case 'carousel':
      return { ...base, columns: 1, shape: 'natural', caption: pick(['below', 'overlay', 'hidden']) }
    case 'grid':
      return { ...base, shape: pick(['square', 'portrait', 'landscape', 'circle']) }
  }
}
