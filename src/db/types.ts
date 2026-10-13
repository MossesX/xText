export type Role = 'admin' | 'user'

export interface User {
  id?: number
  username: string
  displayName: string
  role: Role
  passwordHash: string
  salt: string
  createdAt: number
  disabled?: boolean
}

export type Visibility = 'published' | 'draft'

export interface Album {
  id?: number
  slug: string
  title: string
  description: string
  coverMediaId?: number
  visibility: Visibility
  tags: string[]
  /** null/undefined = inherit the global default layout */
  layoutOverride?: LayoutConfig | null
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export type MediaKind = 'image' | 'video'

export interface MediaItem {
  id?: number
  albumId: number
  kind: MediaKind
  title: string
  description: string
  mimeType: string
  blob: Blob
  thumb?: Blob
  width: number
  height: number
  size: number
  duration?: number
  sortOrder: number
  createdAt: number
}

export interface Like {
  id?: number
  userId: number
  mediaId: number
  createdAt: number
}

export interface Comment {
  id?: number
  userId: number
  /** either a media comment or an album comment */
  mediaId?: number
  albumId?: number
  body: string
  createdAt: number
}

/* ---------- Theme ---------- */

export interface Palette {
  bg: string
  bgElevated: string
  surface: string
  surfaceHover: string
  border: string
  text: string
  textMuted: string
  primary: string
  primaryText: string
  accent: string
  accentText: string
  danger: string
  success: string
}

export interface Theme {
  id?: number
  name: string
  light: Palette
  dark: Palette
  fontDisplay: string
  fontBody: string
  radius: number
  /** overall density/spacing scale 0.85..1.15 */
  scale: number
  createdAt: number
  builtIn?: boolean
}

/* ---------- Layout ---------- */

export type LayoutKind = 'masonry' | 'grid' | 'justified' | 'mosaic' | 'filmstrip' | 'carousel'

export type CaptionMode = 'overlay' | 'below' | 'hover' | 'hidden'
export type TileShape = 'natural' | 'square' | 'portrait' | 'landscape' | 'circle'

export interface LayoutConfig {
  kind: LayoutKind
  columns: number
  gap: number
  caption: CaptionMode
  shape: TileShape
  rounded: boolean
  hoverZoom: boolean
  showLikes: boolean
  heroCover: boolean
}

export interface Settings {
  key: string
  value: unknown
}

export interface SiteSettings {
  siteTitle: string
  tagline: string
  activeThemeId: number | null
  defaultLayout: LayoutConfig
  allowComments: boolean
  allowLikes: boolean
}
