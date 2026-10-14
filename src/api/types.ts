export type Role = 'owner' | 'admin' | 'user'

export interface User {
  id: number
  username: string
  display_name: string
  role: Role
  disabled: number
  bio: string
  created_at: number
  last_seen_at: number | null
  status: 'active' | 'pending'
  created_by: number | null
  likes?: number
  comments?: number
  galleryIds?: number[]
  ownGalleryId?: number | null
}

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
  id: number
  name: string
  light: Palette
  dark: Palette
  fontDisplay: string
  fontBody: string
  radius: number
  scale: number
  builtIn: boolean
  createdAt: number
}

export type ThemeDraft = Omit<Theme, 'id' | 'createdAt' | 'builtIn'>

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

export interface SiteSettings {
  siteTitle: string
  tagline: string
  brandName: string
  activeThemeId: number | null
  defaultLayout: LayoutConfig
  allowComments: boolean
  allowLikes: boolean
  allowDownloads: boolean
  heroAlbumId: number | null
}

export type MediaKind = 'image' | 'video'

export interface MediaItem {
  id: number
  albumId: number
  kind: MediaKind
  title: string
  description: string
  mimeType: string
  width: number
  height: number
  size: number
  duration: number | null
  sortOrder: number
  views: number
  createdAt: number
  url: string
  thumbUrl: string | null
  likes: number
  comments: number
  liked: boolean
}

export type Visibility = 'published' | 'draft'

export interface GallerySummary {
  id: number
  slug: string
  title: string
  publicAlbumId: number | null
}

export interface Gallery {
  id: number
  slug: string
  title: string
  tagline: string
  headline: string
  owner: { id: number; displayName: string; username: string } | null
  isMine: boolean
  splash: MediaItem | null
  splashMediaId: number | null
  themeId: number | null
  publicAlbumId: number | null
  publicAlbum: { id: number; slug: string; title: string } | null
  counts: { albums: number; members: number }
  createdAt: number
}

export interface Album {
  id: number
  galleryId: number
  gallery: GallerySummary | null
  restricted: boolean
  allowedUserIds?: number[]
  isPublic: boolean
  slug: string
  title: string
  description: string
  visibility: Visibility
  tags: string[]
  layoutOverride: LayoutConfig | null
  sortOrder: number
  featured: boolean
  views: number
  shareToken: string | null
  createdAt: number
  updatedAt: number
  coverMediaId: number | null
  cover: MediaItem | null
  counts: { media: number; videos: number; likes: number; comments: number; favorites: number }
  favorited: boolean
}

export interface Comment {
  id: number
  userId: number
  mediaId: number | null
  albumId: number | null
  body: string
  createdAt: number
  author: { id: number; displayName: string; username: string }
}

export interface Stats {
  albums: number
  published: number
  media: number
  videos: number
  users: number
  activeUsers: number
  pendingUsers: number
  galleries: number
  likes: number
  comments: number
  favorites: number
  bytes: number
  views: number
  recentComments: { id: number; body: string; createdAt: number; author: string; target: string; slug: string | null }[]
  topAlbums: { id: number; title: string; slug: string; views: number; likes: number }[]
}
