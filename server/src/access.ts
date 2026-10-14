import { db, now } from './db.js'
import { slugify } from './util.js'
import type { User } from './auth.js'

export interface GalleryRow {
  id: number
  owner_user_id: number
  slug: string
  title: string
  tagline: string
  headline: string
  splash_media_id: number | null
  theme_id: number | null
  public_album_id: number | null
  created_at: number
  updated_at: number
}

export function isOwner(u?: User | null): boolean {
  return u?.role === 'owner'
}

export function isAdmin(u?: User | null): boolean {
  return u?.role === 'owner' || u?.role === 'admin'
}

export function galleryById(id: number): GalleryRow | undefined {
  return db.prepare('SELECT * FROM galleries WHERE id = ?').get(id) as GalleryRow | undefined
}

export function galleryOf(userId: number): GalleryRow | undefined {
  return db.prepare('SELECT * FROM galleries WHERE owner_user_id = ?').get(userId) as GalleryRow | undefined
}

function uniqueGallerySlug(base: string): string {
  const root = slugify(base)
  let slug = root
  let n = 2
  while (db.prepare('SELECT 1 FROM galleries WHERE slug = ?').get(slug)) slug = `${root}-${n++}`
  return slug
}

/** Every owner/admin account gets exactly one gallery. Creates it when missing. */
export function ensureGalleryFor(userId: number, displayName: string): GalleryRow {
  const existing = galleryOf(userId)
  if (existing) return existing
  const t = now()
  const title = `${displayName}'s Gallery`
  db.prepare('INSERT INTO galleries(owner_user_id, slug, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(userId, uniqueGallerySlug(displayName), title, t, t)
  grantGallery(userId, galleryOf(userId)!.id)
  return galleryOf(userId)!
}

export function grantGallery(userId: number, galleryId: number): void {
  db.prepare('INSERT OR IGNORE INTO gallery_access(user_id, gallery_id, created_at) VALUES (?, ?, ?)').run(userId, galleryId, now())
}

/** Can this user manage (edit) the gallery? Owners manage all; admins manage their own. */
export function canManageGallery(u: User | undefined, galleryId: number): boolean {
  if (!u) return false
  if (isOwner(u)) return true
  const g = galleryById(galleryId)
  return !!g && g.owner_user_id === u.id
}

/** Can this user browse the gallery at all? */
export function canViewGallery(u: User | undefined, galleryId: number): boolean {
  if (!u) return false
  if (isOwner(u)) return true
  if (canManageGallery(u, galleryId)) return true
  return !!db.prepare('SELECT 1 FROM gallery_access WHERE user_id = ? AND gallery_id = ?').get(u.id, galleryId)
}

export interface AlbumAccessRow {
  id: number
  gallery_id: number
  visibility: string
  restricted: number
}

/** Can this user see the album (published state + gallery access + per-user restriction)? */
export function canViewAlbum(u: User | undefined, album: AlbumAccessRow): boolean {
  if (!u) return false
  if (canManageGallery(u, album.gallery_id)) return true
  if (album.visibility !== 'published') return false
  if (!canViewGallery(u, album.gallery_id)) return false
  if (!album.restricted) return true
  return !!db.prepare('SELECT 1 FROM album_access WHERE album_id = ? AND user_id = ?').get(album.id, u.id)
}

/** Gallery ids the user may browse. */
export function accessibleGalleryIds(u: User): number[] {
  if (isOwner(u)) return (db.prepare('SELECT id FROM galleries').all() as { id: number }[]).map((r) => r.id)
  const rows = db.prepare('SELECT gallery_id AS id FROM gallery_access WHERE user_id = ? UNION SELECT id FROM galleries WHERE owner_user_id = ?').all(u.id, u.id) as { id: number }[]
  return rows.map((r) => r.id)
}

/** Gallery ids the user may manage. */
export function managedGalleryIds(u: User): number[] {
  if (isOwner(u)) return (db.prepare('SELECT id FROM galleries').all() as { id: number }[]).map((r) => r.id)
  const g = galleryOf(u.id)
  return g ? [g.id] : []
}

/** SQL fragment selecting album rows visible to the user (without per-user restriction, applied in JS). */
export function visibleAlbumRows(u: User): Record<string, unknown>[] {
  const ids = accessibleGalleryIds(u)
  if (!ids.length) return []
  const managed = new Set(managedGalleryIds(u))
  const rows = db.prepare(`SELECT * FROM albums WHERE gallery_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order, created_at`).all(...ids) as Record<string, unknown>[]
  return rows.filter((r) => {
    if (managed.has(r.gallery_id as number)) return true
    return canViewAlbum(u, { id: r.id as number, gallery_id: r.gallery_id as number, visibility: r.visibility as string, restricted: r.restricted as number })
  })
}
