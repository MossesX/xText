import { db } from './db.js'
import { parseJson } from './util.js'
import { galleryById, type GalleryRow } from './access.js'

export function galleryJson(g: GalleryRow, userId?: number) {
  const owner = db.prepare('SELECT id, display_name, username FROM users WHERE id = ?').get(g.owner_user_id) as { id: number; display_name: string; username: string } | undefined
  const splash = g.splash_media_id ? (db.prepare('SELECT * FROM media WHERE id = ?').get(g.splash_media_id) as Record<string, unknown> | undefined) : undefined
  const albums = (db.prepare("SELECT COUNT(*) c FROM albums WHERE gallery_id = ? AND visibility = 'published'").get(g.id) as { c: number }).c
  const members = (db.prepare('SELECT COUNT(*) c FROM gallery_access WHERE gallery_id = ?').get(g.id) as { c: number }).c
  const publicAlbum = g.public_album_id ? (db.prepare('SELECT id, slug, title FROM albums WHERE id = ? AND gallery_id = ?').get(g.public_album_id, g.id) as { id: number; slug: string; title: string } | undefined) : undefined
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    tagline: g.tagline,
    headline: g.headline,
    owner: owner ? { id: owner.id, displayName: owner.display_name, username: owner.username } : null,
    isMine: userId != null && g.owner_user_id === userId,
    splash: splash ? mediaJson(splash) : null,
    splashMediaId: g.splash_media_id,
    themeId: g.theme_id,
    publicAlbumId: g.public_album_id,
    publicAlbum: publicAlbum ?? null,
    counts: { albums, members },
    createdAt: g.created_at,
  }
}

export function albumJson(row: Record<string, unknown>, userId?: number, opts: { access?: boolean } = {}) {
  const id = row.id as number
  const counts = db.prepare('SELECT COUNT(*) c, COALESCE(SUM(kind = \'video\'), 0) v FROM media WHERE album_id = ?').get(id) as { c: number; v: number }
  const likes = (db.prepare('SELECT COUNT(*) c FROM likes l JOIN media m ON m.id = l.media_id WHERE m.album_id = ?').get(id) as { c: number }).c
  const comments = (db.prepare('SELECT COUNT(*) c FROM comments WHERE album_id = ? OR media_id IN (SELECT id FROM media WHERE album_id = ?)').get(id, id) as { c: number }).c
  const favorites = (db.prepare('SELECT COUNT(*) c FROM favorites WHERE album_id = ?').get(id) as { c: number }).c
  let cover = row.cover_media_id ? (db.prepare('SELECT * FROM media WHERE id = ? AND album_id = ?').get(row.cover_media_id as number, id) as Record<string, unknown> | undefined) : undefined
  if (!cover) cover = db.prepare('SELECT * FROM media WHERE album_id = ? ORDER BY sort_order LIMIT 1').get(id) as Record<string, unknown> | undefined
  const favorited = userId != null ? !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND album_id = ?').get(userId, id) : false
  const gallery = galleryById(row.gallery_id as number)
  const allowedUserIds = opts.access ? (db.prepare('SELECT user_id FROM album_access WHERE album_id = ?').all(id) as { user_id: number }[]).map((r) => r.user_id) : undefined
  return {
    id,
    galleryId: row.gallery_id,
    gallery: gallery ? { id: gallery.id, slug: gallery.slug, title: gallery.title, publicAlbumId: gallery.public_album_id } : null,
    slug: row.slug,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    restricted: !!row.restricted,
    allowedUserIds,
    isPublic: gallery?.public_album_id === id,
    tags: parseJson<string[]>(row.tags, []),
    layoutOverride: row.layout_override ? parseJson(row.layout_override, null) : null,
    sortOrder: row.sort_order,
    featured: !!row.featured,
    views: row.views,
    shareToken: row.share_token ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    coverMediaId: row.cover_media_id ?? null,
    cover: cover ? mediaJson(cover) : null,
    counts: { media: counts.c, videos: counts.v, likes, comments, favorites },
    favorited,
  }
}

export function mediaJson(row: Record<string, unknown>, userId?: number, urlSuffix = '') {
  const id = row.id as number
  const likes = (db.prepare('SELECT COUNT(*) c FROM likes WHERE media_id = ?').get(id) as { c: number }).c
  const comments = (db.prepare('SELECT COUNT(*) c FROM comments WHERE media_id = ?').get(id) as { c: number }).c
  const liked = userId != null ? !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND media_id = ?').get(userId, id) : false
  return {
    id,
    albumId: row.album_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    mimeType: row.mime,
    width: row.width,
    height: row.height,
    size: row.size,
    duration: row.duration ?? null,
    sortOrder: row.sort_order,
    views: row.views,
    createdAt: row.created_at,
    url: `/api/media/${id}/file${urlSuffix}`,
    thumbUrl: row.thumb_path ? `/api/media/${id}/thumb${urlSuffix}` : row.kind === 'image' ? `/api/media/${id}/file${urlSuffix}` : null,
    likes,
    comments,
    liked,
  }
}

export function commentJson(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id ?? null,
    albumId: row.album_id ?? null,
    body: row.body,
    createdAt: row.created_at,
    author: { id: row.user_id, displayName: row.display_name ?? 'Removed user', username: row.username ?? '' },
  }
}
