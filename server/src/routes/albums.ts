import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { db, now } from '../db.js'
import { requireAdmin, requireUser } from '../auth.js'
import { HttpError, bool, num, slugify, str, wrap, IdRow } from '../util.js'
import { albumJson, commentJson, mediaJson } from '../serialize.js'
import { removeMediaFiles } from './media.js'

export const albumsRouter = Router()

function visibleWhere(req: { user?: { role: string } }): string {
  return req.user?.role === 'admin' ? '1=1' : "visibility = 'published'"
}

function uniqueSlug(base: string, excludeId?: number): string {
  const root = slugify(base)
  let slug = root
  let n = 2
  while (db.prepare('SELECT id FROM albums WHERE slug = ? AND id <> ?').get(slug, excludeId ?? -1)) slug = `${root}-${n++}`
  return slug
}

albumsRouter.get(
  '/',
  requireUser,
  wrap((req, res) => {
    const q = str(req.query.q, 100).toLowerCase()
    const tag = str(req.query.tag, 60).toLowerCase()
    const sort = str(req.query.sort, 20) || 'manual'
    const order =
      sort === 'newest' ? 'created_at DESC' : sort === 'updated' ? 'updated_at DESC' : sort === 'title' ? 'title COLLATE NOCASE' : sort === 'popular' ? 'views DESC' : 'sort_order, created_at'
    let rows = db.prepare(`SELECT * FROM albums WHERE ${visibleWhere(req)} ORDER BY ${order}`).all() as IdRow[]
    if (q) rows = rows.filter((r) => `${r.title} ${r.description} ${r.tags}`.toLowerCase().includes(q))
    if (tag) rows = rows.filter((r) => (JSON.parse(r.tags as string) as string[]).map((t) => t.toLowerCase()).includes(tag))
    const albums = rows.map((r) => albumJson(r, req.user!.id))
    const tags = new Map<string, number>()
    for (const a of albums) for (const t of a.tags) tags.set(t, (tags.get(t) ?? 0) + 1)
    res.json({ albums, tags: [...tags.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })) })
  }),
)

albumsRouter.get(
  '/favorites',
  requireUser,
  wrap((req, res) => {
    const rows = db
      .prepare(`SELECT a.* FROM favorites f JOIN albums a ON a.id = f.album_id WHERE f.user_id = ? AND ${visibleWhere(req)} ORDER BY f.created_at DESC`)
      .all(req.user!.id) as IdRow[]
    res.json({ albums: rows.map((r) => albumJson(r, req.user!.id)) })
  }),
)

