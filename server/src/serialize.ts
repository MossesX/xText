import { db } from './db.js'
import { parseJson } from './util.js'

export function albumJson(row: Record<string, unknown>, userId?: number) {
  const id = row.id as number
  const counts = db.prepare('SELECT COUNT(*) c, COALESCE(SUM(kind = \'video\'), 0) v FROM media WHERE album_id = ?').get(id) as { c: number; v: number }
  const likes = (db.prepare('SELECT COUNT(*) c FROM likes l JOIN media m ON m.id = l.media_id WHERE m.album_id = ?').get(id) as { c: number }).c
  const comments = (db.prepare('SELECT COUNT(*) c FROM comments WHERE album_id = ? OR media_id IN (SELECT id FROM media WHERE album_id = ?)').get(id, id) as { c: number }).c
  const favorites = (db.prepare('SELECT COUNT(*) c FROM favorites WHERE album_id = ?').get(id) as { c: number }).c
  let cover = row.cover_media_id ? (db.prepare('SELECT * FROM media WHERE id = ? AND album_id = ?').get(row.cover_media_id as number, id) as Record<string, unknown> | undefined) : undefined
  if (!cover) cover = db.prepare('SELECT * FROM media WHERE album_id = ? ORDER BY sort_order LIMIT 1').get(id) as Record<string, unknown> | undefined
  const favorited = userId != null ? !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND album_id = ?').get(userId, id) : false
  return {
    id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
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

export function mediaJson(row: Record<string, unknown>, userId?: number) {
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
    url: `/api/media/${id}/file`,
    thumbUrl: row.thumb_path ? `/api/media/${id}/thumb` : row.kind === 'image' ? `/api/media/${id}/file` : null,
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