albumsRouter.post(
  '/',
  requireAdmin,
  wrap((req, res) => {
    const title = str(req.body?.title, 120)
    if (!title) throw new HttpError(400, 'Title is required')
    const t = now()
    const last = db.prepare('SELECT MAX(sort_order) m FROM albums').get() as { m: number | null }
    const info = db
      .prepare('INSERT INTO albums(slug, title, description, visibility, tags, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uniqueSlug(title), title, str(req.body?.description, 2000), 'draft', JSON.stringify([]), (last.m ?? 0) + 1, t, t)
    const row = db.prepare('SELECT * FROM albums WHERE id = ?').get(info.lastInsertRowid as number) as IdRow
    res.status(201).json({ album: albumJson(row, req.user!.id) })
  }),
)

albumsRouter.put(
  '/reorder',
  requireAdmin,
  wrap((req, res) => {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : []
    const upd = db.prepare('UPDATE albums SET sort_order = ? WHERE id = ?')
    ids.forEach((id, i) => upd.run(i + 1, id))
    res.json({ ok: true })
  }),
)

type AlbumRow = IdRow & { visibility: string; tags: string }

function loadAlbum(req: { user?: { role: string } }, key: string): AlbumRow {
  const byId = /^\d+$/.test(key)
  const row = db.prepare(`SELECT * FROM albums WHERE ${byId ? 'id' : 'slug'} = ?`).get(byId ? Number(key) : key) as AlbumRow | undefined
  if (!row) throw new HttpError(404, 'Album not found')
  if (row.visibility !== 'published' && req.user?.role !== 'admin') throw new HttpError(404, 'Album not found')
  return row
}

albumsRouter.get(
  '/:key',
  requireUser,
  wrap((req, res) => {
    const row = loadAlbum(req, req.params.key as string)
    db.prepare('UPDATE albums SET views = views + 1 WHERE id = ?').run(row.id)
    const media = db.prepare('SELECT * FROM media WHERE album_id = ? ORDER BY sort_order, id').all(row.id) as IdRow[]
    const comments = db
      .prepare('SELECT c.*, u.display_name, u.username FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.album_id = ? AND c.media_id IS NULL ORDER BY c.created_at')
      .all(row.id) as IdRow[]
    res.json({ album: albumJson(row, req.user!.id), media: media.map((m) => mediaJson(m, req.user!.id)), comments: comments.map(commentJson) })
  }),
)

albumsRouter.put(
  '/:id',
  requireAdmin,
  wrap((req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT * FROM albums WHERE id = ?').get(id) as IdRow | undefined
    if (!row) throw new HttpError(404, 'Album not found')
    const b = req.body ?? {}
    const title = str(b.title, 120) || (row.title as string)
    const slug = b.slug != null ? uniqueSlug(str(b.slug, 80) || title, id) : (row.slug as string)
    const description = b.description != null ? str(b.description, 2000) : (row.description as string)
    const visibility = b.visibility === 'published' || b.visibility === 'draft' ? b.visibility : row.visibility
    const tags = Array.isArray(b.tags) ? JSON.stringify(b.tags.map((t: unknown) => str(t, 40)).filter(Boolean).slice(0, 20)) : (row.tags as string)
    const layout = 'layoutOverride' in b ? (b.layoutOverride ? JSON.stringify(b.layoutOverride) : null) : (row.layout_override as string | null)
    const featured = 'featured' in b ? (bool(b.featured) ? 1 : 0) : (row.featured as number)
    const cover = 'coverMediaId' in b ? (b.coverMediaId == null ? null : num(b.coverMediaId)) : (row.cover_media_id as number | null)
    db.prepare(
      'UPDATE albums SET title = ?, slug = ?, description = ?, visibility = ?, tags = ?, layout_override = ?, featured = ?, cover_media_id = ?, updated_at = ? WHERE id = ?',
    ).run(title, slug, description, visibility as string, tags, layout, featured, cover, now(), id)
    res.json({ album: albumJson(db.prepare('SELECT * FROM albums WHERE id = ?').get(id) as IdRow, req.user!.id) })
  }),
)

albumsRouter.post(
  '/:id/share',
  requireAdmin,
  wrap((req, res) => {
    const id = Number(req.params.id)
    const enable = bool(req.body?.enabled, true)
    const token = enable ? randomBytes(12).toString('base64url') : null
    db.prepare('UPDATE albums SET share_token = ? WHERE id = ?').run(token, id)
    res.json({ shareToken: token })
  }),
)

albumsRouter.delete(
  '/:id',
  requireAdmin,
  wrap((req, res) => {
    const id = Number(req.params.id)
    const media = db.prepare('SELECT * FROM media WHERE album_id = ?').all(id) as IdRow[]
    db.prepare('DELETE FROM albums WHERE id = ?').run(id)
    for (const m of media) removeMediaFiles(m)
    res.json({ ok: true })
  }),
)

albumsRouter.post(
  '/:id/favorite',
  requireUser,
  wrap((req, res) => {
    const row = loadAlbum(req, req.params.id as string)
    const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND album_id = ?').get(req.user!.id, row.id)
    if (existing) db.prepare('DELETE FROM favorites WHERE user_id = ? AND album_id = ?').run(req.user!.id, row.id)
    else db.prepare('INSERT INTO favorites(user_id, album_id, created_at) VALUES (?, ?, ?)').run(req.user!.id, row.id, now())
    res.json({ favorited: !existing })
  }),
)

albumsRouter.get(
  '/:id/comments',
  requireUser,
  wrap((req, res) => {
    const row = loadAlbum(req, req.params.id as string)
    const comments = db
      .prepare('SELECT c.*, u.display_name, u.username FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.album_id = ? AND c.media_id IS NULL ORDER BY c.created_at')
      .all(row.id) as IdRow[]
    res.json({ comments: comments.map(commentJson) })
  }),
)

albumsRouter.post(
  '/:id/comments',
  requireUser,
  wrap((req, res) => {
    const row = loadAlbum(req, req.params.id as string)
    const body = str(req.body?.body, 2000)
    if (!body) throw new HttpError(400, 'Comment cannot be empty')
    const info = db.prepare('INSERT INTO comments(user_id, album_id, body, created_at) VALUES (?, ?, ?, ?)').run(req.user!.id, row.id, body, now())
    const c = db.prepare('SELECT c.*, u.display_name, u.username FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(info.lastInsertRowid as number) as IdRow
    res.status(201).json({ comment: commentJson(c) })
  }),
)

/** Public, login-free access through a share token. */
export const shareRouter = Router()
shareRouter.get(
  '/:token',
  wrap((req, res) => {
    const row = db.prepare('SELECT * FROM albums WHERE share_token = ?').get(req.params.token as string) as IdRow | undefined
    if (!row) throw new HttpError(404, 'This share link is not valid')
    const media = db.prepare('SELECT * FROM media WHERE album_id = ? ORDER BY sort_order, id').all(row.id) as IdRow[]
    const token = req.params.token as string
    res.json({
      album: albumJson(row),
      media: media.map((m) => {
        const j = mediaJson(m)
        return { ...j, url: `${j.url}?s=${token}`, thumbUrl: j.thumbUrl ? `${j.thumbUrl}?s=${token}` : null }
      }),
    })
  }),
)
